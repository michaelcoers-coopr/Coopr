import { useState } from 'react';
import { ScrollView, View, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { Card, H1, H2, Body, Label, Button, Divider, Segmented } from '../src/ui';
import { getFirstUserId } from '../src/db/repo';
import {
  getActiveRound, startRound, getHoles, saveHole, finishRound, listRecentRounds,
  type HoleScore, type RoundSummary,
} from '../src/features/scorecard';

export default function Scorecard() {
  const t = useTheme();
  const userId = getFirstUserId();
  const active = userId ? getActiveRound(userId) : null;
  const [roundId, setRoundId] = useState<string | null>(active?.id ?? null);

  if (!roundId) {
    return <StartView onStart={setRoundId} />;
  }
  return <PlayView roundId={roundId} onFinish={() => setRoundId(null)} />;
}

function StartView({ onStart }: { onStart: (id: string) => void }) {
  const t = useTheme();
  const userId = getFirstUserId();
  const [course, setCourse] = useState('');
  const [holes, setHoles] = useState('18');
  const recent = userId ? listRecentRounds(userId) : [];

  const start = () => {
    if (!userId) return;
    onStart(startRound(userId, course, holes === '9' ? 9 : 18));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }} keyboardShouldPersistTaps="handled">
        <Label>Scorecard</Label>
        <H1>Start a round</H1>
        <Card>
          <Label>Course (optional)</Label>
          <TextInput
            value={course}
            onChangeText={setCourse}
            placeholder="Course name"
            placeholderTextColor={t.textMuted}
            style={{
              color: t.textPrimary, backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
              borderRadius: t.radius.sm, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
              fontSize: t.fontSize.md, marginVertical: t.spacing.xs,
            }}
          />
          <Label>Holes</Label>
          <Segmented options={[{ value: '18', label: '18' }, { value: '9', label: '9' }]} value={holes} onChange={setHoles} />
          <View style={{ height: t.spacing.sm }} />
          <Button title="Start round" onPress={start} />
        </Card>

        {recent.length > 0 ? (
          <Card>
            <Label>Recent rounds</Label>
            <Divider />
            {recent.map((r) => <RoundRow key={r.id} r={r} />)}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundRow({ r }: { r: RoundSummary }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: t.spacing.xs }}>
      <View>
        <Body>{r.courseName ?? 'Round'}</Body>
        <Body muted style={{ fontSize: t.fontSize.xs }}>
          {new Date(r.date).toISOString().slice(0, 10)} · {r.holesPlayed}/{r.holes} holes · {r.status}
        </Body>
      </View>
      <H2>{r.holesPlayed > 0 ? `${r.totalStrokes} (${fmtToPar(r.toPar)})` : '—'}</H2>
    </View>
  );
}

function PlayView({ roundId, onFinish }: { roundId: string; onFinish: () => void }) {
  const t = useTheme();
  const [holes, setHoles] = useState<HoleScore[]>(() => getHoles(roundId));
  const [idx, setIdx] = useState(0);
  const cur = holes[idx];

  const played = holes.filter((h) => h.strokes != null);
  const toPar = played.reduce((a, h) => a + ((h.strokes ?? 0) - h.par), 0);
  const totalStrokes = played.reduce((a, h) => a + (h.strokes ?? 0), 0);

  const update = (patch: Partial<HoleScore>) => {
    setHoles((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
    saveHole(roundId, cur!.hole, patch);
  };

  const finish = () => {
    finishRound(roundId);
    Alert.alert('Round saved', `${totalStrokes} strokes · ${fmtToPar(toPar)} through ${played.length} holes.`, [
      { text: 'Done', onPress: onFinish },
    ]);
  };

  if (!cur) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
        <View style={{ padding: t.spacing.lg }}><Body muted>No holes.</Body></View>
      </SafeAreaView>
    );
  }

  const shownStrokes = cur.strokes ?? cur.par;
  const shownPutts = cur.putts ?? 0;
  const isPar3 = cur.par === 3;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.ink }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>Hole {cur.hole} of {holes.length}</Label>
          <Body style={{ fontWeight: '700', color: toPar > 0 ? t.semantic.overPar : toPar < 0 ? t.semantic.underPar : t.textSecondary }}>
            {fmtToPar(toPar)} thru {played.length}
          </Body>
        </View>

        <Card>
          <Label>Par</Label>
          <Segmented
            options={[{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }]}
            value={String(cur.par)}
            onChange={(v) => update({ par: Number(v) })}
          />

          <Label>Score</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl, marginVertical: t.spacing.sm }}>
            <Stepper label="–" onPress={() => update({ strokes: clamp(shownStrokes - 1) })} />
            <View style={{ alignItems: 'center', width: 90 }}>
              <Body style={{ fontSize: 56, fontWeight: '800', color: cur.strokes == null ? t.textMuted : t.textPrimary }}>{shownStrokes}</Body>
              <Body muted style={{ fontSize: t.fontSize.xs }}>{cur.strokes == null ? 'tap to score' : scoreName(shownStrokes - cur.par)}</Body>
            </View>
            <Stepper label="+" onPress={() => update({ strokes: clamp(shownStrokes + 1) })} />
          </View>

          <Divider />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Putts</Label>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Stepper small label="–" onPress={() => update({ putts: Math.max(0, shownPutts - 1) })} />
              <Body style={{ fontWeight: '700', width: 24, textAlign: 'center' }}>{cur.putts == null ? '—' : shownPutts}</Body>
              <Stepper small label="+" onPress={() => update({ putts: shownPutts + 1 })} />
            </View>
          </View>

          {!isPar3 ? (
            <>
              <Label>Fairway</Label>
              <Segmented
                options={[{ value: 'hit', label: 'Hit' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
                value={cur.fairway ?? ''}
                onChange={(v) => update({ fairway: v })}
              />
            </>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: t.spacing.sm }}>
            <Body onPress={() => update({ gir: cur.gir ? 0 : 1 })} style={{ color: cur.gir ? t.accent : t.textSecondary }}>
              {cur.gir ? '☑' : '☐'} Green in regulation
            </Body>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Prev" kind="ghost" onPress={() => setIdx((i) => Math.max(0, i - 1))} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={idx < holes.length - 1 ? 'Next' : 'Last hole'}
              onPress={() => setIdx((i) => Math.min(holes.length - 1, i + 1))}
            />
          </View>
        </View>
        <Button title="Finish round" kind="ghost" onPress={finish} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  const t = useTheme();
  const size = small ? 34 : 56;
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: size, height: size, borderRadius: size / 2, borderColor: t.accent, borderWidth: 1.5,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Body style={{ color: t.accent, fontSize: small ? 20 : 28, fontWeight: '700' }}>{label}</Body>
    </Pressable>
  );
}

function clamp(n: number): number {
  return Math.min(15, Math.max(1, n));
}
function fmtToPar(n: number): string {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`;
}
function scoreName(delta: number): string {
  if (delta <= -3) return 'albatross';
  if (delta === -2) return 'eagle';
  if (delta === -1) return 'birdie';
  if (delta === 0) return 'par';
  if (delta === 1) return 'bogey';
  if (delta === 2) return 'double';
  return `+${delta}`;
}
