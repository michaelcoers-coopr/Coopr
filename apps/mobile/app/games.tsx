import { useEffect, useMemo, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmt, gamesForCount, headToHead, seasonTable, wolfOnHole, type GameKind } from '@coopr/games';
import { colors, font, play, signal } from '@coopr/tokens';
import { useDisplayFace } from '../src/design/display-font';
import { highCedarsHoles } from '../src/games/card';
import {
  DISCLOSURE,
  FOOTER,
  SI_AMBER,
  acceptRow,
  applyPhrase,
  blankEntry,
  blankPlayer,
  buildSave,
  commitHole,
  emptyStake,
  liveScore,
  logReady,
  playerHandicap,
  recapFor,
  rowsFromHole,
  setupBlock,
  speechHints,
  tapGross,
  tapPickup,
  type EntryRow,
  type SetupPlayer,
  type StakeDraft,
} from '../src/games/present';
import { finishOpenFoursome, readFoursomeHistory, readOpenFoursome, writeOpenFoursome } from '../src/games/store';
import type { FoursomeHole, FoursomeSave } from '@coopr/games';

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

function freshPlayers(): SetupPlayer[] {
  const a = blankPlayer(`p-${Date.now().toString(36)}-a`);
  const b = blankPlayer(`p-${Date.now().toString(36)}-b`);
  return [a, b];
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
  const [grossOnly, setGrossOnly] = useState(false);
  const [hole, setHole] = useState(1);
  const [rows, setRows] = useState<EntryRow[]>(() => (readOpenFoursome() ? rowsFromHole(readOpenFoursome()!, 1) : []));
  const [phrase, setPhrase] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [wolf, setWolf] = useState<FoursomeHole['wolf']>(null);
  const [info, setInfo] = useState(false);
  const [listening, setListening] = useState(false);
  const [mic, setMic] = useState(false);
  useEffect(() => {
    void import('../src/speech/recognize').then(({ deviceSpeechAvailable }) => deviceSpeechAvailable().then(setMic));
  }, []);
  const active = report ?? save;
  const score = active ? liveScore(active) : null;
  const block = setupBlock(players, kinds, course.siOk, grossOnly);
  const offered = gamesForCount(players.filter((player) => player.name.trim()).length || 2);

  const openHole = (next: number, current = save) => {
    const number = Math.min(18, Math.max(1, next));
    setHole(number);
    setRows(current ? rowsFromHole(current, number) : []);
    setWolf(current?.holes.find((item) => item.number === number)?.wolf ?? null);
    setNote(null);
    setPhrase('');
  };

  const start = () => {
    const built = buildSave({
      id: `foursome-${Date.now()}`,
      players,
      ownerId: ownerId || players.find((player) => player.name.trim())?.id || '',
      kinds,
      stakes,
      grossOnly,
      siOk: course.siOk,
      card: course.holes,
    });
    if (!built) return;
    writeOpenFoursome(built);
    setSave(built);
    setReport(null);
    setStep('play');
    openHole(1, built);
  };

  const logHole = () => {
    if (!save || !logReady(rows)) return;
    const next = commitHole(save, hole, rows, wolf);
    writeOpenFoursome(next);
    setSave(next);
    if (hole < 18) openHole(hole + 1, next);
  };

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
    const applied = applyPhrase(rows, phrase, save, card);
    if (applied.command === 'skip_hole') {
      if (hole < 18) openHole(hole + 1);
      return;
    }
    if (applied.command === 'undo') {
      openHole(hole - 1);
      return;
    }
    setRows(applied.rows);
    setNote(applied.note);
    if (applied.wolf) setWolf(applied.wolf);
  };

  const finish = () => {
    if (!save) return;
    finishOpenFoursome(save, course.yards);
    setReport({ ...save, finishedOn: save.finishedOn ?? new Date().toISOString() });
    setSave(null);
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

  const wolfName = (() => {
    if (!save || !save.games.some((game) => game.kind === 'wolf') || save.players.length !== 4) return null;
    const points = score?.games.find((game) => game.kind === 'wolf')?.points ?? [0, 0, 0, 0];
    const index = wolfOnHole(hole, points, [0, 1, 2, 3]);
    return save.players[index]?.name ?? null;
  })();

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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 'setup' ? (
          <View style={styles.stack}>
            <Text style={styles.disclosure}>{DISCLOSURE}</Text>
            {!course.siOk ? <Text style={styles.amber}>{SI_AMBER}</Text> : null}
            {players.map((player, index) => (
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
                <TextInput
                  value={player.handicapText}
                  onChangeText={(handicapText) =>
                    setPlayers((current) => current.map((item) => (item.id === player.id ? { ...item, handicapText, scratch: false } : item)))
                  }
                  accessibilityLabel={`${player.name || `Player ${index + 1}`} course handicap`}
                  placeholder="Course handicap"
                  placeholderTextColor={play.muted}
                  keyboardType="numbers-and-punctuation"
                  style={styles.input}
                />
                {player.name.trim() && playerHandicap(player) == null ? <Text style={styles.amber}>{`Enter ${player.name.trim()}'s course handicap, or play him scratch (0).`}</Text> : null}
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
            ))}
            <View style={styles.row}>
              {players.length < 4 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Add player" onPress={() => setPlayers((current) => [...current, blankPlayer(`p-${Date.now().toString(36)}`)])} style={styles.chip}>
                  <Text style={styles.chipText}>Add player</Text>
                </Pressable>
              ) : null}
              {players.length > 2 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Remove last player" onPress={() => setPlayers((current) => current.slice(0, -1))} style={styles.chip}>
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
                  style={[styles.chip, kinds.includes(kind) && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{GAME_LABEL[kind]}</Text>
                </Pressable>
              ))}
            </View>
            {kinds.map((kind) => {
              const draft = stakes[kind] ?? emptyStake();
              const set = (patch: Partial<StakeDraft>) => setStakes((current) => ({ ...current, [kind]: { ...draft, ...patch } }));
              return (
                <View key={kind} style={styles.card}>
                  <Text style={styles.label}>{`${GAME_LABEL[kind]} stake, BB`}</Text>
                  {kind === 'nassau' ? (
                    <View style={styles.stack}>
                      {(['front', 'back', 'total', 'press'] as const).map((leg) => (
                        <TextInput
                          key={leg}
                          value={draft[leg]}
                          onChangeText={(value) => set({ [leg]: value })}
                          accessibilityLabel={`${leg} stake`}
                          placeholder={`${leg} BB`}
                          placeholderTextColor={play.muted}
                          keyboardType="decimal-pad"
                          style={styles.input}
                        />
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      value={draft.amount}
                      onChangeText={(amount) => set({ amount })}
                      accessibilityLabel={`${GAME_LABEL[kind]} stake`}
                      placeholder="Empty until you enter it"
                      placeholderTextColor={play.muted}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  )}
                  {kind === 'stableford' || kind === 'modified' ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Pot or per point" onPress={() => set({ pot: !draft.pot })} style={styles.chip}>
                      <Text style={styles.chipText}>{draft.pot ? 'Pot' : 'Per point'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="Gross only" onPress={() => setGrossOnly((value) => !value)} style={[styles.chip, grossOnly && styles.chipOn]}>
              <Text style={styles.chipText}>{grossOnly ? 'Gross only' : 'Net scores'}</Text>
            </Pressable>
            {block ? <Text style={styles.amber}>{block}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Start round" disabled={!!block} onPress={start} style={[styles.go, !!block && styles.disabled]}>
              <Text style={[styles.goText, { fontFamily: display }]}>START ROUND</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 'play' && save && score ? (
          <View style={styles.stack}>
            <Text style={[styles.holeNo, { fontFamily: display }]}>{String(hole)}</Text>
            <Text style={styles.meta}>{`Par ${course.holes[hole - 1]?.par ?? '—'} · BB`}</Text>
            <View style={styles.row}>
              {score.zeroSumOk
                ? save.players.map((player, index) => (
                    <View key={player.id} style={styles.netCell}>
                      <Text style={styles.meta}>{player.name}</Text>
                      <Text style={[styles.net, { fontFamily: display, color: (score.nets[index] ?? 0) < 0 ? colors.red : colors.white }]}>
                        {fmt(score.nets[index] ?? 0, undefined, true)}
                      </Text>
                    </View>
                  ))
                : <Text style={styles.amber}>{score.note}</Text>}
            </View>
            <Text style={styles.meta}>{score.games.find((game) => game.kind === 'skins')?.line ?? score.games[0]?.line}</Text>
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
                    <Pressable accessibilityRole="button" accessibilityLabel={`Confirm ${row.name}`} onPress={() => setRows((current) => acceptRow(current, row.playerId))} style={styles.chipOn}>
                      <Text style={styles.chipText}>Confirm</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
            {wolfName ? (
              <View style={styles.card}>
                <Text style={styles.label}>{`${wolfName} is the wolf`}</Text>
                <View style={styles.row}>
                  {save.players.filter((player) => player.name !== wolfName).map((player) => (
                    <Pressable
                      key={player.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${wolfName} takes ${player.name}`}
                      onPress={() => {
                        const wolfId = save.players.find((item) => item.name === wolfName)?.id
                        if (wolfId) setWolf({ mode: 'partner', wolfId, partnerId: player.id })
                      }}
                      style={[styles.chip, wolf?.partnerId === player.id && styles.chipOn]}
                    >
                      <Text style={styles.chipText}>{player.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel="Lone wolf" onPress={() => {
                    const wolfId = save.players.find((item) => item.name === wolfName)?.id
                    if (wolfId) setWolf({ mode: 'lone', wolfId, partnerId: null })
                  }} style={[styles.chip, wolf?.mode === 'lone' && styles.chipOn]}>
                    <Text style={styles.chipText}>Lone</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Blind wolf"
                    disabled={rows.some((row) => row.gross != null || row.pickup)}
                    onPress={() => {
                      const wolfId = save.players.find((item) => item.name === wolfName)?.id
                      if (wolfId) setWolf({ mode: 'blind', wolfId, partnerId: null })
                    }}
                    style={[styles.chip, wolf?.mode === 'blind' && styles.chipOn]}
                  >
                    <Text style={styles.chipText}>Blind</Text>
                  </Pressable>
                </View>
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
            <Pressable accessibilityRole="button" accessibilityLabel="Log hole" disabled={!logReady(rows)} onPress={logHole} style={[styles.go, !logReady(rows) && styles.disabled]}>
              <Text style={[styles.goText, { fontFamily: display }]}>LOG HOLE</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Finish round" onPress={finish} style={styles.chip}>
              <Text style={styles.chipText}>Finish round</Text>
            </Pressable>
          </View>
        ) : null}
        {step === 'results' && report && score ? (
          <View style={styles.stack}>
            <Text style={styles.disclosure}>{DISCLOSURE}</Text>
            {score.games.map((game) => (
              <View key={game.kind} style={styles.card}>
                <Text style={styles.label}>{game.label}</Text>
                <Text style={styles.copy}>{game.winners.length ? game.winners.join(' and ') : 'No winner yet'}</Text>
                <Text style={styles.copy}>{game.line}</Text>
              </View>
            ))}
            {score.note ? <Text style={styles.amber}>{score.note}</Text> : null}
            {score.settle.map((line) => (
              <Text key={line.line} style={[styles.settle, { fontFamily: display }]}>{line.line}</Text>
            ))}
            {score.settle.length === 0 && score.zeroSumOk ? <Text style={styles.copy}>Squared.</Text> : null}
            <Text style={styles.copy}>{FOOTER}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Share recap" onPress={() => void share()} style={styles.go}>
              <Text style={[styles.goText, { fontFamily: display }]}>SHARE RECAP</Text>
            </Pressable>
            <OnThisPhone current={report} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function OnThisPhone({ current }: { current: FoursomeSave }) {
  const history = readFoursomeHistory();
  const saves = history.some((item) => item.id === current.id) ? history : [...history, current];
  const rounds = saves.flatMap((item) => {
    const scored = liveScore(item);
    if (!scored.zeroSumOk) return [];
    return [{ id: item.id, players: item.players.map((player) => ({ id: player.id, name: player.name })), nets: scored.nets }];
  });
  const table = seasonTable(rounds);
  if (table.length === 0) return null;
  const [a, b] = current.players;
  const rivalry = a && b ? headToHead(rounds, a.id, b.id) : null;
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
  body: { paddingBottom: 32, gap: 12 },
  stack: { gap: 12 },
  card: { backgroundColor: '#102848', borderRadius: 16, padding: 12, gap: 8 },
  amberCard: { borderWidth: 1, borderColor: signal.caution },
  label: { color: play.muted, fontFamily: font.family, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  input: { color: colors.white, fontFamily: font.family, fontSize: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', minHeight: 44 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#14301F', borderWidth: 2, borderColor: signal.go },
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
  holeChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#173154', alignItems: 'center', justifyContent: 'center' },
  holeChipText: { color: colors.white, fontSize: 18 },
  copy: { color: colors.white, fontFamily: font.family, fontSize: 16, lineHeight: 22 },
  settle: { color: colors.white, fontSize: 28, lineHeight: 32 },
});
