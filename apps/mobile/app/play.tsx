import { useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LatLon, MapFeature } from '@coopr/domain';
import { font, play as field, radius, touch } from '@coopr/tokens';
import {
  acceptShotYards,
  arrivedAtNextTee,
  classifyFinish,
  closeMarkedShot,
  debriefNote,
  destinationPoint,
  dispersionShape,
  displayToYards,
  formatDistance,
  gpsPreset,
  greenYardsFrom,
  holeOverlay,
  layupDecision,
  missReport,
  nearestHazardYards,
  recommend,
  ringCentroid,
  scoreFace,
  shortShotCall,
  SHORT_SHOT_YARDS,
  shotBearing,
  stepCount,
  taggedHazardLine,
  playsLike,
  WEDGE_LENGTHS,
  type DistanceProfile,
  type DistanceUnit,
  type FinishLie,
  type MissMark,
  type WalkPolygons,
  type WedgeLength,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { HoleMap } from '../src/hole-map';
import { celebrate, pulse } from '../src/haptics';
import { holeSwipe, rollSteps } from '../src/design/motion';
import { subscribeGps } from '../src/gps-fix';
import { readWeather, type WeatherRead } from '../src/weather';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { useAskCoopr } from '../src/ask-coopr';

const pilot = loadHighCedarsPilot();

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
    return `Misses lean ${report.side}. Aim ${Math.abs(report.aimOffsetYards)} yards ${way}.`;
  }
  if (report.side === 'left' || report.side === 'right') return `Misses lean ${report.side}.`;
  return null;
}

function lieResult(lie: FinishLie | null): LandingResult | null {
  if (lie == null) return null;
  return lie;
}

export default function PlayScreen() {
  const {
    clubs,
    profiles,
    unit,
    currentHole,
    setCurrentHole,
    manualYards,
    setManualYards,
    holes,
    setStrokes,
    score,
    tagShot,
    tagged,
    wedges,
    debriefs,
    setDebrief,
    putts,
    setPutts,
    marks,
    recordMark,
    conditions,
    removeTag,
  } = useLocalStore();
  const hole = pilot.quality.find((item) => item.holeNumber === currentHole);
  const [player, setPlayer] = useState<LatLon | null>(null);
  const [sky, setSky] = useState<WeatherRead | null>(null);
  const [why, setWhy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [mapH, setMapH] = useState(560);
  const rise = useRef(new Animated.Value(32)).current;
  const rolledFrom = useRef<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef<() => void>(() => {});
  const backRef = useRef<() => void>(() => {});
  const holeNo = useRef(1);
  const advanced = useRef(0);
  const voiceClub = useRef<{
    clubId: string | null;
    clubLabel: string;
    carryToClearYards: number | null;
    carry: DistanceProfile | null;
  }>({ clubId: null, clubLabel: 'Shot', carryToClearYards: null, carry: null });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_, gesture) => {
        const dir = holeSwipe(gesture.dx, gesture.dy, holeNo.current);
        if (dir === 'next') leaveRef.current();
        if (dir === 'prev') backRef.current();
      },
    }),
  ).current;

  const overlay = hole ? holeOverlay(pilot.features, pilot.record.scorecard, hole.holeNumber) : null;
  const greenRing = overlay?.green?.rings[0] ?? null;
  const ground = player && greenRing ? greenYardsFrom(player, greenRing) : null;
  const manual = hole ? manualYards[hole.holeNumber] ?? null : null;
  const shotYards = player ? ground?.centerYards ?? null : manual;
  const heroBase = shotYards == null ? null : Math.round(shotYards);
  const voiceClubs = clubs.filter((club) => club.slot === 'in_play');
  const ask = useAskCoopr({
    hole: currentHole,
    gpsYards: player ? ground?.centerYards ?? null : null,
    headwindMph: conditions.usePlaysLike ? sky?.headwindMph ?? null : null,
    elevationFeet: conditions.usePlaysLike ? sky?.elevationFeet ?? null : null,
    temperatureF: conditions.usePlaysLike ? sky?.current?.temperatureF ?? null : null,
    profiles,
    candidateClubIds: voiceClubs.length > 0 ? voiceClubs.map((club) => club.id) : undefined,
    wedges: voiceClubs.flatMap((club) =>
      WEDGE_LENGTHS.map((length) => ({
        clubId: club.id,
        clubLabel: club.label.split('·')[0]?.trim() || club.label,
        length,
        carryYards: wedges[club.id]?.[length] ?? null,
      })),
    ),
    marks: tagged.flatMap((shot) => {
      if (shot.result !== 'left' && shot.result !== 'right' && shot.result !== 'fairway' && shot.result !== 'hazard' && shot.result !== 'short') return [];
      return [{ side: shot.result, sideYards: null as number | null }];
    }),
    club: voiceClub,
    readScore: () => holes[currentHole - 1] ?? null,
    readPutts: () => putts[currentHole - 1] ?? null,
    readHole: () => holeNo.current,
    onScore: setStrokes,
    onPutts: setPutts,
    onNext: () => leaveRef.current(),
    onBack: () => backRef.current(),
    onMiss: (side, clubId, clubLabel) => {
      const id = `tag-${tagged.length + 1}`;
      tagShot({
        hole: holeNo.current,
        clubId: clubId ?? 'voice',
        clubLabel,
        result: side,
        shownYards: player ? ground?.centerYards ?? null : null,
        carry: null,
        total: null,
        swingMode: 'unknown',
      });
      return id;
    },
    onRemoveTag: removeTag,
  });

  useEffect(() => {
    setWhy(false);
    setOverrideOpen(false);
    setSaved(null);
    setSky(null);
  }, [currentHole]);

  useEffect(() => {
    rise.setValue(32);
    Animated.spring(rise, { toValue: 0, friction: 8, tension: 68, useNativeDriver: false }).start();
  }, [currentHole, rise]);

  useEffect(() => {
    if (heroBase == null) {
      rolledFrom.current = null;
      setRoll(null);
      return;
    }
    const from = rolledFrom.current;
    rolledFrom.current = heroBase;
    if (from == null || from === heroBase) {
      setRoll(null);
      return;
    }
    const steps = rollSteps(from, heroBase, 10);
    let index = 0;
    setRoll(steps[0] ?? null);
    const timer = setInterval(() => {
      index += 1;
      if (index >= steps.length) {
        setRoll(null);
        clearInterval(timer);
        return;
      }
      setRoll(steps[index] ?? null);
    }, 28);
    return () => clearInterval(timer);
  }, [heroBase]);

  useEffect(() => {
    const geometry = holeOverlay(pilot.features, pilot.record.scorecard, currentHole);
    const ring = geometry.green?.rings[0] ?? null;
    return subscribeGps(setPlayer, (stored) => (typeof stored === 'string' ? gpsPreset(stored, geometry.line, ring) : stored));
  }, [currentHole]);

  useEffect(() => {
    const geometry = holeOverlay(pilot.features, pilot.record.scorecard, currentHole);
    const at = player ?? geometry.line[0] ?? null;
    if (!at) return;
    const center = geometry.green?.rings[0] ? ringCentroid(geometry.green.rings[0]) : null;
    let cancel = false;
    const timer = setTimeout(() => {
      void readWeather({ at, holeLine: geometry.line, player, greenCenter: center }).then((read) => {
        if (!cancel) setSky(read);
      });
    }, 350);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [currentHole, player]);

  useEffect(() => {
    if (!player || currentHole >= 18) return;
    const geometry = holeOverlay(pilot.features, pilot.record.scorecard, currentHole);
    const nextTee = holeOverlay(pilot.features, pilot.record.scorecard, currentHole + 1).line[0] ?? null;
    const center = geometry.green?.rings[0] ? ringCentroid(geometry.green.rings[0]) : null;
    if (!arrivedAtNextTee({ player, nextTee, currentGreen: center })) return;
    if (advanced.current === currentHole) return;
    advanced.current = currentHole;
    leaveRef.current();
  }, [player, currentHole]);

  if (!hole || !overlay) {
    return (
      <View style={styles.screen}>
        <Text style={styles.quiet}>That hole is not on the High Cedars card.</Text>
      </View>
    );
  }

  const polygons: WalkPolygons = {
    line: overlay.line,
    fairways: overlay.fairways.flatMap((feature) => feature.rings),
    greens: overlay.green ? [...overlay.green.rings] : [],
    bunkers: overlay.bunkers.flatMap((feature) => feature.rings),
    hazards: overlay.hazards.flatMap((feature) => feature.rings),
  };
  const onGreen = player ? classifyFinish(player, polygons) === 'green' : false;
  const adjustment =
    !conditions.usePlaysLike || shotYards == null
      ? null
      : playsLike({
          rawYards: shotYards,
          headwindMph: sky?.headwindMph ?? null,
          elevationFeet: sky?.elevationFeet ?? null,
          temperatureF: sky?.current?.temperatureF ?? null,
        });
  const playsLikeYards = adjustment && !('error' in adjustment) ? adjustment.playsLikeYards : null;
  const callYards = conditions.usePlaysLike && playsLikeYards != null ? playsLikeYards : shotYards;
  const inPlay = clubs.filter((club) => club.slot === 'in_play');
  const putter = inPlay.find((club) => /putter/i.test(club.label)) ?? null;
  const shortMode = !onGreen && callYards != null && callYards <= SHORT_SHOT_YARDS;
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
    onGreen || shortMode || callYards == null
      ? null
      : recommend({
          targetDistanceYards: callYards,
          targetMetric: 'total',
          hazards: [],
          intent: 'neutral',
          riskPreference: 'neutral',
          profiles,
          candidateClubIds: inPlay.length > 0 ? inPlay.map((club) => club.id) : undefined,
          personality: 'direct_analytical',
        });
  const calledId = onGreen ? putter?.id ?? null : short?.clubId ?? (card && card.posture !== 'decline' ? card.clubId : null);
  const calledLabel = onGreen
    ? putter?.label.split('·')[0]?.trim() || null
    : short?.clubId
      ? `${short.clubLabel ?? ''} ${short.length ? lengthLabel(short.length) : ''}`.trim()
      : card && card.posture !== 'decline'
        ? card.clubLabel?.split('·')[0]?.trim() || card.clubLabel
        : null;
  const carryStock = carryProfile(profiles, calledId);
  const totalStock = totalProfile(profiles, calledId);
  const stockYards = card?.metricUsed === 'carry' ? carryStock?.stockYards ?? null : totalStock?.stockYards ?? short?.carryYards ?? null;
  const shownStock = stockYards == null ? null : Math.round(stockYards);
  const shownTarget = callYards == null ? null : Math.round(callYards);
  const gapYards = shownStock != null && shownTarget != null && calledId ? Math.abs(shownStock - shownTarget) : null;
  const hazard = taggedHazardLine(pilot.features, hole.holeNumber, player);
  voiceClub.current = {
    clubId: calledId,
    clubLabel: calledLabel ?? 'Shot',
    carryToClearYards: hazard?.yards ?? null,
    carry: carryStock,
  };
  const layup = !shortMode && !onGreen && hazard ? layupDecision({ carry: carryStock, carryToClearYards: hazard.yards }) : null;
  const hazardYards = player ? nearestHazardYards(player, [...polygons.hazards, ...polygons.bunkers]) : null;
  const shape = dispersionShape(carryStock);
  const bearing = shotBearing(overlay.line);
  const dispersionLine =
    shape && shape.metric === 'carry' && bearing != null && overlay.line[0] && shape.alongYards > 0
      ? [
          destinationPoint(destinationPoint(overlay.line[0], bearing, shape.centerYards), bearing + 180, shape.alongYards),
          destinationPoint(destinationPoint(overlay.line[0], bearing, shape.centerYards), bearing, shape.alongYards),
        ]
      : [];
  const strokes = holes[hole.holeNumber - 1] ?? null;
  const par = hole.par;
  const puttCount = putts[hole.holeNumber - 1] ?? null;
  const holeMarks = marks.filter((mark) => mark.hole === hole.holeNumber);
  const face = scoreFace({ par, storedStrokes: strokes, storedPutts: puttCount, markCount: holeMarks.length });
  const lastClosed = [...holeMarks].reverse().find((mark) => mark.yards != null) ?? null;
  const missLine = plainMiss(
    calledId == null
      ? []
      : tagged.flatMap((shot) => {
          if (shot.clubId !== calledId) return [];
          if (shot.result !== 'left' && shot.result !== 'right' && shot.result !== 'fairway' && shot.result !== 'hazard' && shot.result !== 'short') return [];
          return [{ side: shot.result, sideYards: null as number | null }];
        }),
  );
  const longTotal = !onGreen && !short && totalStock ? longestWords(totalStock, unit) : null;
  const answered = debriefs.some((item) => item.hole === hole.holeNumber);
  const commitScore = () => {
    if (strokes == null && par != null) setStrokes(hole.holeNumber, par);
    if (puttCount == null) setPutts(hole.holeNumber, face.putts);
  };

  const advance = () => {
    if (hole.holeNumber >= 18) return;
    setCurrentHole(hole.holeNumber + 1);
  };

  const leaveHole = () => {
    commitScore();
    advance();
  };

  const goBack = () => {
    if (hole.holeNumber <= 1) return;
    setCurrentHole(hole.holeNumber - 1);
  };
  leaveRef.current = leaveHole;
  backRef.current = goBack;
  holeNo.current = hole.holeNumber;

  const markHere = () => {
    if (!player) return;
    const prior = [...holeMarks].reverse().find((mark) => mark.yards == null) ?? null;
    const closed = prior ? closeMarkedShot({ lat: prior.lat, lon: prior.lon }, player, polygons) : null;
    recordMark({
      hole: hole.holeNumber,
      lat: player.lat,
      lon: player.lon,
      clubId: calledId,
      clubLabel: calledLabel,
      close: closed,
    });
    const result = lieResult(closed?.lie ?? null);
    if (prior && closed && result && prior.clubId) {
      tagShot({
        hole: hole.holeNumber,
        clubId: prior.clubId,
        clubLabel: prior.clubLabel ?? prior.clubId,
        result,
        shownYards: closed.yards,
        carry: null,
        total: null,
        swingMode: 'unknown',
      });
    }
    setSaved(calledLabel ?? 'Marked');
    void celebrate();
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(null), 1400);
  };

  const heroText = roll != null ? String(Math.round(roll)) : heroBase == null ? '' : formatDistance(heroBase, unit);
  const showCard = calledLabel != null;

  return (
    <View style={styles.screen} onLayout={(event) => setMapH(Math.max(420, Math.round(event.nativeEvent.layout.height)))} {...pan.panHandlers}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: `Hole ${hole.holeNumber}` }} />
      <ClubPulse clubLabel={calledLabel} yards={callYards} />
      <View style={styles.mapLayer} pointerEvents="box-none">
        <HoleMap
          bleed
          height={mapH}
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={null}
          dispersionLine={dispersionLine}
          measure={[]}
          onTap={() => undefined}
          rawLabel=""
          playsLabel=""
        />
        <View pointerEvents="box-none" style={styles.mapHud}>
          <View style={styles.glassRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={() => router.push('/')} style={styles.glass}>
              <Text style={styles.glassText}>Home</Text>
            </Pressable>
            <View style={styles.glass}>
              <Text style={styles.glassText}>{`Hole ${hole.holeNumber}`}</Text>
            </View>
            <View style={styles.glass}>
              <Text style={styles.glassText}>{`Par ${par ?? '—'}`}</Text>
            </View>
            <View style={styles.glass}>
              <Text style={styles.glassText}>{`SI ${hole.strokeIndex ?? '—'}`}</Text>
            </View>
          </View>
          <Text style={styles.tiny} numberOfLines={1}>
            Open shapes. Satellite is on the phone.
          </Text>
        </View>
      </View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: rise }] }]}>
        <View style={styles.handle} />
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {ask.banner}
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.kicker}>Shot</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Shot yards"
                delayLongPress={450}
                onLongPress={() => {
                  if (player) return;
                  setOverrideDraft(manual == null ? '' : formatDistance(manual, unit));
                  setOverrideOpen(true);
                }}
              >
                {overrideOpen && !player ? (
                  <TextInput
                    value={overrideDraft}
                    onChangeText={setOverrideDraft}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={styles.hero}
                    accessibilityLabel="Manual yards"
                    onBlur={() => {
                      const accepted = acceptShotYards(Number(overrideDraft));
                      if (typeof accepted === 'number') setManualYards(hole.holeNumber, displayToYards(accepted, unit));
                      setOverrideOpen(false);
                    }}
                  />
                ) : (
                  <Text style={styles.hero}>{heroText}</Text>
                )}
              </Pressable>
              {!player && !overrideOpen ? <Text style={styles.quiet}>Hold the number if this phone has no position.</Text> : null}
            </View>
            {playsLikeYards != null ? (
              <View style={styles.playsCol}>
                <Text style={styles.kicker}>Plays like</Text>
                <Text style={styles.plays}>{formatDistance(playsLikeYards, unit)}</Text>
              </View>
            ) : null}
          </View>
          {ground ? (
            <View style={styles.ends}>
              <Text style={styles.end}>{`Front ${formatDistance(ground.frontYards, unit)}`}</Text>
              <Text style={styles.end}>{`Center ${formatDistance(ground.centerYards, unit)}`}</Text>
              <Text style={styles.end}>{`Back ${formatDistance(ground.backYards, unit)}`}</Text>
            </View>
          ) : null}
          {hazardYards != null ? <Text style={styles.quiet}>{`Hazard ${formatDistance(hazardYards, unit)}`}</Text> : null}
          {showCard ? (
            <View style={styles.clubCard}>
              <Text style={styles.club}>{calledLabel}</Text>
              {!onGreen ? (
                <Text style={styles.stock}>
                  {short
                    ? `Carry ${short.carryYards ?? '—'}`
                    : `Carry ${carryStock ? formatDistance(carryStock.stockYards, unit) : '—'}   Total ${totalStock ? formatDistance(totalStock.stockYards, unit) : '—'}`}
                </Text>
              ) : null}
              {gapYards != null && stockYards != null && callYards != null ? (
                <Text style={styles.gapLine}>
                  {gapYards === 0
                    ? `Even with the ${playsLikeYards != null ? 'plays-like' : 'shot'}.`
                    : `${gapYards} ${gapYards === 1 ? 'yard' : 'yards'} ${shownStock != null && shownTarget != null && shownStock > shownTarget ? 'long' : 'short'} of the ${playsLikeYards != null ? 'plays-like' : 'shot'}.`}
                </Text>
              ) : null}
              {card?.passedCloser ? <Text style={styles.quiet} numberOfLines={2}>{card.passedCloser}</Text> : null}
              {card && card.posture !== 'decline' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Why" onPress={() => setWhy(true)} style={styles.whyChip}>
                  <Text style={styles.whyChipText}>Why</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {layup?.call === 'lay_up' ? <Text style={styles.quiet}>{layup.reason}</Text> : null}
          {lastClosed ? (
            <Text style={styles.quiet}>
              {`Last ${formatDistance(lastClosed.yards ?? 0, unit)}${lastClosed.lie ? ` · ${lastClosed.lie}` : ''}`}
            </Text>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Mark shot" onPress={markHere} style={styles.mark}>
            <Text style={styles.markText}>Mark shot</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.pin}>
          <View style={styles.scoreRow}>
            <Text style={styles.pinLabel}>Score</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Score minus" onPress={() => face.strokes != null && setStrokes(hole.holeNumber, stepCount(face.strokes, -1, 1))} style={styles.step}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={[styles.score, !face.strokesConfirmed && styles.pending]}>{face.strokes ?? ''}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Score plus" onPress={() => face.strokes != null && setStrokes(hole.holeNumber, stepCount(face.strokes, 1, 1))} style={styles.step}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
            {!face.strokesConfirmed || !face.puttsConfirmed ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Confirm score" onPress={commitScore} style={styles.confirm}>
                <Text style={styles.confirmText}>Confirm</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.pinLabel}>Putts</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Putt minus" onPress={() => setPutts(hole.holeNumber, stepCount(face.putts, -1, 0))} style={styles.step}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={[styles.score, !face.puttsConfirmed && styles.pending]}>{face.putts}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Putt plus" onPress={() => setPutts(hole.holeNumber, stepCount(face.putts, 1, 0))} style={styles.step}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
            {face.blowUp && !answered && strokes != null && par != null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Note the hole"
                onPress={() => {
                  setDebrief({
                    hole: hole.holeNumber,
                    choice: 'swing',
                    note: debriefNote('swing', { hole: hole.holeNumber, strokes, par, over: strokes - par }),
                  });
                  setSaved('Noted');
                }}
                style={styles.confirm}
              >
                <Text style={styles.confirmText}>Note the hole</Text>
              </Pressable>
            ) : (
              <Text style={styles.tinyPad}>Not added to the score.</Text>
            )}
          </View>
          {face.suggestion != null && face.suggestion !== face.strokes ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Use mark count" onPress={() => setStrokes(hole.holeNumber, face.suggestion!)}>
              <Text style={styles.quiet}>{`${face.suggestion} from marks`}</Text>
            </Pressable>
          ) : null}
          {hole.holeNumber === 18 && face.strokesConfirmed ? (
            <Text style={styles.pinLabel}>{score.holesEntered === 0 ? 'Round is in.' : `Round is in. Gross ${score.gross}.`}</Text>
          ) : null}
        </View>
        {ask.undo}
        {ask.button}
      </Animated.View>
      {why && card ? (
        <Pressable style={styles.scrim} onPress={() => setWhy(false)} accessibilityRole="button" accessibilityLabel="Hide why">
          <Pressable style={styles.whySheet} onPress={() => undefined}>
            <Text style={styles.kicker}>Why</Text>
            <Text style={styles.whyBody}>{card.lines.reason}</Text>
            {carryStock ? <Text style={styles.whyBody}>{carryWords(carryStock, unit)}</Text> : null}
            {calledId && !carryStock ? <Text style={styles.whyBody}>Carry was not measured.</Text> : null}
            {longTotal ? <Text style={styles.whyBody}>{longTotal}</Text> : null}
            {missLine ? <Text style={styles.whyBody}>{missLine}</Text> : null}
          </Pressable>
        </Pressable>
      ) : null}
      {saved ? (
        <View pointerEvents="none" style={styles.savedWrap}>
          <View style={styles.saved}>
            <Text style={styles.savedKicker}>Marked</Text>
            <Text style={styles.savedTitle}>{saved}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ClubPulse({ clubLabel, yards }: { clubLabel: string | null; yards: number | null }) {
  useEffect(() => {
    if (!clubLabel || yards == null) return;
    void pulse(1);
  }, [clubLabel, yards]);
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: field.bg },
  mapLayer: { ...StyleSheet.absoluteFill },
  mapHud: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 54, paddingHorizontal: 16, gap: 8 },
  glassRow: { flexDirection: 'row', gap: 8 },
  glass: {
    backgroundColor: field.glass,
    borderColor: field.line,
    borderWidth: 1,
    borderRadius: radius.chip,
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassText: { color: field.ink, fontFamily: font.family, fontSize: 15, fontWeight: '700' },
  tiny: { color: 'rgba(244,247,251,0.72)', fontSize: 11, marginTop: 4 },
  sheet: {
    marginTop: 'auto',
    maxHeight: '72%',
    backgroundColor: field.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginTop: 8 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  heroCol: { flex: 1.3 },
  playsCol: { flex: 0.9, alignItems: 'flex-end' },
  kicker: { color: field.muted, fontFamily: font.family, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  hero: {
    color: field.live,
    fontFamily: font.family,
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 76,
    fontVariant: ['tabular-nums'],
    padding: 0,
    minHeight: touch,
  },
  plays: { color: field.ink, fontFamily: font.family, fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  quiet: { color: field.muted, fontFamily: font.family, fontSize: 14, lineHeight: 20 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { color: field.ink, fontFamily: font.family, fontSize: 15, fontWeight: '700' },
  clubCard: {
    backgroundColor: field.card,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: field.line,
  },
  whyChip: {
    alignSelf: 'flex-start',
    minHeight: 36,
    marginTop: 4,
    paddingHorizontal: 16,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: field.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyChipText: { color: field.ink, fontFamily: font.family, fontSize: 15, fontWeight: '700' },
  club: { color: field.ink, fontFamily: font.family, fontSize: 32, fontWeight: '700', letterSpacing: -0.4 },
  stock: { color: field.ink, fontFamily: font.family, fontSize: 17, fontWeight: '600' },
  gapLine: { color: field.ink, fontFamily: font.family, fontSize: 15, lineHeight: 21 },
  mark: {
    minHeight: touch,
    borderRadius: 16,
    backgroundColor: field.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: field.bg, fontFamily: font.family, fontSize: 18, fontWeight: '700' },
  pin: {
    borderTopWidth: 1,
    borderTopColor: field.line,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
    backgroundColor: field.sheet,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinLabel: { color: field.ink, fontFamily: font.family, fontSize: 13, fontWeight: '700', width: 48 },
  score: { color: field.ink, fontFamily: font.family, fontSize: 28, fontWeight: '700', minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] },
  pending: { color: field.muted },
  step: {
    minWidth: touch,
    minHeight: touch,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: field.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: field.ink, fontFamily: font.family, fontSize: 22, fontWeight: '700' },
  confirm: {
    minHeight: touch,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: field.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: field.bg, fontFamily: font.family, fontSize: 16, fontWeight: '700' },
  tinyPad: { color: field.muted, fontSize: 11, flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  whySheet: {
    backgroundColor: field.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: 24,
    gap: 12,
    minHeight: 220,
  },
  whyBody: { color: field.ink, fontFamily: font.family, fontSize: 17, lineHeight: 24 },
  savedWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  saved: {
    backgroundColor: field.card,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: field.line,
  },
  savedKicker: { color: field.live, fontFamily: font.family, fontSize: 13, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  savedTitle: { color: field.ink, fontFamily: font.family, fontSize: 40, fontWeight: '700', marginTop: 4 },
});
