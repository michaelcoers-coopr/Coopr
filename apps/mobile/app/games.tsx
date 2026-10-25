import { useEffect, useMemo, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayLine, fmt, gamesForCount, headToHead, seasonTable, wolfOnHole, type GameKind } from '@coopr/games';
import { colors, font, play, signal } from '@coopr/tokens';
import { useDisplayFace } from '../src/design/display-font';
import { highCedarsHoles } from '../src/games/card';
import {
  DISCLOSURE,
  DOWN_TEXT,
  FOOTER,
  MISSED,
  SI_AMBER,
  acceptRow,
  activeKinds,
  afterCorrection,
  applyPhrase,
  assignSide,
  blankPlayer,
  buildSave,
  commitHole,
  correctLastHole,
  defaultSides,
  droppedGamesNote,
  emptyMarks,
  emptyStake,
  finishPrompt,
  firstStakeError,
  gameLine,
  handicapError,
  holesPlayed,
  isCorrection,
  liveScore,
  localPlayedOn,
  logReady,
  marksFromHole,
  partialLabel,
  phoneRounds,
  playerHandicap,
  potHero,
  recapFor,
  resumeHole,
  rivalryHero,
  rosterLine,
  rowsFromHole,
  setupBlock,
  speechHints,
  stablePlayerId,
  tapGross,
  tapPickup,
  toggleCoin,
  undoLastHole,
  visibleSetupLines,
  winnerText,
  wolfHero,
  wolfRequired,
  zeroSumLine,
  type CoinName,
  type EntryRow,
  type HoleMarks,
  type SetupPlayer,
  type Sides,
  type StakeDraft,
} from '../src/games/present';
import { downloadPng, recapCardLines, recapPng } from '../src/games/recap-bitmap';
import { finishOpenFoursome, readFoursomeHistory, readOpenFoursome, writeOpenFoursome } from '../src/games/store';
import type { FoursomeSave } from '@coopr/games';

const GAME_LABEL: Record<GameKind, string> = {
  stableford: 'Stableford',
  modified: 'Modified',
  skins: 'Skins',
  nassau: 'Nassau',
  match: 'Match',
  wolf: 'Wolf',
  vegas: 'Vegas',
  bbb: 'Bingo Bango Bongo',
  coins: 'Coins',
};

const COINS: CoinName[] = ['greenie', 'sandie', 'arnie', 'barkie'];

interface Heard {
  transcript: string
  readback: string
  question?: string | null
}

function freshPlayers(): SetupPlayer[] {
  const stamp = Date.now().toString(36);
  return [blankPlayer(`p-${stamp}-a`), blankPlayer(`p-${stamp}-b`)];
}

export default function GamesScreen() {
  const display = useDisplayFace();
  const insets = useSafeAreaInsets();
  const course = useMemo(() => highCedarsHoles(), []);
  const [step, setStep] = useState<'setup' | 'play' | 'results'>(() => (readOpenFoursome() ? 'play' : 'setup'));
  const [save, setSave] = useState<FoursomeSave | null>(() => readOpenFoursome());
  const [report, setReport] = useState<FoursomeSave | null>(null);
  const [players, setPlayers] = useState<SetupPlayer[]>(freshPlayers);
  const [ownerId, setOwnerId] = useState('');
  const [kinds, setKinds] = useState<GameKind[]>(['stableford']);
  const [stakes, setStakes] = useState<Record<string, StakeDraft>>({ stableford: emptyStake() });
  const [sides, setSides] = useState<Sides | null>(null);
  const [sidesTouched, setSidesTouched] = useState(false);
  const [grossOnly, setGrossOnly] = useState(false);
  const [hole, setHole] = useState(() => {
    const open = readOpenFoursome();
    return open ? resumeHole(open) : 1;
  });
  const [rows, setRows] = useState<EntryRow[]>(() => {
    const open = readOpenFoursome();
    return open ? rowsFromHole(open, resumeHole(open)) : [];
  });
  const [marks, setMarks] = useState<HoleMarks>(() => {
    const open = readOpenFoursome();
    if (!open) return emptyMarks();
    const number = resumeHole(open);
    return marksFromHole(open.holes.find((item) => item.number === number));
  });
  const [phrase, setPhrase] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<Heard | null>(null);
  const [info, setInfo] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [askFinish, setAskFinish] = useState(false);
  const [listening, setListening] = useState(false);
  const [mic, setMic] = useState(false);
  const [showNets, setShowNets] = useState(true);
  const [showHandicaps, setShowHandicaps] = useState(false);
  useEffect(() => {
    void import('../src/speech/recognize').then(({ deviceSpeechAvailable }) => deviceSpeechAvailable().then(setMic));
  }, []);
  const active = report ?? save;
  const score = active ? liveScore(active) : null;
  const named = players.filter((player) => player.name.trim());
  const chosenKinds = activeKinds(kinds, named.length || players.length);
  const suggested = defaultSides(named.map((player) => ({ id: player.id, courseHandicap: playerHandicap(player) })));
  const sidesNow: Sides = sidesTouched && sides
    ? {
        teamA: sides.teamA.filter((id) => named.some((player) => player.id === id)),
        teamB: sides.teamB.filter((id) => named.some((player) => player.id === id)),
      }
    : suggested;
  const teamGame = chosenKinds.some((kind) => kind === 'nassau' || kind === 'match' || kind === 'vegas');
  const block = setupBlock(players, chosenKinds, course.siOk, grossOnly, stakes, teamGame ? sidesNow : undefined);
  const stakeProblem = firstStakeError(chosenKinds, stakes);
  const droppedNote = droppedGamesNote(kinds, named.length);
  const notices = visibleSetupLines(block, stakeProblem, droppedNote);
  const offered = gamesForCount(named.length || 2);

  const openHole = (next: number, current = save, keep?: { note: string | null; heard: Heard | null }) => {
    const number = Math.min(18, Math.max(1, next));
    setHole(number);
    setRows(current ? rowsFromHole(current, number) : []);
    setMarks(current ? marksFromHole(current.holes.find((item) => item.number === number)) : emptyMarks());
    setNote(keep?.note ?? null);
    setHeard(keep?.heard ?? null);
    setPhrase('');
    setAskFinish(false);
  };

  const start = () => {
    const built = buildSave({
      id: `foursome-${Date.now()}`,
      players,
      ownerId: ownerId || named[0]?.id || '',
      kinds: chosenKinds,
      stakes,
      grossOnly,
      siOk: course.siOk,
      card: course.holes,
      sides: teamGame ? sidesNow : undefined,
    });
    if (!built) return;
    writeOpenFoursome(built);
    setSave(built);
    setReport(null);
    setStep('play');
    openHole(1, built);
  };

  const logHole = () => {
    if (!save || !logReady(rows, marks, wolfRequired(save))) return;
    const next = commitHole(save, hole, rows, marks);
    writeOpenFoursome(next);
    setSave(next);
    setHeard(null);
    if (hole < 18) openHole(hole + 1, next);
  };

  const wolfPlayer = (() => {
    if (!save || !wolfRequired(save)) return null;
    const points = score?.games.find((game) => game.kind === 'wolf')?.points ?? [0, 0, 0, 0];
    const index = wolfOnHole(hole, points, [0, 1, 2, 3]);
    return save.players[index] ?? null;
  })();

  const hear = async () => {
    if (!save) return;
    setListening(true);
    const { listenForSpeech } = await import('../src/speech/recognize');
    const session = await listenForSpeech((text, final) => {
      if (text) setPhrase(text);
      if (final) setListening(false);
    }, speechHints(save.players));
    if (!session) setListening(false);
  };

  const checkPhrase = () => {
    if (!save) return;
    const card = course.holes[hole - 1];
    if (!card) return;
    const text = phrase.trim();
    if (!text) {
      setHeard(null);
      setNote(MISSED);
      return;
    }
    if (isCorrection(text)) {
      const fixed = correctLastHole(save, text);
      if (!fixed.caught) {
        setHeard(null);
        setNote(fixed.note ?? MISSED);
        return;
      }
      writeOpenFoursome(fixed.save);
      setSave(fixed.save);
      const cardHole = fixed.save.holes.find((item) => item.number === fixed.hole);
      const kept = afterCorrection({
        openHole: hole,
        draftRows: rows,
        draftMarks: marks,
        correctedHole: fixed.hole,
        correctedRows: rowsFromHole(fixed.save, fixed.hole),
        correctedMarks: marksFromHole(cardHole),
      });
      setHole(kept.hole);
      setRows(kept.rows);
      setMarks(kept.marks);
      setNote(fixed.note);
      setHeard({ transcript: text, readback: fixed.readback ?? 'This hole.', question: null });
      setPhrase('');
      return;
    }
    const wolfId = wolfPlayer?.id ?? null;
    const applied = applyPhrase(rows, text, save, card, { wolfId, marks });
    if (applied.command === 'skip_hole') {
      const cardHeard = { transcript: text, readback: applied.readback ?? 'Skip this hole.' };
      if (hole < 18) openHole(hole + 1, save, { note: null, heard: cardHeard });
      else setHeard(cardHeard);
      return;
    }
    if (applied.command === 'undo') {
      const undone = undoLastHole(save);
      if (!undone) {
        setHeard(null);
        setNote('No hole is logged yet.');
        return;
      }
      writeOpenFoursome(undone.save);
      setSave(undone.save);
      openHole(undone.hole, undone.save, { note: null, heard: { transcript: text, readback: 'Undid the last hole.' } });
      return;
    }
    if (!applied.caught) {
      setHeard(null);
      setNote(MISSED);
      return;
    }
    const blindAfterScores = applied.marks.wolf?.mode === 'blind'
      && marks.wolf?.mode !== 'blind'
      && rows.some((row) => row.gross != null || row.pickup);
    setRows(applied.rows);
    setMarks(blindAfterScores ? { ...applied.marks, wolf: marks.wolf } : applied.marks);
    setNote(blindAfterScores ? 'Blind wolf has to come before the scores.' : applied.note);
    setHeard({ transcript: text, readback: applied.readback ?? 'This hole.', question: applied.question });
  };

  const saveImage = async () => {
    if (!report || !score) return;
    const bytes = recapPng(recapCardLines(report, score, { nets: showNets, handicaps: showHandicaps }));
    if (downloadPng(bytes, 'coopr-recap.png')) return;
    try {
      const fileSystem = await import('expo-file-system/legacy');
      if (!fileSystem.cacheDirectory) return;
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const path = `${fileSystem.cacheDirectory}coopr-recap.png`;
      await fileSystem.writeAsStringAsync(path, btoa(binary), { encoding: fileSystem.EncodingType.Base64 });
      await Share.share({ url: path, message: recapFor(report) });
    } catch {
      // This browser has no download and no file cache.
    }
  };

  const finish = () => {
    if (!save || holesPlayed(save) === 0) return;
    finishOpenFoursome(save, course.yards);
    setReport({ ...save, finishedOn: localPlayedOn() });
    setSave(null);
    setAskFinish(false);
    setStep('results');
  };

  const share = async () => {
    if (!report) return;
    try {
      await Share.share({ message: recapFor(report) });
    } catch {
      // The sheet was dismissed, or this browser has no share sheet.
    }
  };

  const playedCount = save ? holesPlayed(save) : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: 'Foursome', contentStyle: { backgroundColor: colors.navy } }} />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={[styles.kicker, { fontFamily: display }]}>FOURSOME</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={DISCLOSURE} onPress={() => setInfo((open) => !open)} style={styles.info}>
          <Text style={styles.infoText}>BB</Text>
        </Pressable>
      </View>
      {info ? <Text style={styles.disclosure}>{DISCLOSURE}</Text> : null}
      {step === 'play' && save && score ? (
        <View accessibilityLabel="Live strip" style={styles.strip}>
          <View style={styles.row}>
            {score.zeroSumOk
              ? save.players.map((player, index) => (
                  <View key={player.id} style={styles.netCell}>
                    <Text style={styles.meta}>{player.name}</Text>
                    <Text style={[styles.net, { fontFamily: display, color: (score.nets[index] ?? 0) < 0 ? DOWN_TEXT : colors.white }]}>
                      {fmt(score.nets[index] ?? 0, undefined, true)}
                    </Text>
                  </View>
                ))
              : <Text style={styles.amber}>{score.note}</Text>}
          </View>
          {score.games.some((game) => game.kind === 'skins') ? (
            <Text accessibilityLabel="Pot on the line" style={[styles.hero, { fontFamily: display }]}>{potHero(score.skinsPending)}</Text>
          ) : null}
          {wolfPlayer ? (
            <Text accessibilityLabel="Wolf" style={[styles.hero, { fontFamily: display }]}>{wolfHero(wolfPlayer.name)}</Text>
          ) : null}
          {(() => {
            const lead = score.games.find((game) => game.kind === 'skins') ?? score.games[0];
            if (!lead) return null;
            return (
              <Text style={styles.meta}>
                {gameLine(lead, {
                  names: save.players.map((player) => player.name),
                  pending: score.skinsPending,
                  finished: false,
                  roster: null,
                })}
              </Text>
            );
          })()}
          <Text style={styles.disclosure}>{DISCLOSURE}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'setup' ? (
          <View style={styles.stack}>
            <Text style={styles.disclosure}>{DISCLOSURE}</Text>
            {!course.siOk ? <Text style={styles.amber}>{SI_AMBER}</Text> : null}
            {players.map((player, index) => {
              const range = handicapError(player);
              return (
                <View key={player.id} style={styles.card}>
                  <Text style={styles.label}>{`Player ${index + 1}`}</Text>
                  <TextInput
                    value={player.name}
                    onChangeText={(name) => setPlayers((current) => current.map((item) => (item.id === player.id ? { ...item, name } : item)))}
                    accessibilityLabel={`Player ${index + 1} name`}
                    placeholder="Name"
                    placeholderTextColor={play.muted}
                    style={styles.input}
                  />
                  <Text style={styles.label}>Course handicap</Text>
                  <TextInput
                    value={player.handicapText}
                    onChangeText={(handicapText) =>
                      setPlayers((current) => current.map((item) => (item.id === player.id ? { ...item, handicapText, scratch: false } : item)))
                    }
                    accessibilityLabel={`${player.name || `Player ${index + 1}`} course handicap`}
                    placeholder="-10 to 54"
                    placeholderTextColor={play.muted}
                    keyboardType="numbers-and-punctuation"
                    style={styles.input}
                  />
                  {range ? <Text style={styles.amber}>{range}</Text> : null}
                  {player.name.trim() && playerHandicap(player) == null && !range ? <Text style={styles.amber}>{`Enter ${player.name.trim()}'s course handicap, or play him scratch (0).`}</Text> : null}
                  <View style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name || `Player ${index + 1}`} scratch`}
                      onPress={() => setPlayers((current) => current.map((item) => (item.id === player.id ? { ...item, scratch: true, handicapText: '0' } : item)))}
                      style={[styles.chip, player.scratch && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>Scratch</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name || `Player ${index + 1}`} plays from this phone`}
                      onPress={() => setOwnerId(player.id)}
                      style={[styles.chip, (ownerId || players[0]?.id) === player.id && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>This phone</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={styles.row}>
              {players.length < 4 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Add player" onPress={() => setPlayers((current) => [...current, blankPlayer(`p-${Date.now().toString(36)}`)])} style={styles.chip}>
                  <Text style={styles.chipText}>Add player</Text>
                </Pressable>
              ) : null}
              {players.length > 2 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove last player"
                  onPress={() => {
                    setPlayers((current) => current.slice(0, -1));
                    setSidesTouched(false);
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>Remove last</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.label}>Games</Text>
            <View style={styles.row}>
              {offered.map((kind) => (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={GAME_LABEL[kind]}
                  onPress={() => {
                    setKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
                    setStakes((current) => ({ ...current, [kind]: current[kind] ?? emptyStake() }));
                  }}
                  style={[styles.chip, chosenKinds.includes(kind) && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{GAME_LABEL[kind]}</Text>
                </Pressable>
              ))}
            </View>
            {chosenKinds.map((kind) => {
              const draft = stakes[kind] ?? emptyStake();
              const set = (patch: Partial<StakeDraft>) => setStakes((current) => ({ ...current, [kind]: { ...(current[kind] ?? emptyStake()), ...patch } }));
              const fields = kind === 'nassau'
                ? ([['front', 'Front'], ['back', 'Back'], ['total', 'Total'], ['press', 'Press stake']] as const)
                : ([['amount', `${GAME_LABEL[kind]} stake`]] as const);
              return (
                <View key={kind} style={styles.card}>
                  <Text style={styles.label}>{`${GAME_LABEL[kind]} stake, BB`}</Text>
                  {fields.map(([key, label]) => {
                    const value = draft[key];
                    return (
                      <View key={key} style={styles.stack}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                          value={value}
                          onChangeText={(next) => set({ [key]: next })}
                          accessibilityLabel={kind === 'nassau' ? `${key} stake` : `${GAME_LABEL[kind]} stake`}
                          placeholder="BB"
                          placeholderTextColor={play.muted}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      </View>
                    );
                  })}
                  {kind === 'stableford' || kind === 'modified' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Pot or per point" onPress={() => set({ pot: !draft.pot })} style={styles.chip}>
                      <Text style={styles.chipText}>{draft.pot ? 'Pot' : 'Per point'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {teamGame && named.length === 3 ? <Text style={styles.copy}>Nassau uses the low score. No sides to set.</Text> : null}
            {teamGame && (named.length === 2 || named.length === 4) ? (
              <View style={styles.card}>
                <Text style={styles.label}>Sides</Text>
                <Text style={styles.copy}>{`${named.filter((player) => sidesNow.teamA.includes(player.id)).map((player) => player.name).join(' and ') || 'Side A'} vs ${named.filter((player) => sidesNow.teamB.includes(player.id)).map((player) => player.name).join(' and ') || 'Side B'}`}</Text>
                {named.map((player) => (
                  <View key={player.id} style={styles.row}>
                    <Text style={styles.copy}>{player.name}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name} on side A`}
                      onPress={() => {
                        setSidesTouched(true);
                        setSides(assignSide(sidesNow, player.id, 'A'));
                      }}
                      style={[styles.chip, sidesNow.teamA.includes(player.id) && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>Side A</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${player.name} on side B`}
                      onPress={() => {
                        setSidesTouched(true);
                        setSides(assignSide(sidesNow, player.id, 'B'));
                      }}
                      style={[styles.chip, sidesNow.teamB.includes(player.id) && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>Side B</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Gross only" onPress={() => setGrossOnly((value) => !value)} style={[styles.chip, grossOnly && styles.chipOn]}>
              <Text style={styles.chipText}>{grossOnly ? 'Gross only' : 'Net scores'}</Text>
            </Pressable>
            {notices.map((line) => <Text key={line} style={styles.amber}>{line}</Text>)}
            <Pressable accessibilityRole="button" accessibilityLabel="Start round" disabled={!!block} onPress={start} style={[styles.go, !!block && styles.disabled]}>
              <Text style={[styles.goText, { fontFamily: display }]}>START ROUND</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 'play' && save && score ? (
          <View style={styles.stack}>
            <Pressable accessibilityRole="button" accessibilityLabel="Games" onPress={() => setGamesOpen((open) => !open)} style={styles.chip}>
              <Text style={styles.chipText}>Games</Text>
            </Pressable>
            <Text style={[styles.holeNo, { fontFamily: display }]}>{String(hole)}</Text>
            <Text style={styles.meta}>{`Par ${course.holes[hole - 1]?.par ?? '—'} · BB`}</Text>
            <View style={styles.row}>
              {save.holes.map((item) => (
                <Pressable key={item.number} accessibilityRole="button" accessibilityLabel={`Hole ${item.number}`} onPress={() => openHole(item.number)} style={[styles.holeChip, item.number === hole && styles.chipOn]}>
                  <Text style={[styles.holeChipText, { fontFamily: display }]}>{String(item.number)}</Text>
                </Pressable>
              ))}
            </View>
            {rows.map((row) => (
              <View key={row.playerId} style={[styles.card, row.amber && styles.amberCard]}>
                <Text style={styles.label}>{row.name}</Text>
                <Text style={[styles.gross, { fontFamily: display }]}>{row.pickup ? 'PU' : row.gross ?? '—'}</Text>
                {row.question ? <Text style={styles.amber}>{row.question}</Text> : null}
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} lower`} onPress={() => setRows((current) => tapGross(current, row.playerId, (row.gross ?? (course.holes[hole - 1]?.par ?? 4)) - 1))} style={styles.chip}>
                    <Text style={styles.chipText}>−</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} higher`} onPress={() => setRows((current) => tapGross(current, row.playerId, (row.gross ?? (course.holes[hole - 1]?.par ?? 4)) + 1))} style={styles.chip}>
                    <Text style={styles.chipText}>+</Text>
                  </Pressable>
                  {([
                    ['Par', 0],
                    ['Birdie', -1],
                    ['Bogey', 1],
                    ['Double', 2],
                  ] as const).map(([label, delta]) => (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.name} ${label}`}
                      onPress={() => setRows((current) => tapGross(current, row.playerId, (course.holes[hole - 1]?.par ?? 4) + delta))}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} pickup`} onPress={() => setRows((current) => tapPickup(current, row.playerId))} style={styles.chip}>
                    <Text style={styles.chipText}>Pickup</Text>
                  </Pressable>
                  {row.amber ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Confirm ${row.name}`} onPress={() => setRows((current) => acceptRow(current, row.playerId))} style={styles.confirmChip}>
                      <Text style={styles.chipText}>Confirm</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            {wolfPlayer ? (
              <View style={styles.card}>
                <Text style={styles.label}>{`${wolfPlayer.name} is the wolf`}</Text>
                <View style={styles.row}>
                  {save.players.filter((player) => player.id !== wolfPlayer.id).map((player) => (
                    <Pressable
                      key={player.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${wolfPlayer.name} takes ${player.name}`}
                      onPress={() => setMarks((current) => ({ ...current, wolfSkipped: false, wolf: { mode: 'partner', wolfId: wolfPlayer.id, partnerId: player.id } }))}
                      style={[styles.chip, marks.wolf?.wolfId === wolfPlayer.id && marks.wolf?.mode === 'partner' && marks.wolf.partnerId === player.id && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>{player.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel="Lone wolf" onPress={() => setMarks((current) => ({ ...current, wolfSkipped: false, wolf: { mode: 'lone', wolfId: wolfPlayer.id, partnerId: null } }))} style={[styles.chip, marks.wolf?.mode === 'lone' && styles.chipOn]}>
                    <Text style={styles.chipText}>Lone</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Blind wolf"
                    disabled={rows.some((row) => row.gross != null || row.pickup)}
                    onPress={() => setMarks((current) => ({ ...current, wolfSkipped: false, wolf: { mode: 'blind', wolfId: wolfPlayer.id, partnerId: null } }))}
                    style={[styles.chip, marks.wolf?.mode === 'blind' && styles.chipOn]}
                  >
                    <Text style={styles.chipText}>Blind</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="No wolf" onPress={() => setMarks((current) => ({ ...current, wolf: null, wolfSkipped: true }))} style={[styles.chip, marks.wolfSkipped && styles.chipOn]}>
                    <Text style={styles.chipText}>No wolf</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear wolf call" onPress={() => setMarks((current) => ({ ...current, wolf: null, wolfSkipped: false }))} style={styles.chip}>
                    <Text style={styles.chipText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {save.games.some((game) => game.kind === 'bbb') ? (
              <View style={styles.card}>
                <Text style={styles.label}>Bingo Bango Bongo</Text>
                {(['bingo', 'bango', 'bongo'] as const).map((key) => (
                  <View key={key} style={styles.stack}>
                    <Text style={styles.meta}>{key}</Text>
                    <View style={styles.row}>
                      {save.players.map((player) => (
                        <Pressable
                          key={player.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${key} ${player.name}`}
                          onPress={() => setMarks((current) => ({ ...current, bbb: { ...current.bbb, [key]: current.bbb[key] === player.id ? null : player.id } }))}
                          style={[styles.chip, marks.bbb[key] === player.id && styles.chipOn]}
                        >
                          <Text style={styles.chipText}>{player.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {save.games.some((game) => game.kind === 'coins') ? (
              <View style={styles.card}>
                <Text style={styles.label}>Coins</Text>
                {COINS.map((coin) => (
                  <View key={coin} style={styles.stack}>
                    <Text style={styles.meta}>{coin}</Text>
                    <View style={styles.row}>
                      {save.players.map((player) => {
                        const on = marks.coins.some((item) => item.playerId === player.id && item.coin === coin);
                        return (
                          <Pressable
                            key={player.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${coin} ${player.name}`}
                            onPress={() => setMarks((current) => toggleCoin(current, player.id, coin))}
                            style={[styles.chip, on && styles.chipOn]}
                          >
                            <Text style={styles.chipText}>{player.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {save.games.some((game) => game.kind === 'nassau') ? (
              <View style={styles.stack}>
                <Pressable accessibilityRole="button" accessibilityLabel="Press this hole" onPress={() => setMarks((current) => ({ ...current, press: !current.press }))} style={[styles.chip, marks.press && styles.chipOn]}>
                  <Text style={styles.chipText}>{marks.press ? 'Press is on' : 'Press this hole'}</Text>
                </Pressable>
                <Text style={styles.meta}>Auto-press stays at 2.</Text>
              </View>
            ) : null}
            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              accessibilityLabel="Hole phrase"
              placeholder="Mike 5, Dave birdie"
              placeholderTextColor={play.muted}
              style={styles.input}
            />
            {heard ? (
              <View accessibilityLabel="Confirm card" style={styles.card}>
                <Text style={styles.label}>Heard</Text>
                <Text style={styles.copy}>{heard.transcript}</Text>
                <Text style={styles.label}>Read-back</Text>
                <Text accessibilityLabel="Read-back" style={styles.copy}>{heard.readback}</Text>
                {heard.question ? <Text style={styles.copy}>{heard.question}</Text> : null}
              </View>
            ) : null}
            {note ? <Text style={styles.amber}>{note}</Text> : null}
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel="Check phrase" onPress={checkPhrase} style={styles.chip}>
                <Text style={styles.chipText}>Check phrase</Text>
              </Pressable>
              {mic ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Listen" onPress={() => void hear()} style={styles.chip}>
                  <Text style={styles.chipText}>{listening ? 'Listening' : 'Listen'}</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Log hole" disabled={!logReady(rows, marks, wolfRequired(save))} onPress={logHole} style={[styles.go, !logReady(rows, marks, wolfRequired(save)) && styles.disabled]}>
              <Text style={[styles.goText, { fontFamily: display }]}>LOG HOLE</Text>
            </Pressable>
            {playedCount === 0 ? <Text style={styles.meta}>Log a hole before finishing.</Text> : null}
            {askFinish ? (
              <View style={styles.card}>
                <Text style={styles.copy}>{finishPrompt(playedCount)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Confirm finish" onPress={finish} style={styles.go}>
                  <Text style={[styles.goText, { fontFamily: display }]}>FINISH</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Keep playing" onPress={() => setAskFinish(false)} style={styles.chip}>
                  <Text style={styles.chipText}>Keep playing</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Finish round" disabled={playedCount === 0} onPress={() => setAskFinish(true)} style={[styles.chip, playedCount === 0 && styles.disabled]}>
                <Text style={styles.chipText}>Finish round</Text>
              </Pressable>
            )}
          </View>
        ) : null}
        {step === 'results' && report && score ? (
          <View style={styles.stack}>
            <Text style={styles.disclosure}>{DISCLOSURE}</Text>
            {score.games.some((game) => game.nets) ? (
              <Text accessibilityLabel="Takes the day" style={[styles.hero, { fontFamily: display }]}>{dayLine(report.players.map((player) => player.name), score.nets)}</Text>
            ) : null}
            <Text accessibilityLabel="Zero-sum check" style={score.zeroSumOk ? styles.copy : styles.amber}>{zeroSumLine(score)}</Text>
            <RivalryHero current={report} />
            {partialLabel(holesPlayed(report)) ? <Text style={styles.copy}>{partialLabel(holesPlayed(report))}</Text> : null}
            {score.games.map((game) => {
              const roster = report.games.find((item) => item.kind === game.kind);
              const rosterText = roster ? rosterLine(report, roster) : null;
              const line = gameLine(game, { names: report.players.map((player) => player.name), pending: score.skinsPending, finished: true, roster: rosterText });
              const who = winnerText(game);
              return (
                <View key={game.kind} style={styles.card}>
                  <Text style={styles.label}>{game.label}</Text>
                  {rosterText ? <Text style={styles.copy}>{rosterText}</Text> : null}
                  {who !== line ? <Text style={styles.copy}>{who}</Text> : null}
                  <Text style={styles.copy}>{line}</Text>
                </View>
              );
            })}
            {score.settle.map((line) => (
              <Text key={line.line} style={[styles.settle, { fontFamily: display, color: colors.white }]}>{line.line}</Text>
            ))}
            {score.settle.length === 0 && score.zeroSumOk ? <Text style={styles.copy}>Squared.</Text> : null}
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel="Show BB nets" onPress={() => setShowNets((value) => !value)} style={[styles.chip, showNets && styles.chipOn]}>
                <Text style={styles.chipText}>Show BB nets</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Show handicaps" onPress={() => setShowHandicaps((value) => !value)} style={[styles.chip, showHandicaps && styles.chipOn]}>
                <Text style={styles.chipText}>Show handicaps</Text>
              </Pressable>
            </View>
            <View accessibilityLabel="Recap card" style={styles.recap}>
              <Text style={[styles.kicker, { fontFamily: display }]}>RECAP</Text>
              {showNets ? report.players.map((player, index) => (
                <Text key={player.id} style={[styles.settle, { fontFamily: display, color: (score.nets[index] ?? 0) < 0 ? DOWN_TEXT : colors.white }]}>
                  {`${player.name} ${fmt(score.nets[index] ?? 0, undefined, true)}`}
                </Text>
              )) : null}
              {showHandicaps ? report.players.map((player) => (
                player.courseHandicap == null ? null : (
                  <Text key={`${player.id}-hcp`} style={styles.copy}>{`${player.name} handicap ${player.courseHandicap}`}</Text>
                )
              )) : null}
              {score.settle.map((line) => (
                <Text key={line.line} style={styles.copy}>{line.line}</Text>
              ))}
              <Text style={styles.disclosure}>{DISCLOSURE}</Text>
            </View>
            <Text style={styles.copy}>{FOOTER}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Save image" onPress={() => void saveImage()} style={styles.go}>
              <Text style={[styles.goText, { fontFamily: display }]}>SAVE IMAGE</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share recap" onPress={() => void share()} style={styles.chip}>
              <Text style={styles.chipText}>SHARE RECAP</Text>
            </Pressable>
            <OnThisPhone current={report} />
          </View>
        ) : null}
      </ScrollView>
      {listening && mic ? (
        <View accessibilityLabel="Listening" style={styles.sheet}>
          <Text style={[styles.hero, { fontFamily: display }]}>Listening</Text>
          <Text accessibilityLabel="Transcript" style={styles.copy}>{phrase || '…'}</Text>
          <Text style={styles.disclosure}>{DISCLOSURE}</Text>
        </View>
      ) : null}
      {gamesOpen && save ? (
        <View accessibilityLabel="Games sheet" style={styles.sheet}>
          <Text style={styles.label}>Games in this round</Text>
          {save.games.map((game) => (
            <Text key={game.kind} style={styles.copy}>{`${GAME_LABEL[game.kind]}${rosterLine(save, game) ? ` · ${rosterLine(save, game)}` : ''}`}</Text>
          ))}
          <Text style={styles.disclosure}>{DISCLOSURE}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close games" onPress={() => setGamesOpen(false)} style={styles.chip}>
            <Text style={styles.chipText}>Close</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RivalryHero({ current }: { current: FoursomeSave }) {
  const history = readFoursomeHistory();
  const saves = history.some((item) => item.id === current.id) ? history : [...history, current];
  const rounds = phoneRounds(saves);
  const [a, b] = current.players;
  if (!a || !b) return null;
  const rivalry = headToHead(rounds, stablePlayerId(a.name), stablePlayerId(b.name));
  return <Text accessibilityLabel="Head to head" style={styles.hero}>{rivalryHero(a.name, b.name, rivalry.winsA, rivalry.winsB)}</Text>;
}

function OnThisPhone({ current }: { current: FoursomeSave }) {
  const history = readFoursomeHistory();
  const saves = history.some((item) => item.id === current.id) ? history : [...history, current];
  const rounds = phoneRounds(saves);
  const table = seasonTable(rounds);
  if (table.length === 0) return null;
  const [a, b] = current.players;
  const rivalry = a && b ? headToHead(rounds, stablePlayerId(a.name), stablePlayerId(b.name)) : null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>On this phone</Text>
      {table.map((row) => (
        <Text key={row.id} style={styles.copy}>{`${row.name} ${fmt(row.net, undefined, true)}`}</Text>
      ))}
      {rivalry && a && b ? <Text style={styles.copy}>{`${a.name} ${rivalry.winsA}–${rivalry.winsB} ${b.name}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  back: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.white, fontFamily: font.family, fontSize: 16 },
  kicker: { color: colors.white, fontSize: 28, letterSpacing: 1 },
  info: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: '#102848', alignItems: 'center', justifyContent: 'center' },
  infoText: { color: signal.go, fontFamily: font.family, fontWeight: '800' },
  body: { paddingBottom: 108, gap: 12 },
  stack: { gap: 12 },
  strip: { backgroundColor: '#102848', borderRadius: 16, padding: 12, gap: 8, marginBottom: 8 },
  card: { backgroundColor: '#102848', borderRadius: 16, padding: 12, gap: 8 },
  recap: { backgroundColor: '#102848', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  sheet: { position: 'absolute', left: 16, right: 16, bottom: 24, zIndex: 30, backgroundColor: '#102848', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  hero: { color: colors.white, fontSize: 40, lineHeight: 44 },
  amberCard: { borderWidth: 1, borderColor: signal.caution },
  label: { color: play.muted, fontFamily: font.family, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  input: { color: colors.white, fontFamily: font.family, fontSize: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', minHeight: 44 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#14301F', borderWidth: 2, borderColor: signal.go },
  confirmChip: { minWidth: 44, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#14301F', borderWidth: 2, borderColor: signal.go, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.white, fontFamily: font.family, fontSize: 14, fontWeight: '700' },
  go: { minHeight: 56, borderRadius: 16, backgroundColor: signal.go, alignItems: 'center', justifyContent: 'center' },
  goText: { color: colors.navy, fontSize: 28, letterSpacing: 0.6 },
  disabled: { opacity: 0.4 },
  disclosure: { color: colors.white, fontFamily: font.family, fontSize: 13, lineHeight: 18 },
  amber: { color: signal.caution, fontFamily: font.family, fontSize: 14, lineHeight: 20 },
  holeNo: { color: colors.white, fontSize: 92, lineHeight: 92, fontVariant: ['tabular-nums'] },
  meta: { color: play.muted, fontFamily: font.family, fontSize: 13 },
  netCell: { minWidth: 72 },
  net: { fontSize: 28, fontVariant: ['tabular-nums'] },
  gross: { color: colors.white, fontSize: 48, lineHeight: 48, fontVariant: ['tabular-nums'] },
  holeChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  holeChipText: { color: colors.white, fontSize: 16 },
  copy: { color: colors.white, fontFamily: font.family, fontSize: 16, lineHeight: 22 },
  settle: { fontSize: 28, lineHeight: 32 },
});
