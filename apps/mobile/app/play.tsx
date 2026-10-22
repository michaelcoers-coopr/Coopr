import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DistanceMetric, GeometryVerification, LatLon, MapFeature } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import {
  destinationPoint,
  dispersionShape,
  displayToYards,
  distanceYards,
  formatDistance,
  holeOverlay,
  layupDecision,
  missReport,
  playsLike,
  recommend,
  resolveHolePlay,
  ringCentroid,
  shotBearing,
  unitLabel,
  type DistanceProfile,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { readDevicePosition } from '../src/device-position';
import { HoleMap } from '../src/hole-map';
import { pulse } from '../src/haptics';
import { readWeather } from '../src/weather';
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

function ringsOf(features: readonly MapFeature[]): LatLon[][] {
  return features.flatMap((feature) => feature.rings.filter((ring) => ring.length >= 3).map((ring) => [...ring]));
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
    personality,
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
  const [measure, setMeasure] = useState<LatLon[]>([]);
  const [windChoice, setWindChoice] = useState<'head' | 'tail' | 'cross' | null>(null);
  const [windDraft, setWindDraft] = useState('');
  const [elevationDraft, setElevationDraft] = useState('');
  const [elevationChoice, setElevationChoice] = useState<'up' | 'down' | null>(null);
  const [temperatureDraft, setTemperatureDraft] = useState('');
  const [weatherNote, setWeatherNote] = useState('Weather has not been read. Type it, or leave a field blank.');
  const [usePlaysLike, setUsePlaysLike] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setDraft('');
    setCarryLine('');
    setMeasuredCarry('');
    setMeasuredTotal('');
    setSelectedClubId(null);
    setMeasure([]);
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [currentHole, unit, fade]);

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
  const overlay = holeOverlay(pilot.features, pilot.record.scorecard, hole.holeNumber);
  const windSpeed = windDraft.trim() === '' ? null : Number(windDraft);
  const headwind =
    windSpeed == null || !Number.isFinite(windSpeed)
      ? null
      : windChoice === 'tail'
        ? -Math.abs(windSpeed)
        : windChoice === 'cross'
          ? 0
          : windChoice === 'head'
            ? Math.abs(windSpeed)
            : null;
  const elevationMagnitude = elevationDraft.trim() === '' ? null : Number(elevationDraft);
  const elevationFeet =
    elevationMagnitude == null || !Number.isFinite(elevationMagnitude) || elevationChoice == null
      ? null
      : elevationChoice === 'down'
        ? -Math.abs(elevationMagnitude)
        : Math.abs(elevationMagnitude);
  const temperatureF = temperatureDraft.trim() === '' ? null : Number(temperatureDraft);
  const adjustment =
    playingYards == null
      ? null
      : playsLike({
          rawYards: playingYards,
          headwindMph: headwind,
          elevationFeet: elevationFeet != null && Number.isFinite(elevationFeet) ? elevationFeet : null,
          temperatureF: temperatureF != null && Number.isFinite(temperatureF) ? temperatureF : null,
        });
  const playsLikeYards = adjustment && !('error' in adjustment) ? adjustment.playsLikeYards : null;
  const callYards = usePlaysLike && playsLikeYards != null ? playsLikeYards : playingYards;
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const card =
    callYards == null
      ? null
      : recommend({
          targetDistanceYards: callYards,
          targetMetric: metric,
          hazards: [],
          intent: 'neutral',
          riskPreference: 'neutral',
          profiles,
          candidateClubIds: inPlay.length > 0 ? inPlay.map((club) => club.id) : undefined,
          personality,
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
  const misses = missReport(
    holeTags.map((shot) => ({
      side: shot.result,
      sideYards: null,
    })),
  );
  const carryShape = metric === 'carry' ? dispersionShape(carryProfile(profiles, card?.clubId ?? null, card?.swingMode ?? null)) : null;
  const bearing = shotBearing(overlay.line);
  const dispersionLine =
    carryShape && bearing != null && overlay.line[0] && carryShape.alongYards > 0
      ? [
          destinationPoint(destinationPoint(overlay.line[0], bearing, carryShape.centerYards), bearing + 180, carryShape.alongYards),
          destinationPoint(destinationPoint(overlay.line[0], bearing, carryShape.centerYards), bearing, carryShape.alongYards),
        ]
      : [];
  const measureYards = measure.length === 2 ? distanceYards(measure[0]!, measure[1]!) : null;
  const greenCenter = overlay.green?.rings[0] ? ringCentroid(overlay.green.rings[0]) : null;

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
      <ClubPulse clubLabel={card?.clubLabel ?? null} call={layup.call} yards={playingYards} />
      <Stack.Screen options={{ title: `Hole ${hole.holeNumber}` }} />
      <HoleMap
        line={overlay.line}
        fairways={ringsOf(overlay.fairways)}
        green={overlay.green ? ringsOf([overlay.green]) : []}
        bunkers={ringsOf(overlay.bunkers)}
        hazards={ringsOf(overlay.hazards)}
        ellipse={null}
        dispersionLine={dispersionLine}
        measure={measure}
        onTap={(point) => setMeasure((current) => (current.length >= 2 ? [point] : [...current, point]))}
        rawLabel={formatDistance(playingYards, unit)}
        playsLabel={playsLikeYards == null ? '—' : formatDistance(playsLikeYards, unit)}
      />
      <Muted>
        {measureYards == null
          ? 'Tap two points for a map distance. It is not saved as a shot or a carry.'
          : `Map distance ${formatDistance(measureYards, unit)} ${unitLabel(unit)}. Not a shot. Not a carry.`}
      </Muted>
      <Muted>
        {overlay.green
          ? 'OpenStreetMap shapes on the satellite photo. The green is not a survey until you verify it. Red is water. White is fairway, bunker, or green.'
          : 'This hole has no single green polygon. The map does not invent one.'}
      </Muted>
      {carryShape ? <Muted>{`${carryShape.note} Width is unknown, so the map draws a line, not an ellipse.`}</Muted> : <Muted>No measured carry dispersion for this club, so no ellipse is drawn.</Muted>}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{`Par ${hole.par ?? '—'}`}</Text>
        <Text style={styles.meta}>{`SI ${hole.strokeIndex ?? '—'}`}</Text>
        <Text style={styles.meta}>{`Card ${formatDistance(hole.yardagesByTee.white ?? null, unit)} ${unit}`}</Text>
      </View>
      <Animated.View style={{ opacity: fade }}>
        <Text style={styles.hero}>{formatDistance(playingYards, unit)}</Text>
        <Text style={styles.heroUnit}>{playingYards == null ? `Type the ${unitLabel(unit)}` : `Raw ${unitLabel(unit)}`}</Text>
        <Text style={styles.plays}>{playsLikeYards == null ? '—' : formatDistance(playsLikeYards, unit)}</Text>
        <Text style={styles.heroUnit}>{playsLikeYards == null ? 'Plays-like waits until wind, elevation, and temperature are all filled.' : `Plays like, ${unitLabel(unit)}. An adjustment, not a measurement.`}</Text>
      </Animated.View>
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
      <Card>
        <Text style={styles.section}>Plays like</Text>
        <Muted>{weatherNote}</Muted>
        <Button
          label="Read weather"
          tone="ghost"
          onPress={() => {
            const at = overlay.line[0];
            if (!at) {
              setWeatherNote('This hole has no open start point, so weather was not requested.');
              return;
            }
            void readWeather({ at, holeLine: overlay.line, greenCenter }).then((read) => {
              setWeatherNote(read.note);
              if (read.current) {
                setTemperatureDraft(String(Math.round(read.current.temperatureF)));
                setWindDraft(String(Math.abs(Math.round(read.current.windMph))));
              }
              if (read.headwindMph != null) {
                setWindDraft(String(Math.abs(Math.round(read.headwindMph))));
                setWindChoice(read.headwindMph > 0.5 ? 'head' : read.headwindMph < -0.5 ? 'tail' : 'cross');
              }
              if (read.elevationFeet != null) {
                setElevationDraft(String(Math.abs(Math.round(read.elevationFeet))));
                setElevationChoice(read.elevationFeet < -0.5 ? 'down' : 'up');
              }
            });
          }}
        />
        <TextInput value={windDraft} onChangeText={setWindDraft} placeholder="Wind mph" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Wind speed" />
        <View style={styles.wrap}>
          <Choice label="Head" selected={windChoice === 'head'} onPress={() => setWindChoice('head')} />
          <Choice label="Tail" selected={windChoice === 'tail'} onPress={() => setWindChoice('tail')} />
          <Choice label="Cross" selected={windChoice === 'cross'} onPress={() => setWindChoice('cross')} />
        </View>
        <TextInput value={elevationDraft} onChangeText={setElevationDraft} placeholder="Elevation change, feet" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Elevation feet" />
        <View style={styles.wrap}>
          <Choice label="Uphill" selected={elevationChoice === 'up'} onPress={() => setElevationChoice('up')} />
          <Choice label="Downhill" selected={elevationChoice === 'down'} onPress={() => setElevationChoice('down')} />
        </View>
        <TextInput value={temperatureDraft} onChangeText={setTemperatureDraft} placeholder="Temperature °F" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Temperature" />
        {adjustment && !('error' in adjustment) ? (
          <Muted>
            {`Wind ${adjustment.wind ? formatDistance(adjustment.wind.yards, unit) : '—'}. Elevation ${adjustment.elevation ? formatDistance(adjustment.elevation.yards, unit) : '—'}. Temperature ${adjustment.temperature ? formatDistance(adjustment.temperature.yards, unit) : '—'}. ${[adjustment.wind?.note, adjustment.elevation?.note, adjustment.temperature?.note].filter(Boolean).join(' ')}`}
          </Muted>
        ) : (
          <Muted>Enter a raw distance before an adjustment.</Muted>
        )}
        <Choice label={usePlaysLike ? 'Club call uses plays-like' : 'Club call uses the raw number'} selected={usePlaysLike} onPress={() => setUsePlaysLike((value) => !value)} />
      </Card>
      <Card>
        <Text style={styles.section}>Miss side</Text>
        <Muted>{misses.note}</Muted>
      </Card>
      <Card warning={layup.call === 'lay_up'}>
        <Text style={styles.club}>{card?.clubLabel ?? 'No club yet'}</Text>
        <Muted>
          {card
            ? `${usePlaysLike && playsLikeYards != null ? 'This call uses the plays-like adjustment. ' : 'This call uses the raw number. '}${card.lines.reason}`
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

function ClubPulse({ clubLabel, call, yards }: { clubLabel: string | null; call: string; yards: number | null }) {
  useEffect(() => {
    if (!clubLabel || yards == null) return;
    void pulse(call === 'lay_up' ? 2 : 1);
  }, [clubLabel, call, yards]);
  return null;
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  meta: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  hero: { color: colors.navy, fontSize: 84, fontWeight: '800', textAlign: 'center', letterSpacing: -2, lineHeight: 92 },
  plays: { color: colors.navy, fontSize: 48, fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
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
