import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { font, play as field, type } from '@coopr/tokens';
import {
  acceptShotYards,
  arrivedAtNextTee,
  classifyFinish,
  closeMarkedShot,
  debriefNote,
  destinationPoint,
  displayToYards,
  formatDistance,
  gpsPreset,
  greenTargets,
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
  taggedHazardLine,
  playsLike,
  SAMPLE_PATTERN,
  PATTERN_INVITE,
  CONFIDENCE_LOW,
  caddieLine,
  confidenceLabel,
  confidencePercent,
  dispersionOval,
  ellipseRing,
  flightArc,
  leanedLanding,
  patternColor,
  patternSafety,
  playsLikeChips,
  riskCall,
  thruScore,
  WEDGE_LENGTHS,
  type DistanceProfile,
  type DispersionOval,
  type DistanceUnit,
  type FinishLie,
  type MissMark,
  type WalkPolygons,
  type WedgeLength,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { HoleMap } from '../src/hole-map';
import { celebrate, holeFeel, pulse, tick } from '../src/haptics';
import { holeSwipe, rollSteps } from '../src/design/motion';
import { clubFigure, clubWhy, holeEnter, holeFrame, holeShift, scoreGlance, sheetSnap } from '../src/design/play-polish';
import { Glass, Vignette } from '../src/design/glass';
import { ClubStrip, ConfidenceRing, ThruBar } from '../src/design/signature-ui';
import { useReduceMotion } from '../src/design/reduce-motion';
import { CountChip } from '../src/design/count-chip';
import { holeLabels } from '../src/map-labels';
import { subscribeGps } from '../src/gps-fix';
import { readWeather, type WeatherRead } from '../src/weather';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { useAskCoopr } from '../src/ask-coopr';

const pilot = loadHighCedarsPilot();
const SHEET_CLOSED = 200;
const SHEET_OPEN = 420;
const SHEET_SPRING = { damping: 18, stiffness: 190, mass: 0.75 };

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

function measuredProfile(profiles: readonly DistanceProfile[], clubId: string | null): DistanceProfile | null {
  if (!clubId) return null;
  const mine = profiles.filter((profile) => profile.clubId === clubId && !profile.reported);
  const totals = mine.filter((profile) => profile.metric === 'total');
  const pool = totals.length > 0 ? totals : mine;
  return [...pool].sort((a, b) => Number(b.dispersionKnown) - Number(a.dispersionKnown) || b.sampleSize - a.sampleSize)[0] ?? null;
}

function carryBand(profile: DistanceProfile | null, unit: DistanceUnit): string | null {
  if (!profile?.dispersionKnown) return null;
  return `${formatDistance(profile.p20, unit)}–${formatDistance(profile.p80, unit)}`;
}

function lieResult(lie: FinishLie | null): LandingResult | null {
  if (lie == null) return null;
  return lie;
}

export default function PlayScreen() {
  const {
    clubs,
    profiles,
    personality,
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
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [mapH, setMapH] = useState(844);
  const [dockH, setDockH] = useState(96);
  const [hudH, setHudH] = useState(196);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState(false);
  const [sampleOn, setSampleOn] = useState(false);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const mapX = useSharedValue(0);
  const mapScale = useSharedValue(1);
  const mapFade = useSharedValue(1);
  const sheetX = useSharedValue(0);
  const sheetH = useSharedValue(SHEET_CLOSED);
  const sheetDrag = useSharedValue(0);
  const sheetOpenRef = useRef(false);
  const seenHole = useRef<number | null>(null);
  const rolledFrom = useRef<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef<() => void>(() => {});
  const backRef = useRef<() => void>(() => {});
  const holeNo = useRef(1);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setSampleOn(localStorage.getItem('coopr.sample.signature') === '1');
    setBreakdown(localStorage.getItem('coopr.ui.breakdown') === '1');
    const scrub = localStorage.getItem('coopr.ui.scrub');
    if (scrub != null && /^\d+$/.test(scrub)) setScrubIndex(Number(scrub));
  }, []);
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
  const applySheet = useRef<(open: boolean) => void>(() => {});
  applySheet.current = (open: boolean) => {
    sheetOpenRef.current = open;
    setSheetOpen(open);
    sheetDrag.value = 0;
    sheetH.value = withSpring(open ? SHEET_OPEN : SHEET_CLOSED, SHEET_SPRING);
    void tick();
  };
  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_, gesture) => {
        sheetDrag.value = gesture.dy;
      },
      onPanResponderRelease: (_, gesture) => {
        const visual = Math.min(SHEET_OPEN + 28, Math.max(96, sheetH.value - gesture.dy));
        sheetDrag.value = 0;
        sheetH.value = visual;
        const dir = holeSwipe(gesture.dx, gesture.dy, holeNo.current);
        if (dir === 'next') {
          leaveRef.current();
          return;
        }
        if (dir === 'prev') {
          backRef.current();
          return;
        }
        if (Math.abs(gesture.dy) < 16 && Math.abs(gesture.dx) < 16) {
          applySheet.current(!sheetOpenRef.current);
          return;
        }
        applySheet.current(sheetSnap(sheetOpenRef.current, gesture.dy, gesture.vy));
      },
      onPanResponderTerminate: () => {
        sheetDrag.value = 0;
      },
    }),
  ).current;

  const overlay = hole ? holeOverlay(pilot.features, pilot.record.scorecard, hole.holeNumber) : null;
  const greenRing = overlay?.green?.rings[0] ?? null;
  const ground = player && greenRing ? greenYardsFrom(player, greenRing) : null;
  const manual = hole ? manualYards[hole.holeNumber] ?? null : null;
  const shotYards = player ? ground?.centerYards ?? null : manual;
  const stripClubs = clubs.filter((club) => club.slot === 'in_play' && !/putter/i.test(club.label));
  const scrubClub = scrubIndex != null && stripClubs.length > 0 ? stripClubs[Math.min(scrubIndex, stripClubs.length - 1)] ?? null : null;
  const scrubProfile = scrubClub ? measuredProfile(profiles, scrubClub.id) : null;
  const focusedRaw = scrubProfile?.stockYards ?? shotYards;
  const focusedPlay =
    !conditions.usePlaysLike || focusedRaw == null
      ? null
      : playsLike({
          rawYards: focusedRaw,
          headwindMph: sky?.headwindMph ?? null,
          elevationFeet: sky?.elevationFeet ?? null,
          temperatureF: sky?.current?.temperatureF ?? null,
        });
  const focusedPlays = focusedPlay && !('error' in focusedPlay) ? focusedPlay.playsLikeYards : null;
  const focusedChips = focusedPlay && !('error' in focusedPlay) ? playsLikeChips(focusedPlay) : null;
  const heroBase = focusedPlays != null ? Math.round(focusedPlays) : focusedRaw == null ? null : Math.round(focusedRaw);
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

  const bannerOn = ask.banner != null;
  useEffect(() => {
    if (!bannerOn) return;
    sheetOpenRef.current = true;
    setSheetOpen(true);
    sheetH.value = withSpring(SHEET_OPEN, SHEET_SPRING);
  }, [bannerOn, sheetH]);

  useEffect(() => {
    setOverrideOpen(false);
    setSaved(null);
    setSky(null);
    sheetOpenRef.current = false;
    setSheetOpen(false);
    sheetDrag.value = 0;
    sheetH.value = SHEET_CLOSED;
  }, [currentHole, sheetDrag, sheetH]);

  useLayoutEffect(() => {
    const previous = seenHole.current;
    seenHole.current = currentHole;
    if (previous == null) return;
    const enter = holeEnter(holeShift(previous, currentHole));
    if (enter.map === 0) return;
    mapX.value = enter.map;
    mapScale.value = 1.04;
    sheetX.value = enter.sheet;
    mapFade.value = 0.72;
    if (reduceMotion) {
      mapX.value = 0;
      mapScale.value = 1;
      sheetX.value = 0;
      mapFade.value = 1;
    } else {
      mapX.value = withSpring(0, SHEET_SPRING);
      mapScale.value = withSpring(1, SHEET_SPRING);
      sheetX.value = withSpring(0, SHEET_SPRING);
      mapFade.value = withTiming(1, { duration: 420 });
    }
    void holeFeel();
  }, [currentHole, mapFade, mapScale, mapX, reduceMotion, sheetX]);

  const mapStyle = useAnimatedStyle(() => ({
    opacity: mapFade.value,
    transform: [{ translateX: mapX.value }, { scale: mapScale.value }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: Math.min(SHEET_OPEN + 28, Math.max(96, sheetH.value - sheetDrag.value)),
    transform: [{ translateX: sheetX.value }],
  }));

  useEffect(() => {
    if (heroBase == null) {
      rolledFrom.current = null;
      setRoll(null);
      return;
    }
    const from = rolledFrom.current;
    rolledFrom.current = heroBase;
    if (reduceMotion || from == null || from === heroBase) {
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
  }, [heroBase, reduceMotion]);

  useEffect(() => {
    const geometry = holeOverlay(pilot.features, pilot.record.scorecard, currentHole);
    const ring = geometry.green?.rings[0] ?? null;
    return subscribeGps((fix) => {
      setPlayer((current) => {
        if (fix == null) return current == null ? current : null;
        if (current && current.lat === fix.lat && current.lon === fix.lon) return current;
        return fix;
      });
    }, (stored) => (typeof stored === 'string' ? gpsPreset(stored, geometry.line, ring) : stored));
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
  const hazard = taggedHazardLine(pilot.features, hole.holeNumber, player);
  voiceClub.current = {
    clubId: calledId,
    clubLabel: calledLabel ?? 'Shot',
    carryToClearYards: hazard?.yards ?? null,
    carry: carryStock,
  };
  const layup = !shortMode && !onGreen && hazard ? layupDecision({ carry: carryStock, carryToClearYards: hazard.yards }) : null;
  const hazardYards = player ? nearestHazardYards(player, [...polygons.hazards, ...polygons.bunkers]) : null;
  const shownId = scrubClub?.id ?? calledId;
  const shownLabel = scrubClub ? scrubClub.label.split('·')[0]?.trim() || scrubClub.label : calledLabel;
  voiceClub.current = { ...voiceClub.current, clubId: shownId, clubLabel: shownLabel ?? 'Shot' };
  const shownProfile = measuredProfile(profiles, shownId);
  const bearing = shotBearing(overlay.line);
  const oval: DispersionOval | null = sampleOn ? dispersionOval([...SAMPLE_PATTERN]) : null;
  const landingYards = focusedPlays ?? focusedRaw;
  const origin = player ?? overlay.line[0] ?? null;
  const landing = origin && bearing != null && landingYards != null && landingYards > 0 ? destinationPoint(origin, bearing, landingYards) : null;
  const hazardRings = [...polygons.hazards, ...polygons.bunkers];
  const measuredCenter = oval && landing && bearing != null ? destinationPoint(landing, bearing + 90, oval.meanLateralYards) : landing;
  const safety = oval && measuredCenter && bearing != null ? patternSafety(measuredCenter, bearing, oval, hazardRings) : null;
  const risk = measuredCenter && bearing != null ? riskCall(measuredCenter, bearing, hazardRings) : null;
  const ovalCenter = measuredCenter && bearing != null && oval ? leanedLanding(measuredCenter, bearing, risk?.lean ?? null) : null;
  const ellipse = oval && ovalCenter && bearing != null ? ellipseRing(ovalCenter, bearing, oval.carryStdYards, oval.lateralStdYards, 36, oval.biasDeg) : null;
  const flight = origin && landing ? flightArc(origin, landing) : null;
  const percent = shownProfile
    ? confidencePercent({
        sampleSize: shownProfile.sampleSize,
        iqr: shownProfile.iqr,
        stockYards: shownProfile.stockYards,
        dispersionKnown: shownProfile.dispersionKnown,
        windKnown: focusedPlay != null && !('error' in focusedPlay) && focusedPlay.wind != null,
        elevationKnown: focusedPlay != null && !('error' in focusedPlay) && focusedPlay.elevation != null,
        temperatureKnown: focusedPlay != null && !('error' in focusedPlay) && focusedPlay.temperature != null,
      })
    : null;
  const lowConfidence = percent != null && percent < CONFIDENCE_LOW;
  const oneLiner = caddieLine({
    personality,
    clubLabel: shownLabel,
    windYards: focusedPlay && !('error' in focusedPlay) ? focusedPlay.wind?.yards ?? null : null,
    stockYards: shownProfile?.stockYards ?? stockYards,
    targetYards: shotYards,
    lowConfidence,
  });
  const band = carryBand(shownProfile, unit);
  const patternLine =
    !onGreen && oval
      ? `${sampleOn ? 'Sample pattern · ' : ''}±${oval.carryStdYards} × ±${oval.lateralStdYards} yd`
      : !onGreen
        ? PATTERN_INVITE
        : null;
  const windMph = sky?.current?.windMph;
  const windKnown = windMph != null && Number.isFinite(windMph);
  const windText = windKnown ? String(Math.round(windMph)) : '?';
  const thru = thruScore(pilot.quality.map((item) => ({ par: item.par, strokes: holes[item.holeNumber - 1] ?? null, kept: holes[item.holeNumber - 1] != null })));
  const dispersionLine: LatLon[] = [];
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
    const keeping = strokes ?? par;
    const already = strokes != null;
    commitScore();
    if (!already && keeping != null && par != null && keeping <= par) void celebrate();
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
  const figure = clubFigure(scrubClub ? focusedPlays : playsLikeYards, scrubClub ? focusedRaw : shotYards, scrubClub ? false : player != null);
  const whyLine = clubWhy({
    layupReason: layup?.call === 'lay_up' ? layup.reason : null,
    stockYards: calledId ? stockYards : null,
    targetYards: callYards,
    playsLike: playsLikeYards != null,
    unit,
  });
  const greenMarks = player && greenRing ? greenTargets(player, greenRing) : null;
  const centerLive = player != null;
  const writeStrokes = (next: number) => {
    setStrokes(hole.holeNumber, next);
    if (scoreGlance(next, par, true).motion) void celebrate();
  };
  const writePutts = (next: number) => {
    setPutts(hole.holeNumber, next);
  };

  return (
    <View
      style={styles.screen}
      onLayout={(event) => setMapH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}
    >
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: `Hole ${hole.holeNumber}` }} />
      <ClubPulse clubLabel={shownLabel} yards={landingYards} />
      <Animated.View {...pan.panHandlers} style={[styles.mapWrap, mapStyle]}>
        <HoleMap
          bleed
          height={mapH}
          pad={holeFrame({ hudHeight: hudH, dockHeight: dockH, sheetClosed: SHEET_CLOSED })}
          orient={bearing != null && overlay.line[0] ? { bearing, origin: overlay.line[0] } : null}
          labels={holeLabels(
            overlay.line,
            unit,
            landing && landingYards != null ? { at: landing, label: formatDistance(landingYards, unit) } : null,
          )}
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={ellipse}
          ellipseColor={safety ? patternColor(safety) : null}
          flight={flight}
          reduceMotion={reduceMotion}
          dispersionLine={dispersionLine}
          measure={[]}
          marks={greenMarks}
          onTap={() => undefined}
          rawLabel=""
          playsLabel=""
        />
        <Vignette />
      </Animated.View>
      <View
        pointerEvents="box-none"
        onLayout={(event) => setHudH(Math.max(64, Math.round(event.nativeEvent.layout.height)))}
        style={[styles.hud, { paddingTop: insets.top + 8 }]}
      >
        <View
          {...pan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={`Hole ${hole.holeNumber}, par ${par ?? 'unknown'}, stroke index ${hole.strokeIndex ?? 'unknown'}`}
          accessibilityHint="Swipe left for the next hole. Swipe right for the previous hole."
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') leaveRef.current();
            if (event.nativeEvent.actionName === 'decrement') backRef.current();
          }}
        >
          <Glass radius={24} style={styles.header} contentStyle={styles.headerFill}>
            <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={() => router.push('/')} style={({ pressed }) => [styles.backHit, pressed && !reduceMotion && styles.pressed]}>
              <View style={styles.chevron} />
            </Pressable>
            <View style={styles.headerMid}>
              <Text style={styles.headerTitle}>{`Hole ${hole.holeNumber} · Par ${par ?? '—'}`}</Text>
              <ThruBar label={thru.label} pips={thru.pips} />
            </View>
            <Text style={styles.headerSi}>{`SI ${hole.strokeIndex ?? '—'}`}</Text>
          </Glass>
        </View>
        <View style={styles.pillRow}>
          <Glass radius={28} style={styles.pill} contentStyle={styles.pillFill}>
            <View style={styles.ends}>
              <End label="Front" value={ground ? formatDistance(ground.frontYards, unit) : ''} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Shot yards"
                delayLongPress={450}
                onLongPress={() => {
                  if (player) return;
                  setOverrideDraft(manual == null ? '' : formatDistance(manual, unit));
                  setOverrideOpen(true);
                }}
                style={({ pressed }) => [styles.centerHit, pressed && !reduceMotion && styles.pressed]}
              >
                <Text style={styles.endLabel}>{focusedPlays != null ? 'Plays like' : centerLive ? 'Center' : 'Yards'}</Text>
                {focusedPlays != null && focusedRaw != null ? <Text style={styles.struck}>{formatDistance(focusedRaw, unit)}</Text> : null}
                {overrideOpen && !player ? (
                  <TextInput
                    value={overrideDraft}
                    onChangeText={setOverrideDraft}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={[styles.centerNum, styles.centerInput]}
                    accessibilityLabel="Manual yards"
                    onBlur={() => {
                      const accepted = acceptShotYards(Number(overrideDraft));
                      if (typeof accepted === 'number') setManualYards(hole.holeNumber, displayToYards(accepted, unit));
                      setOverrideOpen(false);
                    }}
                  />
                ) : (
                  <Text style={[styles.centerNum, focusedPlays != null ? styles.glow : centerLive && styles.centerLive]}>{heroText}</Text>
                )}
              </Pressable>
              <End label="Back" value={ground ? formatDistance(ground.backYards, unit) : ''} />
            </View>
          </Glass>
          <View style={styles.windSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={windKnown ? `Wind ${windText} miles per hour` : 'Wind unknown'}
              onPress={() => setBreakdown((open) => !open)}
              style={({ pressed }) => [pressed && !reduceMotion && styles.pressed]}
            >
              <Glass radius={22} style={styles.windPill} contentStyle={styles.windFill}>
                <WindMark />
                <Text style={styles.windNum}>{windText}</Text>
              </Glass>
            </Pressable>
            {breakdown ? (
              <View style={styles.chips}>
                <Text style={styles.chip}>{focusedChips?.wind ?? 'Wind ?'}</Text>
                <Text style={styles.chip}>{focusedChips?.elevation ?? 'Elev ?'}</Text>
                <Text style={styles.chip}>{focusedChips?.temperature ?? 'Temp ?'}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {hazardYards != null ? (
          <Glass radius={24} style={styles.hazard} contentStyle={styles.hazardFill}>
            <Text style={styles.hint}>{`Hazard ${formatDistance(hazardYards, unit)}`}</Text>
          </Glass>
        ) : null}
      </View>
      <Animated.View style={[styles.sheet, sheetStyle, { bottom: dockH + 8 }]}>
        <Glass radius={28} style={styles.sheetGlass} contentStyle={styles.sheetFill}>
          <View style={styles.grab}>
            <View {...sheetPan.panHandlers} style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
            <View style={[styles.clubRow, lowConfidence && styles.dim]} accessibilityLabel={shownLabel ? confidenceLabel(shownLabel, percent) : 'Club'}>
              <ConfidenceRing percent={percent} />
              <View style={styles.clubCopy}>
                <Text style={styles.clubName} numberOfLines={1}>
                  {shownLabel ?? ''}
                </Text>
                {percent != null ? <Text style={styles.clubMeta}>{`${percent}%`}</Text> : null}
                {band ? <Text style={styles.clubMeta}>{band}</Text> : null}
              </View>
            </View>
            {oneLiner ? <Text style={styles.line}>{oneLiner}</Text> : null}
            {risk ? <Text style={styles.line}>{risk.line}</Text> : null}
            <ClubStrip
              clubs={stripClubs.map((club) => ({ id: club.id, label: club.label }))}
              index={stripClubs.findIndex((club) => club.id === shownId)}
              band={null}
              onIndex={setScrubIndex}
              onOpen={() => applySheet.current(!sheetOpenRef.current)}
            />
            {patternLine ? <Text style={styles.sample}>{patternLine}</Text> : null}
          </View>
          {sheetOpen ? (
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsBody} keyboardShouldPersistTaps="handled">
            {figure ? <Text style={styles.body}>{`${figure.label} ${formatDistance(figure.yards, unit)}`}</Text> : null}
            {whyLine ? <Text style={styles.body}>{whyLine}</Text> : null}
            {ask.banner ? <View>{ask.banner}</View> : null}
            {card ? <Text style={styles.body}>{card.lines.reason}</Text> : null}
            {carryStock ? <Text style={styles.body}>{carryWords(carryStock, unit)}</Text> : null}
            {calledId && !carryStock ? <Text style={styles.body}>Carry was not measured.</Text> : null}
            {longTotal ? <Text style={styles.body}>{longTotal}</Text> : null}
            {missLine ? <Text style={styles.body}>{missLine}</Text> : null}
            <Text style={styles.body}>Putts stay off the score.</Text>
            <CountChip value={face.putts} confirmed={face.puttsConfirmed} par={null} floor={0} idleLabel="Putts" onWrite={writePutts} />
            {face.suggestion != null && face.suggestion !== face.strokes ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use mark count"
                onPress={() => setStrokes(hole.holeNumber, face.suggestion!)}
                style={styles.textHit}
              >
                <Text style={styles.body}>{`${face.suggestion} from your marks`}</Text>
              </Pressable>
            ) : null}
            {lastClosed ? (
              <Text style={styles.body}>{`Last shot ${formatDistance(lastClosed.yards ?? 0, unit)}${lastClosed.lie ? `, ${lastClosed.lie}` : ''}`}</Text>
            ) : null}
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
                style={styles.textHit}
              >
                <Text style={styles.body}>Note the hole</Text>
              </Pressable>
            ) : null}
            {hole.holeNumber === 18 && face.strokesConfirmed ? (
              <Text style={styles.body}>{score.holesEntered === 0 ? 'Round is in.' : `Round is in. Gross ${score.gross}.`}</Text>
            ) : null}
          </ScrollView>
          ) : null}
        </Glass>
      </Animated.View>
      <View
        style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) }]}
        onLayout={(event) => setDockH(Math.max(80, Math.round(event.nativeEvent.layout.height)))}
      >
        {ask.undo}
        <View style={styles.dockRow}>
          <CountChip minHeight={64} value={face.strokes} confirmed={face.strokesConfirmed} par={par} floor={1} idleLabel="Score" onWrite={writeStrokes} />
          <Pressable accessibilityRole="button" accessibilityLabel="Mark shot" onPress={markHere} style={({ pressed }) => [styles.markHit, pressed && !reduceMotion && styles.pressed]}>
            <Glass radius={24} style={styles.mark} contentStyle={styles.markFill}>
              <Text style={styles.markText}>Mark shot</Text>
            </Glass>
          </Pressable>
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.askFloat, { bottom: Math.max(insets.bottom, 12) }]}>
        {ask.button}
      </View>
      {saved ? (
        <View pointerEvents="none" style={styles.savedWrap}>
          <Glass radius={28} style={styles.saved} contentStyle={styles.savedFill}>
            <Text style={styles.kicker}>Marked</Text>
            <Text style={styles.savedTitle}>{saved}</Text>
          </Glass>
        </View>
      ) : null}
    </View>
  );
}

function WindMark() {
  return (
    <View style={styles.wind}>
      <View style={styles.windLine} />
      <View style={styles.windLineShort} />
      <View style={styles.windLine} />
    </View>
  );
}

function End({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.endCol} accessibilityLabel={value ? `${label} ${value}` : label}>
      <Text style={styles.endLabel}>{label}</Text>
      <Text style={styles.endNum}>{value}</Text>
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
  screen: { flex: 1, backgroundColor: '#0C2418', overflow: 'hidden' },
  mapWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0C2418' },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 8 },
  pressed: { transform: [{ scale: 0.96 }] },
  header: { minHeight: 64 },
  headerFill: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingRight: 16, gap: 4 },
  backHit: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerMid: { flex: 1, gap: 2 },
  headerTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.club, lineHeight: 28, fontWeight: font.bold },
  headerSi: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold },
  pillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pill: { flex: 1 },
  pillFill: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10, gap: 2 },
  windSlot: { position: 'relative' },
  windPill: { minHeight: 56, minWidth: 56 },
  windFill: { minHeight: 56, minWidth: 72, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  wind: { width: 22, height: 16, justifyContent: 'space-between' },
  windLine: { height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  windLineShort: { height: 2, width: 14, borderRadius: 1, backgroundColor: '#FFFFFF' },
  windNum: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ends: { flexDirection: 'row', alignItems: 'flex-end' },
  endCol: { flex: 1, alignItems: 'center', minHeight: 64, justifyContent: 'flex-end' },
  centerHit: { flex: 1.45, alignItems: 'center', minHeight: 84, justifyContent: 'flex-end' },
  endLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold },
  endNum: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: type.club,
    lineHeight: 28,
    fontWeight: font.bold,
    fontVariant: ['tabular-nums'],
    minHeight: 28,
    textShadowColor: 'rgba(11,31,58,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  centerNum: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: type.hero,
    lineHeight: 60,
    fontWeight: font.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 88,
    padding: 0,
    textShadowColor: 'rgba(11,31,58,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  centerInput: { minWidth: 108 },
  centerLive: { color: field.live },
  struck: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: font.family,
    fontSize: type.body,
    lineHeight: 22,
    fontWeight: '700',
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  glow: {
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  hint: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, textAlign: 'center' },
  chips: { position: 'absolute', top: 292, right: 0, width: 136, gap: 8, zIndex: 8, alignItems: 'flex-end' },
  chip: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: type.caption,
    lineHeight: 18,
    fontWeight: font.semibold,
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(11,31,58,0.88)',
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hazard: { alignSelf: 'center' },
  hazardFill: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  sheet: { position: 'absolute', left: 12, right: 12, overflow: 'hidden' },
  sheetGlass: { flex: 1 },
  sheetFill: { flex: 1 },
  grab: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 2 },
  handleHit: { minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.72)' },
  clubRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubCopy: { flex: 1, gap: 0 },
  clubName: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.club, lineHeight: 28, fontWeight: font.bold },
  clubMeta: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  line: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, fontWeight: font.medium },
  sample: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.55 },
  kicker: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  details: { flex: 1 },
  detailsBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  body: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  textHit: { minHeight: 56, justifyContent: 'center' },
  dock: { position: 'absolute', left: 12, right: 108, bottom: 0, gap: 8 },
  dockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  askFloat: { position: 'absolute', right: 12, zIndex: 6 },
  markHit: { flex: 1, minHeight: 64 },
  mark: { flex: 1, minHeight: 64 },
  markFill: { minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  markText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  quiet: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, padding: 24 },
  savedWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  saved: { minWidth: 200 },
  savedFill: { paddingVertical: 28, paddingHorizontal: 32, alignItems: 'center', gap: 4 },
  savedTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 40, lineHeight: 46, fontWeight: '700' },
});
