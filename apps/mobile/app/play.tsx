import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { DistanceMetric, GeometryVerification, LatLon } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import {
  displayToYards,
  formatDistance,
  layupDecision,
  recommend,
  resolveHolePlay,
  unitLabel,
  type DistanceProfile,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { readDevicePosition } from '../src/device-position';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { Button, Card, Choice, Muted, Screen } from '../src/ui';

const pilot = loadHighCedarsPilot();
const RESULTS: { id: LandingResult; label: string }[] = [
  { id: 'fairway', label: 'Fairway' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'short', label: 'Short' },
  { id: 'hazard', label: 'Hazard' },
];

function verificationFor(decision: 'verified' | 'rejected' | undefined): GeometryVerification {
  if (decision === 'verified') return 'admin_verified';
  if (decision === 'rejected') return 'admin_rejected';
  return 'unverified';
}

function carryProfile(profiles: readonly DistanceProfile[], clubId: string | null, swingMode: string | null): DistanceProfile | null {
  if (!clubId) return null;
  const rows = profiles.filter((profile) => profile.clubId === clubId && profile.metric === 'carry');
  return rows.find((profile) => profile.blended) ?? rows.find((profile) => profile.swingMode === (swingMode ?? 'unknown')) ?? rows[0] ?? null;
}

export default function PlayScreen() {
  const {
    clubs,
    profiles,
    unit,
    setUnit,
    currentHole,
    setCurrentHole,
    manualYards,
    setManualYards,
    holes,
    setStrokes,
    courseReviews,
    setCourseReview,
    founderTools,
    tagShot,
    tagged,
  } = useLocalStore();
  const hole = pilot.quality.find((item) => item.holeNumber === currentHole);
  const [metric, setMetric] = useState<DistanceMetric>('total');
  const [draft, setDraft] = useState('');
  const [carryLine, setCarryLine] = useState('');
  const [measuredCarry, setMeasuredCarry] = useState('');
  const [measuredTotal, setMeasuredTotal] = useState('');
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [tagNote, setTagNote] = useState('Tap a club, then where it finished.');
  const [player, setPlayer] = useState<LatLon | null>(null);
  const [gpsLine, setGpsLine] = useState<string | null>(null);

  useEffect(() => {
    setDraft('');
    setCarryLine('');
    setMeasuredCarry('');
    setMeasuredTotal('');
    setSelectedClubId(null);
  }, [currentHole, unit]);

  if (!hole) {
    return (
      <Screen>
        <Muted>That hole is not on the High Cedars card.</Muted>
      </Screen>
    );
  }

  const decision = courseReviews[hole.holeNumber];
  const verification = verificationFor(decision);
  const green = pilot.features.find((feature) => feature.kind === 'green' && feature.osmId === hole.greenOsmId);
  const play = resolveHolePlay({
    verification,
    player,
    greenRing: green?.rings[0] ?? null,
    manualDistanceYards: manualYards[hole.holeNumber] ?? null,
    attribution: pilot.attribution,
  });
  const typed = manualYards[hole.holeNumber] ?? null;
  const gpsCenter = play.mode === 'gps' ? play.centerYards : null;
  const playingYards = typed ?? gpsCenter;
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const card =
    playingYards == null
      ? null
      : recommend({
          targetDistanceYards: playingYards,
          targetMetric: metric,
          hazards: [],
          intent: 'neutral',
          riskPreference: 'neutral',
          profiles,
          candidateClubIds: inPlay.length > 0 ? inPlay.map((club) => club.id) : undefined,
          personality: 'direct_analytical',
        });
  const carryToClearRaw = carryLine.trim() === '' ? null : Number(carryLine);
  const carryToClear = carryToClearRaw != null && Number.isFinite(carryToClearRaw) ? displayToYards(carryToClearRaw, unit) : null;
  const layup = layupDecision({
    carry: carryProfile(profiles, card?.clubId ?? null, card?.swingMode ?? null),
    carryToClearYards: carryToClear,
  });
  const strokes = holes[hole.holeNumber - 1] ?? null;
  const selected = inPlay.find((club) => club.id === selectedClubId) ?? null;
  const holeTags = tagged.filter((shot) => shot.hole === hole.holeNumber);

  const saveTyped = () => {
    if (draft.trim() === '') {
      setManualYards(hole.holeNumber, null);
      return;
    }
    const value = Number(draft);
    if (!Number.isFinite(value)) return;
    setManualYards(hole.holeNumber, displayToYards(value, unit));
  };

  const commitTag = (result: LandingResult) => {
    if (!selected) {
      setTagNote('Tap a club first.');
      return;
    }
    const carry = measuredCarry.trim() === '' ? null : Number(measuredCarry);
    const total = measuredTotal.trim() === '' ? null : Number(measuredTotal);
    if ((carry != null && !Number.isFinite(carry)) || (total != null && !Number.isFinite(total))) {
      setTagNote('Measured carry and total need to be numbers, or left blank.');
      return;
    }
    const modes = [...new Set(profiles.filter((profile) => profile.clubId === selected.id && !profile.blended).map((profile) => profile.swingMode))];
    const swingMode = modes.length === 1 ? (modes[0] ?? 'unknown') : 'unknown';
    tagShot({
      hole: hole.holeNumber,
      clubId: selected.id,
      clubLabel: selected.label,
      result,
      shownYards: playingYards,
      carry: carry == null ? null : displayToYards(carry, unit),
      total: total == null ? null : displayToYards(total, unit),
      swingMode,
    });
    setSelectedClubId(null);
    setMeasuredCarry('');
    setMeasuredTotal('');
    const swingNote =
      carry == null && total == null
        ? 'No measured carry or total was entered, so the distance model is unchanged.'
        : swingMode === 'unknown'
          ? 'More than one swing is on file, so this result stays on its own and is not blended.'
          : `Measured numbers are stored as the ${swingMode} swing and can blend with that sample.`;
    setTagNote(`${selected.label} tagged ${result}. The on-screen yardage was not saved as the shot. ${swingNote}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Hole ${hole.holeNumber}` }} />
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{`Par ${hole.par ?? '—'}`}</Text>
        <Text style={styles.meta}>{`SI ${hole.strokeIndex ?? '—'}`}</Text>
        <Text style={styles.meta}>{`Card ${formatDistance(hole.yardagesByTee.white ?? null, unit)} ${unit}`}</Text>
      </View>
      <Text style={styles.hero}>{formatDistance(playingYards, unit)}</Text>
      <Text style={styles.heroUnit}>{playingYards == null ? `Type the ${unitLabel(unit)}` : unitLabel(unit)}</Text>
      <View style={styles.ends}>
        <View style={styles.end}>
          <Text style={styles.endLabel}>Front</Text>
          <Text style={styles.endValue}>{formatDistance(play.frontYards, unit)}</Text>
        </View>
        <View style={styles.end}>
          <Text style={styles.endLabel}>Back</Text>
          <Text style={styles.endValue}>{formatDistance(play.backYards, unit)}</Text>
        </View>
      </View>
      <Muted>
        {play.mode === 'gps'
          ? 'Ground distance to the verified green. Not a shot. Not a carry.'
          : 'Green is not verified, or this phone has no position. Front and back stay blank. The big number is what you type.'}
      </Muted>
      <Text style={styles.cardNote}>{`White tee card ${hole.yardagesByTee.white ?? '—'} yards. Scorecard metadata, not a GPS measurement.`}</Text>
      <View style={styles.row}>
        <Choice label="Yards" selected={unit === 'yd'} onPress={() => setUnit('yd')} />
        <Choice label="Meters" selected={unit === 'm'} onPress={() => setUnit('m')} />
        <Choice label="Total" selected={metric === 'total'} onPress={() => setMetric('total')} />
        <Choice label="Carry" selected={metric === 'carry'} onPress={() => setMetric('carry')} />
      </View>
      {playingYards != null ? (
        <Muted>{`The club call treats ${formatDistance(playingYards, unit)} ${unitLabel(unit)} as a ${metric}. Carry and total are not substituted for each other.`}</Muted>
      ) : null}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onEndEditing={saveTyped}
        placeholder={`Playing ${unitLabel(unit)}`}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Playing distance"
      />
      <Button label="Use this distance" onPress={saveTyped} />
      <Card warning={layup.call === 'lay_up'}>
        <Text style={styles.club}>{card?.clubLabel ?? 'No club yet'}</Text>
        <Muted>
          {card
            ? card.lines.reason
            : 'Enter a distance before asking for a club. Nothing is filled in for you.'}
        </Muted>
        {card?.lines.instruction ? <Muted>{card.lines.instruction}</Muted> : null}
        {card?.expectedCarry || card?.expectedTotal ? (
          <Muted>
            {`Carry median ${card.expectedCarry ? formatDistance(card.expectedCarry.p50, unit) : 'unknown'} ${unit}. Total median ${card.expectedTotal ? formatDistance(card.expectedTotal.p50, unit) : 'unknown'} ${unit}.`}
          </Muted>
        ) : null}
        <Text style={[styles.layup, layup.call === 'lay_up' && styles.layupWarn]}>{layup.reason}</Text>
      </Card>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Strokes</Text>
        <Choice label="−" selected={false} onPress={() => setStrokes(hole.holeNumber, strokes == null || strokes <= 1 ? null : strokes - 1)} />
        <Text style={styles.scoreValue}>{strokes ?? '—'}</Text>
        <Choice label="+" selected={false} onPress={() => setStrokes(hole.holeNumber, (strokes ?? 0) + 1)} />
      </View>
      <TextInput
        value={carryLine}
        onChangeText={setCarryLine}
        placeholder={`Carry to clear, ${unitLabel(unit)}, if you know it`}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <Muted>
        {hole.bunkersIntersecting === 0 && hole.hazardsIntersecting === 0
          ? 'No bunker or water hazard is tagged to this hole. A missing tag is not proof the hole is clear.'
          : `${hole.bunkersIntersecting} bunker and ${hole.hazardsIntersecting} water-hazard polygons meet this hole and are not tagged to it.`}
      </Muted>
      <Text style={styles.section}>Tag the shot</Text>
      <Muted>{tagNote}</Muted>
      <View style={styles.wrap}>
        {inPlay.map((club) => (
          <Choice
            key={club.id}
            label={club.label.split('·')[0]?.trim() || club.label}
            selected={club.id === selectedClubId}
            onPress={() => setSelectedClubId(club.id)}
          />
        ))}
      </View>
      {inPlay.length === 0 ? <Muted>The bag is empty. Add a club or import a CSV first.</Muted> : null}
      <View style={styles.wrap}>
        {RESULTS.map((result) => (
          <Choice key={result.id} label={result.label} selected={false} onPress={() => commitTag(result.id)} />
        ))}
      </View>
      <Muted>Optional measured result. Leave a box blank. The GPS or typed playing number is not copied.</Muted>
      <View style={styles.row}>
        <TextInput value={measuredCarry} onChangeText={setMeasuredCarry} placeholder="Carry" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} />
        <TextInput value={measuredTotal} onChangeText={setMeasuredTotal} placeholder="Total" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} />
      </View>
      {holeTags.map((shot) => (
        <Muted key={shot.id}>{`${shot.clubLabel.split('·')[0]?.trim()} · ${shot.result} · shown ${formatDistance(shot.shownYards, unit)} ${unit}`}</Muted>
      ))}
      <View style={styles.row}>
        <View style={styles.half}>
          <Button label="Previous" tone="ghost" onPress={() => setCurrentHole(hole.holeNumber - 1)} />
        </View>
        <View style={styles.half}>
          <Button label="Next hole" onPress={() => setCurrentHole(hole.holeNumber + 1)} />
        </View>
      </View>
      {founderTools ? (
        <View style={styles.row}>
          <View style={styles.half}>
            <Button label="Verify green" tone="ghost" onPress={() => setCourseReview(hole.holeNumber, 'verified')} />
          </View>
          <View style={styles.half}>
            <Button label="Reject green" tone="ghost" onPress={() => { setCourseReview(hole.holeNumber, 'rejected'); setPlayer(null); }} />
          </View>
        </View>
      ) : null}
      {verification === 'admin_verified' ? (
        <Button
          label="Measure from this phone"
          onPress={() => {
            void readDevicePosition().then((position) => {
              if (!position) {
                setPlayer(null);
                setGpsLine('Location is unavailable. Use the typed distance.');
                return;
              }
              setPlayer(position);
              setGpsLine(null);
            });
          }}
        />
      ) : null}
      {gpsLine ? <Muted>{gpsLine}</Muted> : null}
      <Muted>{pilot.attribution}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  hero: { color: colors.navy, fontSize: 72, fontWeight: '800', textAlign: 'center', letterSpacing: -2, lineHeight: 80 },
  heroUnit: { color: colors.muted, fontSize: 18, textAlign: 'center', marginTop: -8 },
  ends: { flexDirection: 'row', gap: 12 },
  end: { flex: 1, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, alignItems: 'center' },
  endLabel: { color: colors.muted, fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  endValue: { color: colors.navy, fontSize: 32, fontWeight: '800' },
  cardNote: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    fontSize: 20,
  },
  half: { flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreLabel: { color: colors.navy, fontSize: 20, fontWeight: '800', width: 92 },
  scoreValue: { color: colors.navy, fontSize: 36, fontWeight: '800', width: 56, textAlign: 'center' },
  club: { color: colors.navy, fontSize: 32, fontWeight: '800' },
  layup: { color: colors.navy, fontSize: 18, lineHeight: 26 },
  layupWarn: { color: colors.red, fontWeight: '800' },
  section: { color: colors.navy, fontSize: 22, fontWeight: '800' },
});
