import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dayLine, fmt, gamesForCount, seasonTable, wolfOnHole, type GameKind } from '@coopr/games';
import { colors, font, play, signal } from '@coopr/tokens';
import { useDisplayFace } from '../src/design/display-font';
import { highCedarsHoles } from '../src/games/card';
import {
  BLIND_HOLD,
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
  blindRefusalLines,
  blankPlayer,
  buildSave,
  commitHole,
  correctLastHole,
  defaultSides,
  droppedGamesNote,
  emptyMarks,
  emptyStake,
  finishPrompt,
  fitStripName,
  firstStakeError,
  gameLine,
  handicapError,
  holesPlayed,
  isCorrection,
  liveScore,
  localPlayedOn,
  logHoleReason,
  logReady,
  marksFromHole,
  dayAmount,
  oweCombinations,
  partialLabel,
  phoneRounds,
  playerHandicap,
  potHero,
  rivalryPick,
  stablefordLine,
  wolfPointsTable,
  recapFor,
  resumeHole,
  rivalryHero,
  rosterLine,
  rowsFromHole,
  setupBlock,
  speechHints,
  stripCellWidth,
  tapGross,
  tapPickup,
  toggleCoin,
  undoLastHole,
  visibleSetupLines,
  visiblePhraseLines,
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
import { RecapCard } from '../src/games/recap-card';
import { downloadPng } from '../src/games/recap-bitmap';
import { captureRecap } from '../src/games/recap-shot';
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

/** One line on the card. The question mark opens the longer rule. */
const GAME_BLURB: Record<GameKind, { line: string; rules: string }> = {
  stableford: { line: 'Points for the score against par.', rules: 'A net birdie is more points than a net par. The player with the most points takes the stake.' },
  modified: { line: 'Stableford points, with a different table.', rules: 'Same idea as Stableford. The point table is the modified one. Highest points take the stake.' },
  skins: { line: 'Low score wins the hole. A tie carries it.', rules: 'The lowest score on the hole wins the skin. If two players tie, the skin carries to the next hole.' },
  nassau: { line: 'A match on the front, the back, and the round.', rules: 'Three parts: front nine, back nine, and all 18. A press is an extra stake from the next hole.' },
  match: { line: 'Holes won, not strokes.', rules: 'The side that wins more holes is ahead. The match can end when one side cannot be caught.' },
  wolf: { line: 'The wolf picks a partner or goes alone.', rules: 'On a hole the wolf chooses a partner, plays alone, or plays blind. Needs four players. Points settle in Birdie Bucks.' },
  vegas: { line: 'Partners combine their scores into one number.', rules: 'Each side makes a two-digit number from its scores. The lower number wins the hole. Needs four players.' },
  bbb: { line: 'Points for first on, closest, and first in.', rules: 'Bingo is first on the green, bango is closest to the pin, bongo is first in the hole.' },
  coins: { line: 'A point for a greenie, sandie, arnie, or barkie.', rules: 'Call the coin when it happens. Each one is a point in Birdie Bucks.' },
};

function leaderboardMoment(pending: number, winners: readonly string[], played: number): string {
  if (played > 0 && pending > 1) {
    const carried = pending - 1;
    return carried === 1 ? 'Skin carried' : `${carried} skins carried`;
  }
  if (winners.length === 1) return `Skin won · ${winners[0]}`;
  return 'Leaderboard';
}

let setupDraft: { players: SetupPlayer[]; kinds: GameKind[]; stakes: Record<string, StakeDraft> } | null = null;

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
  const { width: windowWidth } = useWindowDimensions();
  const recapRef = useRef<ComponentRef<typeof View>>(null);
  const insets = useSafeAreaInsets();
  const course = useMemo(() => highCedarsHoles(), []);
  const [step, setStep] = useState<'setup' | 'play' | 'results'>(() => (readOpenFoursome() ? 'play' : 'setup'));
  const [save, setSave] = useState<FoursomeSave | null>(() => readOpenFoursome());
  const [report, setReport] = useState<FoursomeSave | null>(null);
  const [players, setPlayers] = useState<SetupPlayer[]>(() => setupDraft?.players ?? freshPlayers());
  const [ownerId, setOwnerId] = useState('');
  const [kinds, setKinds] = useState<GameKind[]>(() => setupDraft?.kinds ?? ['skins']);
  const [rulesKind, setRulesKind] = useState<GameKind | null>(null);
  const [stakes, setStakes] = useState<Record<string, StakeDraft>>(() => setupDraft?.stakes ?? { skins: emptyStake() });
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
  const [stripOpen, setStripOpen] = useState(false);
  useEffect(() => {
    void import('../src/speech/recognize').then(({ deviceSpeechAvailable }) => deviceSpeechAvailable().then(setMic));
  }, []);
  useEffect(() => {
    if (step !== 'setup') return;
    setupDraft = { players, kinds, stakes };
  }, [step, players, kinds, stakes]);
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
    setupDraft = null;
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
    if (blindAfterScores) {
      const view = blindRefusalLines({
        readback: applied.readback,
        question: applied.question,
        note: applied.note,
        holdVisible: Boolean(wolfPlayer),
      });
      setRows(applied.rows);
      setMarks({ ...applied.marks, wolf: marks.wolf });
      setNote(view.note);
      if (view.readback || view.question) setHeard({ transcript: text, readback: view.readback ?? 'This hole.', question: view.question });
      else setHeard(null);
      return;
    }
    setRows(applied.rows);
    setMarks(applied.marks);
    setNote(applied.note);
    setHeard({ transcript: text, readback: applied.readback ?? 'This hole.', question: applied.question });
  };

  const saveImage = async () => {
    if (!report || !score) return;
    try {
      const bytes = await captureRecap(recapRef);
      if (!bytes) return;
      if (downloadPng(bytes, 'coopr-recap.png')) return;
      const fileSystem = await import('expo-file-system/legacy');
      if (!fileSystem.cacheDirectory) return;
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const path = `${fileSystem.cacheDirectory}coopr-recap.png`;
      await fileSystem.writeAsStringAsync(path, btoa(binary), { encoding: fileSystem.EncodingType.Base64 });
      await Share.share({ url: path, message: recapFor(report) });
    } catch {
      // Capture, download, or the share sheet failed.
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
  const blindHeld = rows.some((row) => row.gross != null || row.pickup);
  const holeReason = save ? logHoleReason(rows, marks, wolfRequired(save)) : null;
  const cardLines = heard ? visiblePhraseLines({ note: null, readback: heard.readback, question: heard.question ?? null }) : [];
  const noteLine = note && !cardLines.includes(note) ? note : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: 'Foursome', contentStyle: { backgroundColor: colors.navy } }} />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={[styles.kicker, { fontFamily: display }]}>FOURSOME</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Birdie Bucks" onPress={() => setInfo((open) => !open)} style={styles.info}>
          <Text style={styles.infoText}>Birdie Bucks</Text>
        </Pressable>
      </View>
      {info ? <Text style={styles.disclosure}>{DISCLOSURE}</Text> : null}
      {step === 'play' && save && score ? (
        <View accessibilityLabel="Live strip" style={styles.strip}>
          <View style={styles.stripHead}>
            {score.zeroSumOk ? (
              <View style={styles.stripNets}>
                {save.players.map((player, index) => {
                  const net = score.nets[index] ?? 0;
                  const amount = fmt(net, undefined, true);
                  return (
                    <View key={player.id} style={styles.stripCell}>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.stripName}>{fitStripName(player.name, amount, stripCellWidth(windowWidth))}</Text>
                      <Text style={[styles.stripAmount, { fontFamily: display, color: net < 0 ? DOWN_TEXT : colors.white }]}>{amount}</Text>
                    </View>
                  );
                })}
              </View>
            ) : <Text style={[styles.amber, styles.stripNets]}>{score.note}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel={stripOpen ? 'Hide live detail' : 'Show live detail'} onPress={() => setStripOpen((open) => !open)} style={styles.stripToggle}>
              <Text style={styles.chevron}>{stripOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
          <Text accessibilityLabel="Live leaderboard" style={styles.meta}>
            {leaderboardMoment(score.skinsPending, score.games.find((game) => game.kind === 'skins')?.winners ?? [], playedCount)}
          </Text>
          {stripOpen ? (
            <>
              {score.games.some((game) => game.kind === 'skins') ? (
                <Text accessibilityLabel="Pot on the line" style={[styles.stripLine, { fontFamily: display }]}>
                  {potHero(
                    score.skinsPending,
                    save.games.find((game) => game.kind === 'skins')?.stake ?? null,
                    save.players.length,
                    save.games.find((game) => game.kind === 'skins')?.carry !== false,
                  )}
                </Text>
              ) : null}
              {wolfPlayer ? (
                <Text accessibilityLabel="Wolf" style={[styles.stripLine, { fontFamily: display }]}>{wolfHero(wolfPlayer.name)}</Text>
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
            </>
          ) : null}
        </View>
      ) : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'setup' ? (
          <View style={styles.stack}>
            <Text style={styles.disclosure}>Birdie Bucks (BB) are points on this phone. They have no real-world value.</Text>
            <Text style={styles.copy}>More than one game can run at the same time.</Text>
            {!course.siOk ? <Text style={styles.amber}>{SI_AMBER}</Text> : null}
            <View style={styles.row}>
              {players.map((player, index) => (
                <View key={player.id} accessibilityLabel={`${player.name.trim() || `Player ${index + 1}`} chip`} style={styles.chip}>
                  <Text style={styles.chipText}>{player.name.trim() || 'Name'}</Text>
                </View>
              ))}
            </View>
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
                    placeholder="Scratch (0)"
                    placeholderTextColor={play.muted}
                    keyboardType="numbers-and-punctuation"
                    style={styles.input}
                  />
                  {range ? <Text style={styles.amber}>{range}</Text> : null}
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
            {!offered.includes('wolf') ? (
              <View style={styles.card}>
                <Text style={styles.label}>Wolf</Text>
                <Text style={styles.copy}>{GAME_BLURB.wolf.line}</Text>
                <Text style={styles.meta}>Needs four players.</Text>
              </View>
            ) : null}
            {offered.map((kind) => (
              <View key={kind} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={GAME_LABEL[kind]}
                  accessibilityState={{ selected: chosenKinds.includes(kind) }}
                  {...({ 'aria-selected': chosenKinds.includes(kind) } as object)}
                  onPress={() => {
                    setKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
                    setStakes((current) => ({ ...current, [kind]: current[kind] ?? emptyStake() }));
                  }}
                  style={[styles.chip, chosenKinds.includes(kind) && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{GAME_LABEL[kind]}</Text>
                </Pressable>
                <Text style={styles.copy}>{GAME_BLURB[kind].line}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${GAME_LABEL[kind]} rules`} onPress={() => setRulesKind((current) => (current === kind ? null : kind))} style={styles.rulesMark}>
                  <Text style={styles.chipText}>?</Text>
                </Pressable>
                {rulesKind === kind ? <Text style={styles.copy}>{GAME_BLURB[kind].rules}</Text> : null}
              </View>
            ))}
            {chosenKinds.map((kind) => {
              const draft = stakes[kind] ?? emptyStake();
              const set = (patch: Partial<StakeDraft>) => setStakes((current) => ({ ...current, [kind]: { ...(current[kind] ?? emptyStake()), ...patch } }));
              const fields = kind === 'nassau'
                ? ([['front', 'Front'], ['back', 'Back'], ['total', 'Total'], ['press', 'Press stake']] as const)
                : ([['amount', `${GAME_LABEL[kind]} stake`]] as const);
              return (
                <View key={kind} style={styles.card}>
                  <Text style={styles.label}>{`${GAME_LABEL[kind]} stake, Birdie Bucks (BB)`}</Text>
                  {fields.map(([key, label]) => {
                    const value = draft[key];
                    return (
                      <View key={key} style={styles.stack}>
                        <Text style={styles.label}>{label}</Text>
                        <TextInput
                          value={value}
                          onChangeText={(next) => set({ [key]: next })}
                          accessibilityLabel={kind === 'nassau' ? `${key} stake` : `${GAME_LABEL[kind]} stake`}
                          placeholder="Birdie Bucks"
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
                  {kind === 'skins' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Carry-over" onPress={() => set({ carry: !draft.carry })} style={[styles.chip, draft.carry && styles.chipOn]}>
                      <Text style={styles.chipText}>{draft.carry ? 'Carry-over on' : 'Carry-over off'}</Text>
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
            {notices.filter((line) => line !== block).map((line) => <Text key={line} style={styles.amber}>{line}</Text>)}
            <Text accessibilityLabel="Follow along" style={styles.copy}>Follow along is not in this build. This phone has no accounts, so there is no read-only link.</Text>
          </View>
        ) : null}
        {step === 'play' && save && score ? (
          <View style={styles.stack}>
            <Pressable accessibilityRole="button" accessibilityLabel="Games" onPress={() => setGamesOpen((open) => !open)} style={styles.chip}>
              <Text style={styles.chipText}>Games</Text>
            </Pressable>
            <Text style={[styles.holeNo, { fontFamily: display }]}>{String(hole)}</Text>
            <Text style={styles.meta}>{`Par ${course.holes[hole - 1]?.par ?? '—'} · Birdie Bucks`}</Text>
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
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} lower`} onPress={() => setRows((current) => tapGross(current, row.playerId, (row.gross ?? (course.holes[hole - 1]?.par ?? 4)) - 1))} style={styles.scoreTap}>
                    <Text style={styles.chipText}>−</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} higher`} onPress={() => setRows((current) => tapGross(current, row.playerId, (row.gross ?? (course.holes[hole - 1]?.par ?? 4)) + 1))} style={styles.scoreTap}>
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
                      style={styles.scoreTap}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${row.name} pickup`} onPress={() => setRows((current) => tapPickup(current, row.playerId))} style={styles.scoreTap}>
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
                      style={[styles.scoreTap, marks.wolf?.wolfId === wolfPlayer.id && marks.wolf?.mode === 'partner' && marks.wolf.partnerId === player.id && styles.chipOn]}
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
                    accessibilityHint={blindHeld ? BLIND_HOLD : undefined}
                    disabled={blindHeld}
                    onPress={() => setMarks((current) => ({ ...current, wolfSkipped: false, wolf: { mode: 'blind', wolfId: wolfPlayer.id, partnerId: null } }))}
                    style={[styles.chip, !blindHeld && marks.wolf?.mode === 'blind' && styles.chipOn, blindHeld && styles.chipOff]}
                  >
                    <Text style={styles.chipText}>Blind</Text>
                  </Pressable>
                  {blindHeld ? <Text accessibilityLabel="Blind wolf hold" style={styles.amber}>{BLIND_HOLD}</Text> : null}
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
                {cardLines.map((line) => (
                  line === heard.readback
                    ? <Text key={line} accessibilityLabel="Read-back" style={styles.copy}>{line}</Text>
                    : <Text key={line} style={styles.copy}>{line}</Text>
                ))}
              </View>
            ) : null}
            {noteLine ? <Text style={styles.amber}>{noteLine}</Text> : null}
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
            <Pressable accessibilityRole="button" accessibilityLabel="Log hole" accessibilityHint={holeReason ?? undefined} disabled={holeReason != null} onPress={logHole} style={[styles.go, holeReason != null && styles.goOff]}>
              <Text style={[styles.goText, { fontFamily: display }]}>LOG HOLE</Text>
            </Pressable>
            {holeReason ? <Text accessibilityLabel="Log hole reason" style={styles.meta}>{holeReason}</Text> : null}
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
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Finish round" accessibilityHint={playedCount === 0 ? 'Log a hole before finishing.' : undefined} disabled={playedCount === 0} onPress={() => setAskFinish(true)} style={[styles.scoreTap, playedCount === 0 && styles.chipOff]}>
                  <Text style={styles.chipText}>Finish round</Text>
                </Pressable>
                {playedCount === 0 ? <Text accessibilityLabel="Finish hold" style={styles.meta}>Log a hole before finishing.</Text> : null}
              </>
            )}
          </View>
        ) : null}
        {step === 'results' && report && score ? (
          <View style={styles.stack}>
            {score.games.some((game) => game.nets) ? (
              <Text accessibilityLabel="Takes the day" style={[styles.hero, { fontFamily: display }]}>{dayLine(report.players.map((player) => player.name), score.nets)}</Text>
            ) : null}
            {dayAmount(score.nets) ? (
              <Text accessibilityLabel="Day amount" style={[styles.hero, { fontFamily: display, color: signal.go }]}>{dayAmount(score.nets)}</Text>
            ) : null}
            {(() => {
              const points = score.games.find((game) => game.kind === 'stableford' || game.kind === 'modified');
              const line = stablefordLine(report.players.map((player) => player.name), points?.points ?? null);
              return line ? <Text accessibilityLabel="Stableford" style={styles.copy}>{line}</Text> : null;
            })()}
            <Text accessibilityLabel="Zero-sum check" style={score.zeroSumOk ? styles.copy : styles.amber}>{zeroSumLine(score)}</Text>
            <RivalryHero current={report} />
            {partialLabel(holesPlayed(report)) ? <Text style={styles.copy}>{partialLabel(holesPlayed(report))}</Text> : null}
            {score.games.map((game) => {
              const roster = report.games.find((item) => item.kind === game.kind);
              const rosterText = roster ? rosterLine(report, roster) : null;
              const names = report.players.map((player) => player.name);
              const line = gameLine(game, { names, pending: score.skinsPending, finished: true, roster: rosterText, carry: roster?.carry !== false });
              const who = winnerText(game);
              const wolfRows = game.kind === 'wolf' && game.points ? wolfPointsTable(names, game.points) : [];
              const owes = oweCombinations(names, game.nets);
              return (
                <View key={game.kind} style={styles.card}>
                  <Text style={styles.label}>{game.label}</Text>
                  {rosterText ? <Text style={styles.copy}>{rosterText}</Text> : null}
                  {who !== line ? <Text style={styles.copy}>{who}</Text> : null}
                  <Text style={styles.copy}>{line}</Text>
                  {wolfRows.length > 0 ? (
                    <View accessibilityLabel="Wolf points">
                      {wolfRows.map((row) => <Text key={row} style={styles.copy}>{row}</Text>)}
                    </View>
                  ) : null}
                  {owes.map((row) => <Text key={row} style={styles.copy}>{row}</Text>)}
                </View>
              );
            })}
            <Text accessibilityLabel="Who owes who" style={styles.label}>Who owes who</Text>
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
            <RecapCard
              save={report}
              score={score}
              showNets={showNets}
              showHandicaps={showHandicaps}
              display={display}
              cardRef={recapRef}
              accessibilityLabel="Recap card"
            />
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
      {step === 'setup' ? (
        <>
          {block ? <Text accessibilityLabel="Start round hint" style={styles.amber}>{block}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Start round" accessibilityHint={block ?? undefined} disabled={!!block} onPress={start} style={[styles.go, styles.startBar, !!block && styles.goOff]}>
            <Text style={[styles.goText, { fontFamily: display }]}>START ROUND</Text>
          </Pressable>
        </>
      ) : null}
      {listening && mic ? (
        <View accessibilityLabel="Listening" style={styles.sheet}>
          <Text style={[styles.hero, { fontFamily: display }]}>Listening</Text>
          <Text accessibilityLabel="Transcript" style={styles.copy}>{phrase || '…'}</Text>
        </View>
      ) : null}
      {gamesOpen && save ? (
        <View accessibilityLabel="Games sheet" style={styles.sheet}>
          <Text style={styles.label}>Games in this round</Text>
          {save.games.map((game) => {
            const scored = score?.games.find((item) => item.kind === game.kind);
            const roster = rosterLine(save, game);
            const state = scored
              ? gameLine(scored, {
                  names: save.players.map((player) => player.name),
                  pending: score?.skinsPending ?? 0,
                  finished: false,
                  roster,
                })
              : null;
            return (
              <Text key={game.kind} accessibilityLabel={`${game.kind} state`} style={styles.copy}>
                {`${GAME_LABEL[game.kind]}${roster ? ` · ${roster}` : ''}${state ? ` · ${state}` : ''}`}
              </Text>
            );
          })}
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
  const pick = rivalryPick(current.players, rounds);
  if (!pick) return null;
  return <Text accessibilityLabel="Head to head" style={styles.hero}>{rivalryHero(pick.a, pick.b, pick.winsA, pick.winsB)}</Text>;
}

function OnThisPhone({ current }: { current: FoursomeSave }) {
  const history = readFoursomeHistory();
  const saves = history.some((item) => item.id === current.id) ? history : [...history, current];
  const rounds = phoneRounds(saves);
  const table = seasonTable(rounds);
  if (table.length === 0) return null;
  const pick = rivalryPick(current.players, rounds);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>On this phone</Text>
      {table.map((row) => (
        <Text key={row.id} style={styles.copy}>{`${row.name} ${fmt(row.net, undefined, true)}`}</Text>
      ))}
      {pick ? <Text style={styles.copy}>{rivalryHero(pick.a, pick.b, pick.winsA, pick.winsB)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  back: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.white, fontFamily: font.family, fontSize: 16 },
  kicker: { color: colors.white, fontSize: 28, letterSpacing: 1 },
  info: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 22, backgroundColor: '#102848', alignItems: 'center', justifyContent: 'center' },
  infoText: { color: signal.go, fontFamily: font.family, fontWeight: '800' },
  scroll: { flex: 1 },
  body: { paddingBottom: 24, gap: 12 },
  startBar: { marginTop: 8 },
  scoreTap: { minWidth: 56, minHeight: 56, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rulesMark: { width: 44, height: 44, borderRadius: 22, alignSelf: 'flex-start', backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  stack: { gap: 12 },
  strip: { backgroundColor: '#102848', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 8, gap: 2, marginBottom: 8 },
  stripHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  stripToggle: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  stripNets: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  stripCell: { width: '50%', minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6 },
  stripName: { flexShrink: 1, minWidth: 0, color: colors.white, fontFamily: font.family, fontSize: 13, lineHeight: 16 },
  stripAmount: { flexShrink: 0, fontSize: 16, lineHeight: 18, fontVariant: ['tabular-nums'] },
  chevron: { color: signal.go, fontSize: 22, width: 44, textAlign: 'center' },
  stripDisclosure: { color: colors.white, fontFamily: font.family, fontSize: 11, lineHeight: 14 },
  card: { backgroundColor: '#102848', borderRadius: 16, padding: 12, gap: 8 },
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
  goOff: { backgroundColor: '#B7C4A4' },
  goText: { color: colors.navy, fontSize: 28, letterSpacing: 0.6 },
  chipOff: { backgroundColor: '#0E1A2C' },
  disclosure: { color: colors.white, fontFamily: font.family, fontSize: 13, lineHeight: 18 },
  amber: { color: signal.caution, fontFamily: font.family, fontSize: 14, lineHeight: 20 },
  holeNo: { color: colors.white, fontSize: 92, lineHeight: 92, fontVariant: ['tabular-nums'] },
  meta: { color: play.muted, fontFamily: font.family, fontSize: 13 },
  net: { fontSize: 28, fontVariant: ['tabular-nums'] },
  stripLine: { color: colors.white, fontSize: 22, lineHeight: 24 },
  gross: { color: colors.white, fontSize: 48, lineHeight: 48, fontVariant: ['tabular-nums'] },
  holeChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  holeChipText: { color: colors.white, fontSize: 16 },
  copy: { color: colors.white, fontFamily: font.family, fontSize: 16, lineHeight: 22 },
  settle: { fontSize: 28, lineHeight: 32 },
});
