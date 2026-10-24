import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { colors, font, motion, play as field, type } from '@coopr/tokens';
import {
  acceptShotYards,
  arrivedAtNextTee,
  classifyFinish,
  closeMarkedShot,
  debriefNote,
  destinationPoint,
  displayToYards,
  formatDistance,
  distanceYards,
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
  NEXT_TEE_YARDS,
  proactiveCallout,
  SAMPLE_PATTERN,
  PATTERN_INVITE,
  CONFIDENCE_LOW,
  confidenceLabel,
  confidencePercent,
  dispersionOval,
  ellipseRing,
  flightAlongLine,
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
import { boom, celebrate, holeFeel, pulse, tick } from '../src/haptics';
import { holeSwipe, rollSteps } from '../src/design/motion';
import { CLOSED_CARD, clubFigure, closedPlaySheet, clubWhy, greenMarkLabel, holeEnter, holeFrame, holeShift, mapHudInset, patternCaption, scoreGlance, scoreMoment, scoreStamp, sheetSnap, SHOT_LOG_TIP } from '../src/design/play-polish';
import { caddieVoiceLine } from '../src/design/caddie-voice';
import { useDisplayFace } from '../src/design/display-font';
import { MomentOverlay } from '../src/design/moments';
import { fieldNavy } from '../src/design/theme';
import { Glass, Vignette } from '../src/design/glass';
import { ClubStrip, ThruBar } from '../src/design/signature-ui';
import { useReduceMotion } from '../src/design/reduce-motion';
import { CountChip } from '../src/design/count-chip';
import { lineLengthYards, PAST_STOCK_YARDS, pointAtYards, TEE_SHOT_MARKS, teeWindowYards } from '../src/hole-fit';
import { holeLabels, marksAt } from '../src/map-labels';
import { subscribeGps } from '../src/gps-fix';
import { readWeather, type WeatherRead } from '../src/weather';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { useAskCoopr } from '../src/ask-coopr';
import { caddieSpeaker, speakSentences } from '../src/speech/tts';
import { useTalkCaddie, Waveform, YardageLine } from '../src/talk-overlay';
import { courseCall, holeSubline } from '../src/design/home-copy';
import { VECTOR_TILE_SOURCE } from '../src/tile-source';
import { useTalkPrefs } from '../src/talk-prefs';

const pilot = loadHighCedarsPilot();
const SHEET_CLOSED = CLOSED_CARD;
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
    voice,
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<'course' | 'coach' | 'stats'>('coach');
  const [clock, setClock] = useState(() => Date.now());
  const lineClock = useRef({ key: '', at: Date.now() });
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [sampleOn, setSampleOn] = useState(false);
  const [fullHole, setFullHole] = useState(false);
  const reduceMotion = useReduceMotion();
  const display = useDisplayFace();
  const [stamp, setStamp] = useState<ReturnType<typeof scoreStamp>>(null);
  const [consolation, setConsolation] = useState(false);
  const bump = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const mapX = useSharedValue(0);
  const mapScale = useSharedValue(1);
  const mapFade = useSharedValue(1);
  const sheetX = useSharedValue(0);
  const sheetH = useSharedValue(SHEET_CLOSED);
  const sheetDrag = useSharedValue(0);
  const sheetOpenRef = useRef(false);
  const closedSheetRef = useRef(SHEET_CLOSED);
  const seenHole = useRef<number | null>(null);
  const rolledFrom = useRef<number | null>(null);
  const rollHole = useRef<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef<() => void>(() => {});
  const backRef = useRef<() => void>(() => {});
  const holeNo = useRef(1);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setSampleOn(localStorage.getItem('coopr.sample.signature') === '1');
    const scrub = localStorage.getItem('coopr.ui.scrub');
    if (scrub != null && /^\d+$/.test(scrub)) setScrubIndex(Number(scrub));
  }, []);
  const advanced = useRef(0);
  const openTalk = useRef<() => void>(() => {});
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
    onAsk: () => openTalk.current(),
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
    setFullHole(false);
    sheetDrag.value = 0;
    sheetH.value = closedSheetRef.current;
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
  const bumpStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bump.value }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: Math.min(SHEET_OPEN + 28, Math.max(96, sheetH.value - sheetDrag.value)),
    transform: [{ translateX: sheetX.value }],
  }));

  useEffect(() => {
    if (heroBase == null) {
      setRoll(null);
      return;
    }
    const arriving = rollHole.current !== currentHole || rolledFrom.current == null;
    const from = arriving ? 0 : rolledFrom.current;
    rollHole.current = currentHole;
    rolledFrom.current = heroBase;
    if (reduceMotion || from == null || from === heroBase) {
      setRoll(null);
      return;
    }
    const rolled = rollSteps(from, heroBase, motion.rollFrames);
    const steps = arriving && from === 0 ? [0, ...rolled] : rolled;
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
    }, 42);
    return () => clearInterval(timer);
  }, [currentHole, heroBase, reduceMotion]);

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

  const talkPrefs = useTalkPrefs();
  const teePointEarly = overlay?.line[0] ?? null;
  const atTeeNow = player != null && teePointEarly != null && distanceYards(player, teePointEarly) <= NEXT_TEE_YARDS;
  const lastMark = [...marks].reverse().find((mark) => mark.hole === currentHole) ?? null;
  const yardsFromLast = player && lastMark ? distanceYards(player, { lat: lastMark.lat, lon: lastMark.lon }) : null;
  const talk = useTalkCaddie({
    hole: currentHole,
    par: hole?.par ?? null,
    atTee: atTeeNow,
    gpsYards: player ? ground?.centerYards ?? null : null,
    frontYards: ground?.frontYards ?? null,
    backYards: ground?.backYards ?? null,
    headwindMph: conditions.usePlaysLike ? sky?.headwindMph ?? null : null,
    elevationFeet: conditions.usePlaysLike ? sky?.elevationFeet ?? null : null,
    temperatureF: conditions.usePlaysLike ? sky?.current?.temperatureF ?? null : null,
    windMph: conditions.usePlaysLike ? sky?.current?.windMph ?? null : null,
    profiles,
    candidateClubIds: voiceClubs.length > 0 ? voiceClubs.map((club) => club.id) : undefined,
    selectedClubId: voiceClub.current.clubId,
    selectedClubLabel: voiceClub.current.clubLabel,
    scoreStrokes: holes[currentHole - 1] ?? null,
    scorePutts: putts[currentHole - 1] ?? null,
    thruLabel: score.holesEntered > 0 ? `Gross ${score.gross}` : null,
    persona: voice,
    onScore: setStrokes,
    onPutts: setPutts,
    onSetClub: (clubId) => {
      const index = stripClubs.findIndex((club) => club.id === clubId);
      if (index >= 0) setScrubIndex(index);
    },
    onMiss: (side, clubId, clubLabel) => {
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
    },
    onNext: () => leaveRef.current(),
    surface: 'sheet',
  });
  openTalk.current = talk.open;
  const spokenCallout = useRef<string | null>(null);
  const calloutGate = useRef({ stopped: false });
  const calloutLive = useRef(false);
  const calloutSpeaker = useRef(caddieSpeaker('device'));
  useEffect(() => {
    if (!talkPrefs.callouts || talk.phase !== 'idle') {
      if (calloutLive.current) {
        calloutGate.current.stopped = true;
        calloutSpeaker.current.stop();
        calloutLive.current = false;
      }
      return;
    }
    const call = proactiveCallout({
      enabled: true,
      persona: voice,
      hole: currentHole,
      par: hole?.par ?? null,
      atTee: atTeeNow,
      clubLabel: voiceClub.current.clubLabel,
      stockYards: voiceClub.current.carry?.stockYards ?? null,
      greenYards: player ? ground?.centerYards ?? null : null,
      yardsFromLastShot: yardsFromLast,
      lastShotId: lastMark?.id ?? null,
      spokenKey: spokenCallout.current,
    });
    if (!call) return;
    spokenCallout.current = call.key;
    calloutGate.current = { stopped: false };
    calloutLive.current = true;
    void speakSentences(calloutSpeaker.current, [call.line], calloutGate.current).finally(() => {
      calloutLive.current = false;
    });
  }, [atTeeNow, currentHole, hole?.par, lastMark?.id, player, talk.phase, talkPrefs.callouts, voice, yardsFromLast, ground?.centerYards]);

  useEffect(() => {
    if (talk.phase !== 'idle') applySheet.current(true);
  }, [talk.phase]);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
  const fallbackClub = scrubClub == null && calledId == null ? stripClubs[0] ?? null : null;
  const shownId = scrubClub?.id ?? calledId ?? fallbackClub?.id ?? null;
  const shownLabel = scrubClub
    ? scrubClub.label.split('·')[0]?.trim() || scrubClub.label
    : calledLabel ?? (fallbackClub ? fallbackClub.label.split('·')[0]?.trim() || fallbackClub.label : null);
  voiceClub.current = { ...voiceClub.current, clubId: shownId, clubLabel: shownLabel ?? 'Shot' };
  const shownProfile = measuredProfile(profiles, shownId);
  const noShots = shownId != null && (shownProfile == null || shownProfile.sampleSize < 1);
  const bearing = shotBearing(overlay.line);
  const teePoint = overlay.line[0] ?? null;
  const onTee = teePoint == null || player == null || distanceYards(player, teePoint) <= NEXT_TEE_YARDS;
  const teeCarry = carryProfile(profiles, shownId)?.stockYards ?? null;
  const longestCarry = profiles.reduce((best, profile) => {
    if (profile.metric !== 'carry' || profile.sampleSize < 5 || !(profile.stockYards > 0)) return best;
    return Math.max(best, profile.stockYards);
  }, 0);
  const windowStock = teeCarry ?? (longestCarry > 0 ? longestCarry : null);
  const grassPoints = overlay.fairways.flatMap((feature) => feature.rings.flat());
  let grassStart: number | null = null;
  if (teePoint) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const point of grassPoints) {
      const yards = distanceYards(teePoint, point);
      if (yards < nearest) nearest = yards;
    }
    if (nearest < Number.POSITIVE_INFINITY) grassStart = nearest;
  }
  const reachYards = teeWindowYards(windowStock, lineLengthYards(overlay.line), grassStart);
  const cameraKind = onTee && fullHole && reachYards != null ? 'tee' : onTee || fullHole || !player ? 'hole' : 'green';
  const oval: DispersionOval | null = sampleOn && !noShots ? dispersionOval([...SAMPLE_PATTERN]) : null;
  const landingYards = focusedPlays ?? focusedRaw;
  const origin = player ?? overlay.line[0] ?? null;
  const pinPoint = overlay.line[overlay.line.length - 1] ?? null;
  const greenCenter = greenRing ? ringCentroid(greenRing) : pinPoint;
  const greenOut =
    onTee &&
    origin != null &&
    greenCenter != null &&
    teeCarry != null &&
    distanceYards(origin, greenCenter) > teeCarry + PAST_STOCK_YARDS;
  const stockLanding = greenOut && teeCarry != null ? pointAtYards(overlay.line, teeCarry) : null;
  const landing = stockLanding ?? greenCenter;
  const landingLabelYards = stockLanding != null && teeCarry != null ? teeCarry : landingYards;
  const hazardRings = [...polygons.hazards, ...polygons.bunkers];
  const measuredCenter = oval && landing && bearing != null ? destinationPoint(landing, bearing + 90, oval.meanLateralYards) : landing;
  const safety = oval && measuredCenter && bearing != null ? patternSafety(measuredCenter, bearing, oval, hazardRings) : null;
  const risk = measuredCenter && bearing != null ? riskCall(measuredCenter, bearing, hazardRings) : null;
  const ovalCenter = measuredCenter && bearing != null && oval ? leanedLanding(measuredCenter, bearing, risk?.lean ?? null) : null;
  const ellipse = oval && ovalCenter && bearing != null ? ellipseRing(ovalCenter, bearing, oval.carryStdYards, oval.lateralStdYards, 36, oval.biasDeg) : null;
  const flight = origin && landing ? flightAlongLine(overlay.line, origin, landing) : null;
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
  const spoken = noShots
    ? null
    : caddieVoiceLine({
        voice,
        personality,
        clubLabel: shownLabel,
        windYards: focusedPlay && !('error' in focusedPlay) ? focusedPlay.wind?.yards ?? null : null,
        stockYards: shownProfile?.stockYards ?? (scrubClub ? null : stockYards),
        targetYards: shotYards,
        playsLikeYards: focusedPlays,
        lowConfidence,
        unit,
        par: hole.par,
        atTee: player != null && overlay.line[0] != null && distanceYards(player, overlay.line[0]) <= NEXT_TEE_YARDS,
      });
  const thinCopy = 'The sample is thin. Treat the number softly.';
  const oneLiner =
    spoken && /sample is thin|Thin sample/i.test(spoken)
      ? spoken
      : lowConfidence && !noShots && shotYards == null
        ? thinCopy
        : spoken;
  const band = carryBand(shownProfile, unit);
  const patternLine = patternCaption({
    onGreen,
    noShots,
    lowConfidence,
    sample: sampleOn,
    oval,
    invite: PATTERN_INVITE,
    thinLine: Boolean(oneLiner && /sample is thin|Thin sample/i.test(oneLiner)),
  });
  const closedSheet = closedPlaySheet(SHEET_CLOSED);
  closedSheetRef.current = closedSheet;
  if (!sheetOpenRef.current) sheetH.value = closedSheet;
  const frameSheet = sheetOpen || talk.phase !== 'idle' ? SHEET_OPEN : closedSheet;
  const lineKey = `${shownId ?? ''}:${oneLiner ?? ''}:${band ?? ''}`;
  if (lineClock.current.key !== lineKey) lineClock.current = { key: lineKey, at: Date.now() };
  const updatedAgo = Math.max(0, Math.round((clock - lineClock.current.at) / 1000));
  const carryYards = shownProfile?.stockYards != null && Number.isFinite(shownProfile.stockYards) ? Math.round(shownProfile.stockYards) : null;
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
  const advance = () => {
    if (hole.holeNumber >= 18) return;
    setCurrentHole(hole.holeNumber + 1);
  };

  const leaveHole = () => {
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
    const moment = scoreMoment(next, par);
    if (moment === 'celebrate') {
      setConsolation(false);
      setStamp(scoreStamp(next, par));
      if (!reduceMotion) {
        bump.value = withSequence(
          withTiming(8, { duration: 40 }),
          withTiming(-7, { duration: 40 }),
          withTiming(5, { duration: 36 }),
          withTiming(-3, { duration: 36 }),
          withTiming(0, { duration: 36 }),
        );
      }
      void boom();
      return;
    }
    if (moment === 'consolation') {
      setStamp(null);
      setConsolation(true);
      return;
    }
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
      <Animated.View pointerEvents="box-none" style={[styles.shake, bumpStyle]}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: `Hole ${hole.holeNumber}` }} />
      <ClubPulse clubLabel={shownLabel} yards={landingYards} />
      <Animated.View {...pan.panHandlers} style={[styles.mapWrap, mapStyle]}>
        <HoleMap
          bleed
          height={mapH}
          pad={holeFrame({ hudHeight: mapHudInset(insets.top), dockHeight: 0, sheetClosed: frameSheet })}
          orient={bearing != null && overlay.line[0] ? { bearing, origin: overlay.line[0] } : null}
          camera={{ kind: cameraKind, reachYards, from: player }}
          labels={
            cameraKind === 'tee' && reachYards != null
              ? marksAt(
                  overlay.line,
                  TEE_SHOT_MARKS.filter((yards) => yards < reachYards),
                  unit,
                )
              : holeLabels(
                  overlay.line,
                  unit,
                  landing && landingLabelYards != null ? { at: landing, label: formatDistance(landingLabelYards, unit) } : null,
                )
          }
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={ellipse}
          ellipseCaption={sampleOn && ellipse ? 'Sample' : null}
          ellipseColor={safety ? patternColor(safety) : null}
          flight={flight}
          reduceMotion={reduceMotion}
          dispersionLine={dispersionLine}
          measure={[]}
          marks={greenMarks}
          markReadout={
            ground
              ? {
                  front: formatDistance(ground.frontYards, unit),
                  center: formatDistance(ground.centerYards, unit),
                  back: formatDistance(ground.backYards, unit),
                }
              : null
          }
          markAccess={{
            front: greenMarkLabel('Front', ground ? formatDistance(ground.frontYards, unit) : null, unit),
            center: greenMarkLabel('Center', ground ? formatDistance(ground.centerYards, unit) : null, unit),
            back: greenMarkLabel('Back', ground ? formatDistance(ground.backYards, unit) : null, unit),
          }}
          onTap={() => undefined}
          rawLabel=""
          playsLabel=""
          aerial
          imagery={VECTOR_TILE_SOURCE}
        />
        <Vignette deep />
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onTee ? (fullHole ? 'Full hole' : 'Tee shot') : fullHole ? 'To the green' : 'Full hole'}
        onPress={() => {
          setFullHole((open) => !open);
          void tick();
        }}
        style={[styles.fullHole, { top: mapHudInset(insets.top) + 8 }]}
      >
        <Glass radius={16} contentStyle={styles.fullHoleFill}>
          <Text style={styles.fullHoleText}>{onTee ? (fullHole ? 'Full hole' : 'Tee shot') : fullHole ? 'To the green' : 'Full hole'}</Text>
        </Glass>
      </Pressable>
      <View
        pointerEvents="box-none"
        style={[styles.hud, { paddingTop: insets.top + 2 }]}
      >
        <Glass radius={22} contentStyle={styles.hudFill}>
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
            style={styles.hudTop}
          >
            <Pressable accessibilityRole="button" accessibilityLabel="Previous hole" onPress={goBack} style={({ pressed }) => [styles.backHit, pressed && !reduceMotion && styles.pressed]}>
              <View style={styles.chevron} />
            </Pressable>
            <Text style={styles.pillMeta}>PAR</Text>
            <Text style={[styles.pillNum, { fontFamily: display }]}>{par ?? '—'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Home" onPress={() => router.push('/')} style={styles.ballHit}>
              <View style={styles.ball}>
                <View style={[styles.dimple, styles.dimpleA]} />
                <View style={[styles.dimple, styles.dimpleB]} />
                <View style={[styles.dimple, styles.dimpleC]} />
                <Text style={[styles.ballNum, { fontFamily: display }]}>{hole.holeNumber}</Text>
              </View>
            </Pressable>
            <Text style={styles.pillMeta}>HCP</Text>
            <Text style={[styles.pillNum, { fontFamily: display }]}>{hole.strokeIndex ?? '—'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next hole" onPress={leaveHole} style={({ pressed }) => [styles.nextHit, pressed && !reduceMotion && styles.pressed]}>
              <View style={styles.chevronNext} />
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Text style={styles.chip}>{focusedChips?.wind ?? 'Wind ?'}</Text>
            <Text style={styles.chip}>{focusedChips?.elevation ?? 'Elev ?'}</Text>
            <Text style={styles.chip}>{focusedChips?.temperature ?? 'Temp ?'}</Text>
          </View>
          {!player && manual == null && !overrideOpen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Waiting for GPS, or tap to set your position"
              onPress={() => {
                setOverrideDraft('');
                setOverrideOpen(true);
              }}
              style={({ pressed }) => [styles.waitHit, pressed && !reduceMotion && styles.pressed]}
            >
              <Text style={styles.waitText}>Waiting for GPS · tap to set position</Text>
            </Pressable>
          ) : (
            <View style={styles.yardRow}>
              {ground ? <End label="Front" value={formatDistance(ground.frontYards, unit)} /> : <View style={styles.endCol} />}
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
                  <Text style={[styles.centerNum, { fontFamily: display }, focusedPlays != null ? styles.glow : centerLive && styles.centerLive]}>{heroText}</Text>
                )}
              </Pressable>
              {ground ? <End label="Back" value={formatDistance(ground.backYards, unit)} /> : <View style={styles.endCol} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={windKnown ? `Wind ${windText} miles per hour` : 'Wind unknown'}
                onPress={() => undefined}
                style={({ pressed }) => [styles.windHit, pressed && !reduceMotion && styles.pressed]}
              >
                <Glass radius={18} style={styles.windPill} contentStyle={styles.windFill} overlay={windKnown ? 'rgba(138,201,38,0.94)' : undefined}>
                  <WindMark ink={windKnown ? colors.navy : '#FFFFFF'} />
                  <Text style={[styles.windNum, { fontFamily: display }, windKnown && styles.windKnown]}>{windText}</Text>
                </Glass>
              </Pressable>
            </View>
          )}
        </Glass>
      </View>
      {hazardYards != null ? (
        <View pointerEvents="box-none" style={[styles.hazardFloat, { top: mapHudInset(insets.top) + 52 }]}>
          <Glass radius={18} contentStyle={styles.hazardFill}>
            <Text style={styles.hint}>{`Hazard ${formatDistance(hazardYards, unit)}`}</Text>
          </Glass>
        </View>
      ) : null}
      <Animated.View style={[styles.sheet, sheetStyle, { bottom: Math.max(insets.bottom, 8) }]}>
        <Glass radius={28} style={styles.sheetGlass} contentStyle={styles.sheetFill}>
          <View style={styles.grab}>
            <View {...sheetPan.panHandlers} style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
            <View style={styles.tabs}>
              {(['course', 'coach', 'stats'] as const).map((tab) => (
                <Pressable key={tab} accessibilityRole="button" accessibilityLabel={tab === 'coach' ? 'Coach AI' : tab === 'course' ? 'Course' : 'Stats'} onPress={() => setSheetTab(tab)}>
                  <Text style={[styles.tab, sheetTab === tab && styles.tabOn]}>{tab === 'coach' ? 'Coach AI' : tab === 'course' ? 'Course' : 'Stats'}</Text>
                </Pressable>
              ))}
            </View>
            {sheetTab === 'course' ? (
              <Text style={styles.line} numberOfLines={2}>{`${courseCall(pilot.record.name)}. ${holeSubline({ hole: hole.holeNumber, par })}`}</Text>
            ) : sheetTab === 'stats' ? (
              <View style={styles.thruRow}>
                <ThruBar label={thru.label} pips={thru.pips} />
              </View>
            ) : (
              <View style={styles.tipCard}>
                <Text style={styles.spark}>✦</Text>
                <View style={styles.clubCopy}>
                  <Text style={styles.tipTitle} numberOfLines={1}>{`${shownLabel ?? 'Club'} · Hole ${hole.holeNumber}`}</Text>
                  <Text style={styles.clubMeta}>{`Updated ${updatedAgo}s ago`}</Text>
                  {oneLiner ? <Text style={styles.line} numberOfLines={sheetOpen ? 3 : 1}>{oneLiner}</Text> : null}
                  <Text style={[styles.carryLine, { fontFamily: display }]} numberOfLines={1}>
                    {carryYards == null ? 'Carry not measured' : `${carryYards} carry`}
                    {band ? `  ${band}` : `  ${PATTERN_INVITE}`}
                  </Text>
                </View>
              </View>
            )}
            {sheetTab === 'coach' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Talk to the caddie" onPress={() => talk.open()} style={styles.micRow}>
                <View style={styles.micDot} />
                <Text style={styles.micLabel}>{talk.phase === 'listening' ? 'Listening' : talk.phase === 'speaking' ? 'Caddie' : 'Mic'}</Text>
              </Pressable>
            ) : null}
          </View>
          {sheetOpen && sheetTab === 'coach' ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.talkGrow}>
          <ScrollView style={styles.details} contentContainerStyle={styles.detailsBody} keyboardShouldPersistTaps="handled">
            <Waveform live={talk.phase === 'listening' || talk.phase === 'speaking'} compact />
            {talk.sample ? <Text style={styles.clubMeta}>Sample mode. No live model on this server.</Text> : null}
            <Text style={styles.clubMeta}>You</Text>
            <Text style={styles.line}>{talk.transcript || 'Hold the mic, or type it.'}</Text>
            <Text style={styles.clubMeta}>Caddie</Text>
            {talk.reply ? <YardageLine text={talk.reply} /> : <Text style={styles.line}> </Text>}
            {talk.typed ? (
              <View style={styles.typeRow}>
                <TextInput
                  value={talk.draft}
                  onChangeText={talk.setDraft}
                  placeholder="Ask your caddie…"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  style={styles.askInput}
                  accessibilityLabel="Typed ask"
                  onSubmitEditing={() => {
                    const text = talk.draft;
                    talk.setDraft('');
                    void talk.ask(text);
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send question"
                  onPress={() => {
                    const text = talk.draft;
                    talk.setDraft('');
                    void talk.ask(text);
                  }}
                >
                  <Text style={styles.micLabel}>Send</Text>
                </Pressable>
              </View>
            ) : null}
            <ClubStrip
              clubs={stripClubs.map((club) => ({ id: club.id, label: club.label }))}
              index={stripClubs.findIndex((club) => club.id === shownId)}
              band={null}
              peek={false}
              onIndex={setScrubIndex}
              onOpen={() => applySheet.current(false)}
            />
            {noShots ? (
              <Text style={styles.tip}>
                <Text accessibilityRole="button" accessibilityLabel="Log a shot after each swing" onPress={markHere} style={styles.tipLink}>
                  {SHOT_LOG_TIP.split(', or ')[0]}
                </Text>
                <Text style={styles.tip}>, or </Text>
                <Text accessibilityRole="button" accessibilityLabel="Upload a TrackMan photo" onPress={() => router.push('/import')} style={styles.tipLink}>
                  {SHOT_LOG_TIP.split(', or ')[1]}
                </Text>
              </Text>
            ) : patternLine ? (
              <Text style={styles.sample}>{patternLine}</Text>
            ) : null}
            {figure ? <Text style={styles.body}>{`${figure.label} ${formatDistance(figure.yards, unit)}`}</Text> : null}
            {whyLine ? <Text style={styles.body}>{whyLine}</Text> : null}
            {ask.banner ? <View>{ask.banner}</View> : null}
            {card ? <Text style={styles.body}>{card.lines.reason}</Text> : null}
            {carryStock ? <Text style={styles.body}>{carryWords(carryStock, unit)}</Text> : null}
            {calledId && !carryStock ? <Text style={styles.body}>Carry was not measured.</Text> : null}
            {longTotal ? <Text style={styles.body}>{longTotal}</Text> : null}
            {missLine ? <Text style={styles.body}>{missLine}</Text> : null}
            <Text style={styles.body}>Putts stay off the score.</Text>
            <CountChip value={puttCount} confirmed={face.puttsConfirmed} par={null} floor={0} idleLabel="Putts" onWrite={writePutts} />
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
          </KeyboardAvoidingView>
          ) : null}
          <View pointerEvents="none" style={styles.footerArt}>
            <View style={styles.limeGlow} />
            <View style={styles.dimpleRow}>
              {Array.from({ length: 8 }, (_, index) => (
                <View key={index} style={styles.footerDimple} />
              ))}
            </View>
          </View>
        </Glass>
      </Animated.View>
      <View
        style={[styles.dock, { bottom: CLOSED_CARD + Math.max(insets.bottom, 8) + 4 }]}
      >
        {ask.undo}
        <View style={styles.dockRow}>
          <CountChip minHeight={56} value={face.strokes} confirmed={face.strokesConfirmed} par={par} floor={1} idleLabel="Score" onWrite={writeStrokes} />
          <Pressable accessibilityRole="button" accessibilityLabel="Mark shot" onPress={markHere} style={({ pressed }) => [styles.markHit, pressed && !reduceMotion && styles.pressed]}>
            <Glass radius={24} style={styles.mark} contentStyle={styles.markFill}>
              <Text style={styles.markText}>Mark shot</Text>
            </Glass>
          </Pressable>
        </View>
      </View>
      <View pointerEvents="box-none" style={[styles.askFloat, { bottom: CLOSED_CARD + Math.max(insets.bottom, 8) + 4 }]}>
        {ask.button}
      </View>
      </Animated.View>
      <MomentOverlay
        stamp={stamp}
        consolation={consolation}
        reduce={reduceMotion}
        onDone={() => {
          setStamp(null);
          setConsolation(false);
        }}
      />
      {saved ? (
        <View pointerEvents="none" style={styles.savedWrap}>
          <Glass radius={28} style={styles.saved} contentStyle={styles.savedFill}>
            <Text style={styles.kicker}>Marked</Text>
            <Text style={[styles.savedTitle, { fontFamily: display }]}>{saved}</Text>
          </Glass>
        </View>
      ) : null}
      {talk.overlay}
    </View>
  );
}

function WindMark({ ink = '#FFFFFF' }: { ink?: string }) {
  return (
    <View style={styles.wind}>
      <View style={[styles.windLine, { backgroundColor: ink }]} />
      <View style={[styles.windLineShort, { backgroundColor: ink }]} />
      <View style={[styles.windLine, { backgroundColor: ink }]} />
    </View>
  );
}

function End({ label, value }: { label: string; value: string }) {
  const display = useDisplayFace();
  return (
    <View style={styles.endCol} accessibilityLabel={value ? `${label} ${value}` : label}>
      <Text style={styles.endLabel}>{label}</Text>
      <Text style={[styles.endNum, { fontFamily: display }]}>{value}</Text>
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
  screen: { flex: 1, backgroundColor: fieldNavy, overflow: 'hidden' },
  shake: { flex: 1 },
  mapWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: fieldNavy },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10 },
  hudFill: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4 },
  hudTop: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleGap: { flex: 1 },
  thruRow: { minHeight: 20, justifyContent: 'center', paddingHorizontal: 4 },
  pillMeta: { color: 'rgba(255,255,255,0.72)', fontFamily: font.family, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  pillNum: { color: '#FFFFFF', fontSize: 18, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ballHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ballNum: { color: '#0B1F3A', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  dimple: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(11,31,58,0.16)' },
  dimpleA: { top: 7, left: 8 },
  dimpleB: { top: 16, right: 7 },
  dimpleC: { bottom: 6, left: 14 },
  nextHit: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  chevronNext: {
    width: 12,
    height: 12,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginRight: 4,
  },
  chipRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', gap: 12, minHeight: 18, alignItems: 'center' },
  tab: { color: 'rgba(255,255,255,0.55)', fontFamily: font.family, fontSize: 11, fontWeight: '700' },
  tabOn: { color: '#FFFFFF' },
  tipCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  spark: { color: '#8AC926', fontSize: 16, lineHeight: 18 },
  tipTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 16, fontWeight: '700' },
  carryLine: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  micDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#8AC926' },
  micLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, fontWeight: '700' },
  talkGrow: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  askInput: {
    flex: 1,
    minHeight: 40,
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.35)',
  },
  footerArt: { height: 16, alignItems: 'center', justifyContent: 'flex-end' },
  limeGlow: { position: 'absolute', left: 24, right: 24, bottom: 0, height: 10, borderRadius: 8, backgroundColor: 'rgba(138,201,38,0.55)' },
  dimpleRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  footerDimple: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  pressed: { transform: [{ scale: 0.96 }] },
  backHit: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  chevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 20, lineHeight: 22, fontWeight: font.bold, letterSpacing: 0.3 },
  headerSi: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold },
  yardRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  windHit: { marginLeft: 4 },
  windPill: { minHeight: 40, minWidth: 52 },
  windFill: { minHeight: 40, minWidth: 52, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  wind: { width: 22, height: 16, justifyContent: 'space-between' },
  windLine: { height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  windLineShort: { height: 2, width: 14, borderRadius: 1, backgroundColor: '#FFFFFF' },
  windNum: { color: '#FFFFFF', fontFamily: font.family, fontSize: 22, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  windKnown: { color: colors.navy },
  endCol: { width: 54, alignItems: 'center', justifyContent: 'center' },
  centerHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  endLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 11, lineHeight: 13, fontWeight: font.semibold },
  endNum: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: font.bold,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(11,31,58,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  centerNum: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 52,
    lineHeight: 54,
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
  waitHit: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  waitText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, fontWeight: font.semibold, textAlign: 'center' },
  hint: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, textAlign: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  chip: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: type.caption,
    lineHeight: 18,
    fontWeight: font.semibold,
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hazardFloat: { position: 'absolute', left: 12, zIndex: 4 },
  hazardFill: { minHeight: 32, paddingHorizontal: 12, justifyContent: 'center' },
  sheet: { position: 'absolute', left: 12, right: 12, overflow: 'hidden' },
  sheetGlass: { flex: 1 },
  sheetFill: { flex: 1 },
  grab: { paddingTop: 0, paddingHorizontal: 12, paddingBottom: 2 },
  tipHit: { marginTop: 2 },
  tip: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold },
  tipLink: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, textDecorationLine: 'underline' },
  handleHit: { minHeight: 12, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.72)' },
  clubRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubCopy: { flex: 1, gap: 0 },
  clubName: { color: '#FFFFFF', fontFamily: font.family, fontSize: 22, lineHeight: 24, fontWeight: font.bold, letterSpacing: 0.3 },
  clubMeta: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  line: { color: '#FFFFFF', fontFamily: font.family, fontSize: 14, lineHeight: 17, fontWeight: font.medium },
  unlock: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 22, fontWeight: font.medium, marginTop: 0 },
  sample: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.55 },
  kicker: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  details: { flex: 1 },
  detailsBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  body: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  textHit: { minHeight: 56, justifyContent: 'center' },
  dock: { position: 'absolute', left: 12, right: 112, zIndex: 6, gap: 4 },
  dockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  askFloat: { position: 'absolute', right: 8, zIndex: 7 },
  fullHole: { position: 'absolute', left: 12, zIndex: 5 },
  fullHoleFill: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  fullHoleText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, fontWeight: font.semibold },
  markHit: { flex: 1, minHeight: 56 },
  mark: { flex: 1, minHeight: 56 },
  markFill: { minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  markText: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  quiet: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24, padding: 24 },
  savedWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  saved: { minWidth: 200 },
  savedFill: { paddingVertical: 28, paddingHorizontal: 32, alignItems: 'center', gap: 4 },
  savedTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 40, lineHeight: 46, fontWeight: '700' },
});
