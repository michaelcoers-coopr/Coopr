import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DistanceMetric, GeometryVerification, LatLon, MapFeature } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import {
  acceptShotYards,
  debriefNote,
  destinationPoint,
  dispersionShape,
  displayToYards,
  distanceYards,
  formatDistance,
  holeOverlay,
  layupDecision,
  missReport,
  recommend,
  resolveHolePlay,
  ringCentroid,
  shortShotCall,
  SHORT_SHOT_YARDS,
  shotBearing,
  taggedHazardLine,
  playsLike,
  unitLabel,
  WEDGE_LENGTHS,
  type DistanceProfile,
  type DistanceUnit,
  type MissMark,
  type WedgeLength,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { readDevicePosition } from '../src/device-position';
import { HoleMap } from '../src/hole-map';
import { pulse } from '../src/haptics';
import { readWeather } from '../src/weather';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { Button } from '../src/ui';

const pilot = loadHighCedarsPilot();
const NAVY = '#0B1F3A';
const INK = '#F7F5F2';
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

function carryProfile(profiles: readonly DistanceProfile[], clubId: string | null): DistanceProfile | null {
  if (!clubId) return null;
  const rows = profiles.filter((profile) => profile.clubId === clubId && profile.metric === 'carry');
  return rows.find((profile) => profile.blended) ?? rows[0] ?? null;
}

function totalProfile(profiles: readonly DistanceProfile[], clubId: string | null): DistanceProfile | null {
  if (!clubId) return null;
  const rows = profiles.filter((profile) => profile.clubId === clubId && profile.metric === 'total');
  return rows.find((profile) => profile.blended) ?? rows[0] ?? null;
}

function lengthLabel(length: WedgeLength): string {
  if (length === 'three_quarter') return 'three-quarter';
  return length;
}

function carryWords(profile: DistanceProfile, unit: DistanceUnit): string {
  const show = (value: number) => formatDistance(value, unit);
  if (!profile.dispersionKnown) return `Carry normal ${show(profile.stockYards)}. The short and long ends were not measured.`;
  return `Carry short ${show(profile.p20)}, normal ${show(profile.stockYards)}, long ${show(profile.p80)}. The long one is not the plan.`;
}

function longestWords(profile: DistanceProfile, unit: DistanceUnit): string | null {
  if (Math.abs(profile.longestYards - profile.stockYards) < 0.5) return null;
  return `Longest total ${formatDistance(profile.longestYards, unit)} from ${profile.sampleSize} shots. Not the number to plan.`;
}

function plainMiss(marks: readonly MissMark[]): string | null {
  if (marks.length === 0) return null;
  const report = missReport(marks);
  if (report.aimOffsetYards != null) {
    const way = report.aimOffsetYards < -0.5 ? 'left' : report.aimOffsetYards > 0.5 ? 'right' : 'on the target';
    return `Misses lean ${report.side}. Aim ${Math.abs(report.aimOffsetYards)} yards ${way}. No new yardage was invented.`;
  }
  if (report.side === 'left' || report.side === 'right') return `Misses lean ${report.side}. No yard aim yet.`;
  return 'Not enough misses yet.';
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
    score,
    courseReviews,
    setCourseReview,
    founderTools,
    tagShot,
    tagged,
    wedges,
    debriefs,
    setDebrief,
    putts,
    setPutts,
    conditions,
    setConditions,
  } = useLocalStore();
  const hole = pilot.quality.find((item) => item.holeNumber === currentHole);
  const [metric, setMetric] = useState<DistanceMetric>('total');
  const [draft, setDraft] = useState('');
  const [carryDraft, setCarryDraft] = useState('');
  const [flightCarry, setFlightCarry] = useState('');
  const [flightTotal, setFlightTotal] = useState('');
  const [putting, setPutting] = useState(false);
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState(false);
  const [shotNote, setShotNote] = useState('');
  const [tagNote, setTagNote] = useState('');
  const [player, setPlayer] = useState<LatLon | null>(null);
  const [measure, setMeasure] = useState<LatLon[]>([]);
  const [weatherNote, setWeatherNote] = useState('');
  const [why, setWhy] = useState(false);
  const [flightOpen, setFlightOpen] = useState(false);
  const windChoice = conditions.windChoice;
  const windDraft = conditions.wind;
  const elevationDraft = conditions.elevation;
  const elevationChoice = conditions.elevationChoice;
  const temperatureDraft = conditions.temperature;
  const usePlaysLike = conditions.usePlaysLike;

  useEffect(() => {
    const saved = manualYards[currentHole];
    setDraft(saved == null ? '' : formatDistance(saved, unit));
    setCarryDraft('');
    setFlightCarry('');
    setFlightTotal('');
    setPutting(false);
    setAsk(false);
    setDone(false);
    setShotNote('');
    setMeasure([]);
    setTagNote('');
    setWhy(false);
    setFlightOpen(false);
    // The saved shot for this hole is restored. Carry-to-clear starts empty on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHole]);

  if (!hole) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.line}>That hole is not on the High Cedars card.</Text>
      </SafeAreaView>
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
  const shotYards = typed ?? gpsCenter;
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
    shotYards == null
      ? null
      : playsLike({
          rawYards: shotYards,
          headwindMph: headwind,
          elevationFeet: elevationFeet != null && Number.isFinite(elevationFeet) ? elevationFeet : null,
          temperatureF: temperatureF != null && Number.isFinite(temperatureF) ? temperatureF : null,
        });
  const playsLikeYards = adjustment && !('error' in adjustment) ? adjustment.playsLikeYards : null;
  const callYards = usePlaysLike && playsLikeYards != null ? playsLikeYards : shotYards;
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const shortMode = !putting && callYards != null && callYards <= SHORT_SHOT_YARDS;
  const wedgeCells = inPlay.flatMap((club) =>
    WEDGE_LENGTHS.map((length) => ({
      clubId: club.id,
      clubLabel: club.label.split('·')[0]?.trim() || club.label,
      length,
      carryYards: wedges[club.id]?.[length] ?? null,
    })),
  );
  const short = shortMode && callYards != null ? shortShotCall(callYards, wedgeCells) : null;
  const card =
    putting || shortMode || callYards == null
      ? null
      : recommend({
          targetDistanceYards: callYards,
          targetMetric: metric,
          hazards: [],
          intent: 'neutral',
          riskPreference: 'neutral',
          profiles,
          candidateClubIds: inPlay.length > 0 ? inPlay.map((club) => club.id) : undefined,
          personality: 'direct_analytical',
        });
  const calledId = putting ? null : short?.clubId ?? (card && card.posture !== 'decline' ? card.clubId : null);
  const calledLabel = putting
    ? 'Putt'
    : short?.clubLabel
      ? `${short.clubLabel} ${short.length ? lengthLabel(short.length) : ''}`.trim()
      : card?.posture === 'decline' || (short && !short.clubId)
        ? 'No club'
        : card?.clubLabel?.split('·')[0]?.trim() || card?.clubLabel || (shotYards == null ? '—' : 'No club');
  const carryStock = carryProfile(profiles, calledId);
  const totalStock = totalProfile(profiles, calledId);
  const stockYards = card?.metricUsed === 'carry' ? carryStock?.stockYards ?? null : totalStock?.stockYards ?? short?.carryYards ?? null;
  const gapYards = callYards != null && stockYards != null && calledId ? Math.round(Math.abs(stockYards - callYards)) : null;
  const typedClear = carryDraft.trim() === '' ? null : Number(carryDraft);
  const typedClearYards =
    typedClear != null && Number.isFinite(typedClear) && typedClear > 0 ? displayToYards(typedClear, unit) : null;
  const hazard = taggedHazardLine(pilot.features, hole.holeNumber, player);
  const carryToClear = typedClearYards ?? hazard?.yards ?? null;
  const carryNote =
    typedClear != null && Number.isFinite(typedClear) && typedClear <= 0
      ? 'The carry line has to be more than 0. Nothing was set.'
      : null;
  const layup =
    !shortMode && !putting
      ? layupDecision({ carry: carryStock, carryToClearYards: carryToClear })
      : null;
  const shape = dispersionShape(carryStock);
  const bearing = shotBearing(overlay.line);
  const dispersionLine =
    shape && shape.metric === 'carry' && bearing != null && overlay.line[0] && shape.alongYards > 0
      ? [
          destinationPoint(destinationPoint(overlay.line[0], bearing, shape.centerYards), bearing + 180, shape.alongYards),
          destinationPoint(destinationPoint(overlay.line[0], bearing, shape.centerYards), bearing, shape.alongYards),
        ]
      : [];
  const measureYards = measure.length === 2 ? distanceYards(measure[0]!, measure[1]!) : null;
  const strokes = holes[hole.holeNumber - 1] ?? null;
  const previous = currentHole > 1 ? holes[currentHole - 2] ?? null : null;
  const par = hole.par;
  const over = strokes != null && par != null ? strokes - par : null;
  const holeTags = tagged.filter((shot) => shot.hole === hole.holeNumber);
  const puttCount = putts[hole.holeNumber - 1] ?? null;
  const missLine = plainMiss(
    calledId == null ? [] : tagged.filter((shot) => shot.clubId === calledId).map((shot) => ({ side: shot.result, sideYards: null })),
  );
  const longTotal = !putting && !short && totalStock ? longestWords(totalStock, unit) : null;
  const disclaimer = measureYards != null
    ? `Map distance ${formatDistance(measureYards, unit)} ${unitLabel(unit)}. Not a shot and not a carry.`
    : hazard
      ? hazard.note
      : hole.hazardsTaggedToHole + hole.bunkersTaggedToHole === 0
        ? 'Open shapes, not a survey. Satellite is on the phone. No hazard is tagged, so no carry line is set.'
        : 'A hazard is tagged. The line stays empty until this phone has a position.';

  const saveShot = (): number | null => {
    const stored = manualYards[hole.holeNumber] ?? null;
    if (draft.trim() === '') {
      setManualYards(hole.holeNumber, null);
      setCarryDraft('');
      setShotNote('');
      return null;
    }
    const accepted = acceptShotYards(Number(draft));
    if (typeof accepted !== 'number') {
      setShotNote(accepted.error);
      return stored;
    }
    const yards = displayToYards(accepted, unit);
    if (stored != null && Math.abs(yards - stored) < 0.05) {
      setShotNote('');
      return stored;
    }
    setManualYards(hole.holeNumber, yards);
    setCarryDraft('');
    setShotNote('');
    return yards;
  };

  const switchUnit = (next: 'yd' | 'm') => {
    if (next === unit) return;
    const stored = manualYards[hole.holeNumber] ?? null;
    const accepted = draft.trim() === '' ? null : acceptShotYards(Number(draft));
    let kept = stored;
    let shotChanged = false;
    if (draft.trim() === '') {
      if (stored != null) shotChanged = true;
      setManualYards(hole.holeNumber, null);
      kept = null;
    } else if (typeof accepted === 'number') {
      const yards = displayToYards(accepted, unit);
      if (stored == null || Math.abs(yards - stored) >= 0.05) {
        setManualYards(hole.holeNumber, yards);
        shotChanged = true;
      }
      kept = yards;
      setShotNote('');
    } else if (accepted && typeof accepted !== 'number') {
      setShotNote(accepted.error);
    }
    setDraft(kept == null ? '' : formatDistance(kept, next));
    if (shotChanged) setCarryDraft('');
    else if (carryDraft.trim() !== '') {
      const line = Number(carryDraft);
      setCarryDraft(Number.isFinite(line) && line > 0 ? formatDistance(displayToYards(line, unit), next) : '');
    }
    setFlightCarry('');
    setFlightTotal('');
    setUnit(next);
  };

  const commitTag = (result: LandingResult) => {
    const club = inPlay.find((item) => item.id === calledId);
    if (!club) {
      setTagNote('No club is called.');
      return;
    }
    const carryRaw = flightCarry.trim() === '' ? null : Number(flightCarry);
    const totalRaw = flightTotal.trim() === '' ? null : Number(flightTotal);
    const carryAccepted = carryRaw == null ? null : acceptShotYards(carryRaw);
    const totalAccepted = totalRaw == null ? null : acceptShotYards(totalRaw);
    if ((carryAccepted != null && typeof carryAccepted !== 'number') || (totalAccepted != null && typeof totalAccepted !== 'number')) {
      setTagNote('Flight carry and total have to be more than 0, or stay blank.');
      return;
    }
    tagShot({
      hole: hole.holeNumber,
      clubId: club.id,
      clubLabel: club.label,
      result,
      shownYards: shotYards,
      carry: typeof carryAccepted === 'number' ? displayToYards(carryAccepted, unit) : null,
      total: typeof totalAccepted === 'number' ? displayToYards(totalAccepted, unit) : null,
      swingMode: short?.length ?? card?.swingMode ?? 'unknown',
    });
    setFlightCarry('');
    setFlightTotal('');
    setTagNote(`${club.label.split('·')[0]?.trim()} · ${result}. Flight yardage is only what you type in the flight boxes.`);
  };

  const answered = debriefs.some((item) => item.hole === hole.holeNumber);
  const advance = () => {
    setAsk(false);
    if (hole.holeNumber >= 18) {
      setDone(true);
      return;
    }
    setCurrentHole(hole.holeNumber + 1);
  };

  const leaveHole = () => {
    if (over != null && over > 0 && !answered) {
      setAsk(true);
      return;
    }
    advance();
  };

  const answer = (choice: 'plan' | 'swing') => {
    if (strokes == null || par == null || over == null || over <= 0) return;
    setDebrief({
      hole: hole.holeNumber,
      choice,
      note: debriefNote(choice, { hole: hole.holeNumber, strokes, par, over }),
    });
    advance();
  };

  const goBack = () => {
    setAsk(false);
    setDone(false);
    setCurrentHole(hole.holeNumber - 1);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          title: `Hole ${hole.holeNumber}`,
          headerStyle: { backgroundColor: NAVY },
          headerTintColor: INK,
          headerTitleStyle: { color: INK, fontWeight: '800' },
        }}
      />
      <ClubPulse clubLabel={calledId ? calledLabel : null} call={layup?.call ?? 'go'} yards={shotYards} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.meta}>{`Par ${par ?? '—'}  ·  SI ${hole.strokeIndex ?? '—'}  ·  Card ${hole.yardagesByTee.white ?? '—'}`}</Text>
        <HoleMap
          height={112}
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={null}
          dispersionLine={dispersionLine}
          measure={measure}
          onTap={(point) => setMeasure((current) => (current.length >= 2 ? [point] : [...current, point]))}
          rawLabel={formatDistance(shotYards, unit)}
          playsLabel={playsLikeYards == null ? '—' : formatDistance(playsLikeYards, unit)}
        />
        <Text style={styles.line}>{disclaimer}</Text>
        {play.mode === 'gps' ? (
          <View style={styles.ends}>
            <Text style={styles.end}>{`Front ${formatDistance(play.frontYards, unit)}`}</Text>
            <Text style={styles.end}>{`Center ${formatDistance(play.centerYards, unit)}`}</Text>
            <Text style={styles.end}>{`Back ${formatDistance(play.backYards, unit)}`}</Text>
          </View>
        ) : null}
        <Text style={styles.club}>{calledLabel}</Text>
        <Text style={styles.stock}>
          {short
            ? `Carry ${short.carryYards ?? '—'}  ·  Total —`
            : `Carry ${carryStock ? formatDistance(carryStock.stockYards, unit) : '—'}  ·  Total ${totalStock ? formatDistance(totalStock.stockYards, unit) : '—'}`}
        </Text>
        <Text style={styles.gap}>
          {putting
            ? 'On the green. No full swing.'
            : short
              ? short.reason
              : card?.posture === 'decline'
                ? card.lines.reason
                : gapYards != null
                  ? `${gapYards} yards ${stockYards! > callYards! ? 'long' : stockYards! < callYards! ? 'short' : 'even'} of the shot. Calling the ${card?.metricUsed ?? metric}.`
                  : shotYards == null
                    ? 'Type the shot. The card yardage stays on the card.'
                    : 'No club.'}
        </Text>
        {card?.passedCloser && !putting && !short ? <Text style={styles.line}>{card.passedCloser}</Text> : null}
        {missLine && !putting ? <Text style={styles.line}>{missLine}</Text> : null}
        <View style={styles.chips}>
          <Chip label="Shot" selected={!putting} onPress={() => setPutting(false)} />
          <Chip label="Putt" selected={putting} onPress={() => setPutting(true)} />
          <Chip label="Total" selected={metric === 'total'} onPress={() => setMetric('total')} />
          <Chip label="Carry" selected={metric === 'carry'} onPress={() => setMetric('carry')} />
        </View>
        {!putting ? (
          <View style={styles.chips}>
            {RESULTS.map((result) => (
              <Chip key={result.id} label={result.label} selected={false} onPress={() => commitTag(result.id)} />
            ))}
            {card && !short && !putting && card.posture !== 'decline' ? (
              <Chip label={why ? 'Hide why' : 'Why'} selected={why} onPress={() => setWhy((open) => !open)} />
            ) : null}
          </View>
        ) : null}
        {why && card && !short && !putting ? <Text style={styles.line}>{card.lines.reason}</Text> : null}
        {carryStock && !putting ? <Text style={styles.line}>{carryWords(carryStock, unit)}</Text> : null}
        {calledId && !putting && !short && !carryStock ? <Text style={styles.line}>Carry was not measured.</Text> : null}
        {longTotal ? <Text style={styles.line}>{longTotal}</Text> : null}
        {shape && !putting ? <Text style={styles.line}>{`Carry dispersion ${shape.alongYards} yards either side of ${Math.round(shape.centerYards)}. Width was not measured.`}</Text> : null}
        {short && short.clubId == null && short.reason.startsWith('No wedge carry is stored') ? (
          <Button label="Enter wedge carries" tone="ghost" onPress={() => router.push('/wedges')} />
        ) : null}
        {tagNote ? <Text style={styles.line}>{tagNote}</Text> : null}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Shot yards"
          keyboardType="decimal-pad"
          placeholderTextColor="#D5D8DE"
          style={styles.input}
          accessibilityLabel="Shot yards"
        />
        <Button label="Use this shot" tone="ghost" onPress={() => { saveShot(); }} />
        {shotNote ? <Text style={styles.line}>{shotNote}</Text> : null}
        <View style={styles.chips}>
          <Chip label="Head" selected={windChoice === 'head'} onPress={() => setConditions({ windChoice: 'head' })} />
          <Chip label="Tail" selected={windChoice === 'tail'} onPress={() => setConditions({ windChoice: 'tail' })} />
          <Chip label="Cross" selected={windChoice === 'cross'} onPress={() => setConditions({ windChoice: 'cross' })} />
          <Chip label="Uphill" selected={elevationChoice === 'up'} onPress={() => setConditions({ elevationChoice: 'up' })} />
          <Chip label="Downhill" selected={elevationChoice === 'down'} onPress={() => setConditions({ elevationChoice: 'down' })} />
        </View>
        <View style={styles.row}>
          <TextInput value={windDraft} onChangeText={(wind) => setConditions({ wind })} placeholder="Wind" keyboardType="decimal-pad" placeholderTextColor="#D5D8DE" style={[styles.input, styles.third]} accessibilityLabel="Wind speed" />
          <TextInput value={elevationDraft} onChangeText={(elevation) => setConditions({ elevation })} placeholder="Feet" keyboardType="decimal-pad" placeholderTextColor="#D5D8DE" style={[styles.input, styles.third]} accessibilityLabel="Elevation feet" />
          <TextInput value={temperatureDraft} onChangeText={(temperature) => setConditions({ temperature })} placeholder="°F" keyboardType="decimal-pad" placeholderTextColor="#D5D8DE" style={[styles.input, styles.third]} accessibilityLabel="Temperature" />
        </View>
        <Chip
          label={usePlaysLike ? 'Club uses plays-like' : 'Club uses the shot'}
          selected={usePlaysLike}
          onPress={() => setConditions({ usePlaysLike: !usePlaysLike })}
        />
        {adjustment && 'error' in adjustment ? (
          <Text style={styles.line}>{adjustment.error}</Text>
        ) : adjustment && !('error' in adjustment) && playsLikeYards != null ? (
          <Text style={styles.line}>{`Wind ${adjustment.wind?.yards ?? '—'} · Elevation ${adjustment.elevation?.yards ?? '—'} · Temperature ${adjustment.temperature?.yards ?? '—'}`}</Text>
        ) : (
          <Text style={styles.line}>
            {shotYards == null
              ? 'Plays-like waits for the shot.'
              : 'Plays-like stays blank until wind, elevation, and temperature are all set.'}
          </Text>
        )}
        {weatherNote ? <Text style={styles.line}>{weatherNote}</Text> : null}
        <Button
          label="Read weather"
          tone="ghost"
          onPress={() => {
            const at = overlay.line[0];
            if (!at) return;
            const greenCenter = green?.rings[0] ? ringCentroid(green.rings[0]) : null;
            void readWeather({ at, holeLine: overlay.line, greenCenter }).then((read) => {
              setWeatherNote(read.note);
              const next: Partial<typeof conditions> = {};
              if (read.current) next.temperature = String(Math.round(read.current.temperatureF));
              if (read.headwindMph != null) {
                next.wind = String(Math.abs(Math.round(read.headwindMph)));
                next.windChoice = read.headwindMph > 0.5 ? 'head' : read.headwindMph < -0.5 ? 'tail' : 'cross';
              }
              if (read.elevationFeet != null) {
                next.elevation = String(Math.abs(Math.round(read.elevationFeet)));
                next.elevationChoice = read.elevationFeet < -0.5 ? 'down' : 'up';
              }
              if (Object.keys(next).length > 0) setConditions(next);
            });
          }}
        />
        <TextInput
          value={carryDraft}
          onChangeText={setCarryDraft}
          placeholder={hazard ? `Tagged line ${hazard.yards}` : 'Carry to clear'}
          keyboardType="decimal-pad"
          placeholderTextColor="#D5D8DE"
          style={styles.input}
          accessibilityLabel="Carry to clear"
        />
        {carryNote ? <Text style={styles.line}>{carryNote}</Text> : null}
        {layup && layup.call !== 'unsure' ? <Text style={[styles.gap, layup.call === 'lay_up' && styles.warn]}>{layup.reason}</Text> : null}
        <Chip label={flightOpen ? 'Hide flight yards' : 'Add flight yards'} selected={flightOpen} onPress={() => setFlightOpen((open) => !open)} />
        {flightOpen ? (
          <>
            <Text style={styles.line}>Flight yardage. Leave a box blank. The shot number is not copied.</Text>
            <View style={styles.row}>
              <TextInput value={flightCarry} onChangeText={setFlightCarry} placeholder="Flight carry" keyboardType="decimal-pad" placeholderTextColor="#D5D8DE" style={[styles.input, styles.half]} accessibilityLabel="Flight carry" />
              <TextInput value={flightTotal} onChangeText={setFlightTotal} placeholder="Flight total" keyboardType="decimal-pad" placeholderTextColor="#D5D8DE" style={[styles.input, styles.half]} accessibilityLabel="Flight total" />
            </View>
          </>
        ) : null}
        {holeTags.map((shot) => (
          <Text key={shot.id} style={styles.line}>{`${shot.clubLabel.split('·')[0]?.trim()} · ${shot.result} · flight carry ${shot.carry ?? '—'} · flight total ${shot.total ?? '—'}`}</Text>
        ))}
        <View style={styles.chips}>
          <Chip label="Yards" selected={unit === 'yd'} onPress={() => switchUnit('yd')} />
          <Chip label="Meters" selected={unit === 'm'} onPress={() => switchUnit('m')} />
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
            tone="ghost"
            onPress={() => {
              void readDevicePosition().then((position) => {
                setPlayer(position);
                setCarryDraft('');
              });
            }}
          />
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.scoreRow}>
          <Text style={styles.footerTitle}>Score</Text>
          <Chip label="−" accessibilityLabel="Score minus" selected={false} onPress={() => setStrokes(hole.holeNumber, strokes == null || strokes <= 1 ? null : strokes - 1)} />
          <Text style={styles.score}>{strokes ?? '—'}</Text>
          <Chip label="+" accessibilityLabel="Score plus" selected={false} onPress={() => setStrokes(hole.holeNumber, (strokes ?? 0) + 1)} />
          <Text style={styles.line}>{previous == null ? '' : `Hole ${currentHole - 1} · ${previous}`}</Text>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.footerTitle}>Putts</Text>
          <Chip
            label="−"
            accessibilityLabel="Putt minus"
            selected={false}
            onPress={() => setPutts(hole.holeNumber, puttCount == null ? null : puttCount <= 0 ? null : puttCount - 1)}
          />
          <Text style={styles.score}>{puttCount ?? '—'}</Text>
          <Chip label="+" accessibilityLabel="Putt plus" selected={false} onPress={() => setPutts(hole.holeNumber, puttCount == null ? 1 : Math.min(99, puttCount + 1))} />
        </View>
        <Text style={styles.line}>Putts are not added to the score.</Text>
        {ask && over != null && over > 0 ? (
          <>
            <Text style={styles.footerTitle}>{`Hole ${hole.holeNumber} was ${over} over par. Plan or swing?`}</Text>
            <View style={styles.row}>
              <View style={styles.half}><Chip label="The plan" selected={false} onPress={() => answer('plan')} /></View>
              <View style={styles.half}><Chip label="The swing" selected={false} onPress={() => answer('swing')} /></View>
            </View>
          </>
        ) : null}
        {done ? <Text style={styles.footerTitle}>{score.holesEntered === 0 ? 'Round is in. No strokes yet.' : `Round is in. Gross ${score.gross}.`}</Text> : null}
        <View style={styles.row}>
          {currentHole > 1 ? (
            <View style={styles.half}>
              <Button label="Previous hole" tone="ghost" onPress={goBack} />
            </View>
          ) : null}
          <View style={styles.half}>
            {done ? (
              <Button label="Scorecard" onPress={() => router.push('/scorecard')} />
            ) : ask ? null : (
              <Button label="Next hole" tone="ghost" onPress={leaveHole} />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
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
  screen: { flex: 1, backgroundColor: NAVY },
  scroll: { padding: 12, paddingBottom: 8, gap: 6 },
  meta: { color: INK, fontSize: 18, fontWeight: '800' },
  line: { color: INK, fontSize: 16, lineHeight: 22 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  end: { color: INK, fontSize: 22, fontWeight: '800' },
  club: { color: INK, fontSize: 40, fontWeight: '800' },
  stock: { color: INK, fontSize: 22, fontWeight: '800' },
  gap: { color: INK, fontSize: 18, lineHeight: 24 },
  warn: { color: colors.red, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 999, borderWidth: 2, borderColor: INK, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: INK },
  chipText: { color: INK, fontSize: 16, fontWeight: '800' },
  chipTextOn: { color: NAVY },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    color: INK,
    borderColor: INK,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 12,
    fontSize: 20,
  },
  third: { flex: 1 },
  half: { flex: 1 },
  footer: { borderTopWidth: 2, borderTopColor: INK, padding: 8, gap: 4, backgroundColor: NAVY },
  footerTitle: { color: INK, fontSize: 20, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score: { color: INK, fontSize: 36, fontWeight: '800', minWidth: 40, textAlign: 'center' },
});
