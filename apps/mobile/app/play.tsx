import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Keyboard, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { colors, font, motion, play as field, type } from '@coopr/tokens';
import {
  acceptShotYards,
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
  shotCardLine,
  SAMPLE_PATTERN,
  PATTERN_INVITE,
  EMPTY_BAG_ADVICE,
  CONFIDENCE_LOW,
  confidenceLabel,
  confidencePercent,
  dispersionOval,
  ellipseRing,
  flightAlongLine,
  leanedLanding,
  patternColor,
  patternSafety,
  quotedProfile,
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
import { acceptHoleGesture, shouldAutoAdvance } from '../src/design/hole-nav';
import { holeSwipe, rollSteps } from '../src/design/motion';
import { carryChipLine, clubDetail, clubFigure, closedPlaySheet, foldInset, greenMarkLabel, holeEnter, holeFrame, holeShift, mapHudInset, patternCaption, samplePatternVisible, scoreCommit, scoreGlance, scoreMoment, scoreStamp, sheetSnap, shotReadout, SHOT_LOG_TIP } from '../src/design/play-polish';
import { SheetBall } from '../src/design/sheet-ball';
import { SHEET_BALL_SCROLL_FADE, SHEET_BALL_SCROLL_FADE_BOTTOM, SHEET_BALL_TEXT } from '../src/design/sheet-ball-geometry';
import { caddieVoiceLine } from '../src/design/caddie-voice';
import { useDisplayFace } from '../src/design/display-font';
import { MomentOverlay } from '../src/design/moments';
import { fieldNavy } from '../src/design/theme';
import { Glass } from '../src/design/glass';
import { ClubStrip, ThruBar } from '../src/design/signature-ui';
import { useReduceMotion } from '../src/design/reduce-motion';
import { ScoreDock } from '../src/design/score-dock';
import { MARKED_TOAST_MS, playChrome, thruHud } from '../src/design/round-chrome';
import { coachOpenHeight, coachPeekHeight } from '../src/design/round-chrome';
import { estimatedPick, starterAdvice } from '../src/clubs/starter';
import { useBagScan } from '../src/bag-scan/session';
import { lineLengthYards, PAST_STOCK_YARDS, playCamera, pointAtYards, teeWindowYards } from '../src/hole-fit';
import { subscribeGps } from '../src/gps-fix';
import { readWeather, type WeatherRead } from '../src/weather';
import { useLocalStore, type LandingResult } from '../src/local-store';
import { useAskCoopr } from '../src/ask-coopr';
import { caddieSpeaker, isSpeechMuted, speakSentences, subscribeSpeech } from '../src/speech/tts';
import { SAMPLE_ANSWER_LABEL } from '../src/talk-client';
import { dismissPlayNote, readPlayNote, subscribePlayNote } from '../src/bag-scan/play-note';
import { readPlayWebFlags } from '../src/play-web-flags';
import { useTalkCaddie, Waveform, YardageLine } from '../src/talk-overlay';
import { courseCall, holeSubline } from '../src/design/home-copy';
import { aerialPlate } from '../src/aerial/registry';
import { aerialTreeNote, pointOnAerial } from '../src/aerial/project';
import { VECTOR_TILE_SOURCE } from '../src/tile-source';
import { useTalkPrefs } from '../src/talk-prefs';
import { readDevice, rememberMeasuredShot, subscribeDevice } from '../src/device-store';
import { clubCarryLine } from '../src/shots/track';
import { scoreSavedLabel, spokenStrokes } from '../src/design/spoken-score';

const pilot = loadHighCedarsPilot();
/** Tall enough for a wrapped caddie sentence and the mic. The locked HUD constant stays shorter. */
const MINUS = '\u2212';

/** Signed tenth. A missing reading stays an em dash. */
function signedTenths(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  const body = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${body}`;
  if (rounded < 0) return `${MINUS}${body}`;
  return '0';
}

function wholeDegrees(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

function sheetScrollElement(view: ScrollViewInstance | null): HTMLElement | null {
  if (view == null || typeof HTMLElement === 'undefined') return null;
  const node = view.getScrollableNode() as unknown;
  return node instanceof HTMLElement ? node : null;
}

/** Text blocks in content-y, so a scroll offset does not move the rest edge. */
function foldBlocks(scroll: HTMLElement): { top: number; bottom: number }[] {
  const content = scroll.firstElementChild;
  if (!(content instanceof HTMLElement) || typeof document === 'undefined') return [];
  const origin = content.getBoundingClientRect().top;
  const blocks: { top: number; bottom: number }[] = [];
  const seen = new Set<HTMLElement>();
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const value = node.textContent ?? '';
    if (parent && value.trim().length > 0) {
      let box = parent.getBoundingClientRect();
      const ranged = box.height > 120 || box.height < 8;
      if (ranged) {
        const range = document.createRange();
        range.selectNodeContents(node);
        box = range.getBoundingClientRect();
      }
      if (!ranged && seen.has(parent)) {
        node = walker.nextNode();
        continue;
      }
      if (!ranged) seen.add(parent);
      if (box.height >= 8 && box.height <= 120 && box.width >= 8) {
        blocks.push({ top: box.top - origin, bottom: box.bottom - origin });
      }
    }
    node = walker.nextNode();
  }
  return blocks;
}

/** Content-y of the scroll edge as if the extra fold pad were not applied. */
function restFoldEdge(scroll: HTMLElement, pad: number): number {
  const content = scroll.firstElementChild;
  if (!(content instanceof HTMLElement)) return scroll.clientHeight + pad;
  const scrollRect = scroll.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  return scrollRect.bottom - contentRect.top - scroll.scrollTop + pad;
}

/** The score bar is hidden while the sheet is open, so the camera does not reserve its clearance. */
const OPEN_DOCK_CLEAR = 68;
const VOICE_DWELL_MS = 8000;
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


function carryBand(profile: DistanceProfile | null, unit: DistanceUnit): string | null {
  if (!profile?.dispersionKnown) return null;
  return `${formatDistance(profile.p20, unit)}–${formatDistance(profile.p80, unit)}`;
}

function lieResult(lie: FinishLie | null): LandingResult | null {
  if (lie == null) return null;
  return lie;
}

function DictateButton({ live, onPress }: { live: boolean; onPress: () => void }) {
  return (
    <View style={styles.micSlot}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dictate to caddie" onPress={onPress} style={styles.micHit}>
        <View style={[styles.micButton, live && styles.micButtonLive]}>
          <View style={styles.micHead} />
          <View style={styles.micCradle} />
          <View style={styles.micStem} />
          <View style={styles.micFoot} />
        </View>
      </Pressable>
    </View>
  );
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
    penalties,
    setPenalties,
    fairways,
    setFairway,
    girs,
    setGir,
    finishRound,
    markRoundStarted,
    marks,
    recordMark,
    dropLastMark,
    deleteLastShot,
    adjustLastShot,
    setLastShotYards,
    reassignShot,
    conditions,
    removeTag,
  } = useLocalStore();
  const bag = useBagScan();
  const path = usePathname();
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
  const [keyboard, setKeyboard] = useState(0);
  const lineClock = useRef({ key: '', at: Date.now() });
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [sampleOn, setSampleOn] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(() => readPlayNote());
  const fullHole = false;
  const [pickedClubId, setPickedClubId] = useState<string | null>(null);
  const [reviewShotId, setReviewShotId] = useState<string | null>(null);
  const reviewShotIdRef = useRef<string | null>(null);
  const chooseReview = (id: string) => {
    reviewShotIdRef.current = id;
    setReviewShotId(id);
  };
  const [scoreAsk, setScoreAsk] = useState(0);
  const [justYards, setJustYards] = useState(false);
  const [batterySaver, setBatterySaver] = useState(false);
  const [undoHole, setUndoHole] = useState<number | null>(null);
  const [scoreToast, setScoreToast] = useState<string | null>(null);
  const [pendingScore, setPendingScore] = useState<{ hole: number; strokes: number } | null>(null);
  const [speechPhase, setSpeechPhase] = useState<'speaking' | 'silent'>('silent');
  useEffect(() => subscribeSpeech(setSpeechPhase), []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement.style.overflow;
    const body = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = html;
      document.body.style.overflow = body;
    };
  }, []);
  const reduceMotion = useReduceMotion();
  const display = useDisplayFace();
  const [stamp, setStamp] = useState<ReturnType<typeof scoreStamp>>(null);
  const [consolation, setConsolation] = useState(false);
  const bump = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const mapX = useSharedValue(0);
  const panOffX = useSharedValue(0);
  const panOffY = useSharedValue(0);
  const panBase = useRef({ x: 0, y: 0 });
  const widthRef = useRef(393);
  const mapScale = useSharedValue(1);
  const mapFade = useSharedValue(1);
  const sheetX = useSharedValue(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  widthRef.current = windowWidth;
  const sheetH = useSharedValue(coachPeekHeight(windowHeight));
  const peekSV = useSharedValue(coachPeekHeight(windowHeight));
  const openSV = useSharedValue(coachOpenHeight(windowHeight, windowWidth));
  const sheetDrag = useSharedValue(0);
  const sheetOpenRef = useRef(false);
  const closedSheetRef = useRef(coachPeekHeight(windowHeight));
  const peekRef = useRef(coachPeekHeight(windowHeight));
  const openRef = useRef(coachOpenHeight(windowHeight, windowWidth));
  const seenHole = useRef<number | null>(null);
  const rolledFrom = useRef<number | null>(null);
  const rollHole = useRef<number | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailsRef = useRef<ScrollViewInstance>(null);
  const [foldPad, setFoldPad] = useState(0);
  const foldPadRef = useRef(0);
  foldPadRef.current = foldPad;
  const leaveRef = useRef<() => void>(() => {});
  const backRef = useRef<() => void>(() => {});
  const holeNo = useRef(1);
  useEffect(() => {
    let storage: { getItem(key: string): string | null } | undefined;
    try {
      storage = typeof localStorage === 'undefined' ? undefined : localStorage;
    } catch {
      storage = undefined;
    }
    const flags = readPlayWebFlags(storage);
    setSampleOn(flags.sample);
    if (flags.scrub != null) setScrubIndex(flags.scrub);
  }, []);
  useEffect(() => subscribePlayNote(() => setDraftNote(readPlayNote())), []);
  const advanced = useRef(0);
  const manualNav = useRef(false);
  const lastButtonNav = useRef<{ dir: 'next' | 'prev'; at: number } | null>(null);
  const openTalk = useRef<() => void>(() => {});
  const visibleCall = useRef<{ line: string | null; clubId: string | null; clubLabel: string | null }>({ line: null, clubId: null, clubLabel: null });
  const voiceClub = useRef<{
    clubId: string | null;
    clubLabel: string;
    carryToClearYards: number | null;
    carry: DistanceProfile | null;
  }>({ clubId: null, clubLabel: 'Shot', carryToClearYards: null, carry: null });
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [panMark, setPanMark] = useState('0,0');
  const applyPan = (dx: number, dy: number) => {
    panOffX.value = panBase.current.x + dx;
    panOffY.value = panBase.current.y + dy;
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        const edge = gesture.x0 <= 28 || gesture.x0 >= widthRef.current - 28;
        if (edge && Math.abs(gesture.dx) > Math.abs(gesture.dy)) return;
        applyPan(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const edge = gesture.x0 <= 28 || gesture.x0 >= widthRef.current - 28;
        const dir = edge ? holeSwipe(gesture.dx, gesture.dy, holeNo.current) : null;
        const last = lastButtonNav.current;
        const accepted = acceptHoleGesture({
          dir,
          lastDir: last?.dir ?? null,
          elapsedMs: last ? Date.now() - last.at : Number.POSITIVE_INFINITY,
        });
        if (accepted && dir) {
          panBase.current = { x: 0, y: 0 };
          panOffX.value = 0;
          panOffY.value = 0;
          if (dir === 'next') leaveRef.current();
          if (dir === 'prev') backRef.current();
          return;
        }
        panBase.current = { x: panOffX.value, y: panOffY.value };
        setPanMark(`${Math.round(panOffX.value)},${Math.round(panOffY.value)}`);
      },
    }),
  ).current;
  useEffect(() => {
    if (path === '/play') markRoundStarted();
  }, [path, markRoundStarted]);
  const heldOpen = useRef(false);
  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const framedHole = useRef<number | null>(null);
  const holdCoach = useRef(false);
  const applySheet = useRef<(open: boolean, fromGesture?: boolean) => void>(() => {});
  applySheet.current = (open: boolean, fromGesture = false) => {
    if (fromGesture) heldOpen.current = open;
    sheetOpenRef.current = open;
    setSheetOpen(open);
    sheetDrag.value = 0;
    sheetH.value = withSpring(open ? openRef.current : peekRef.current, SHEET_SPRING);
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
        const visual = Math.min(openRef.current, Math.max(peekRef.current, sheetH.value - gesture.dy));
        sheetDrag.value = 0;
        sheetH.value = visual;
        const dir = holeSwipe(gesture.dx, gesture.dy, holeNo.current);
        const last = lastButtonNav.current;
        const swipe = acceptHoleGesture({
          dir,
          lastDir: last?.dir ?? null,
          elapsedMs: last ? Date.now() - last.at : Number.POSITIVE_INFINITY,
        });
        if (swipe && dir === 'next') {
          leaveRef.current();
          return;
        }
        if (swipe && dir === 'prev') {
          backRef.current();
          return;
        }
        if (Math.abs(gesture.dy) < 16 && Math.abs(gesture.dx) < 16) {
          applySheet.current(!sheetOpenRef.current, true);
          return;
        }
        applySheet.current(sheetSnap(sheetOpenRef.current, gesture.dy, gesture.vy), true);
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
  const hasFix = player != null || manual != null;
  const shotRaw = hasFix ? shotYards : null;
  const shotPlay =
    !conditions.usePlaysLike || shotRaw == null
      ? null
      : playsLike({
          rawYards: shotRaw,
          headwindMph: sky?.headwindMph ?? null,
          elevationFeet: sky?.elevationFeet ?? null,
          temperatureF: sky?.current?.temperatureF ?? null,
        });
  const shotResult = shotPlay && !('error' in shotPlay) ? shotPlay : null;
  const playsLikeYards = shotResult?.playsLikeYards ?? null;
  const shotShown = shotReadout(playsLikeYards, shotRaw);
  const shotWind = shotResult?.wind?.yards ?? null;
  const heroBase = shotRaw;
  const voiceClubs = clubs.filter((club) => club.slot === 'in_play');
  const ask = useAskCoopr({
    rail: true,
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
    onAsk: () => {
      applySheet.current(true);
      openTalk.current();
    },
  });

  const bannerOn = ask.banner != null;
  useEffect(() => {
    if (!bannerOn) return;
    sheetOpenRef.current = true;
    setSheetOpen(true);
    sheetH.value = withSpring(openRef.current, SHEET_SPRING);
  }, [bannerOn, sheetH]);

  useEffect(() => {
    const previous = framedHole.current;
    framedHole.current = currentHole;
    if (previous === currentHole) return;
    setOverrideOpen(false);
    setSaved(null);
    setSky(null);
    if (previous == null) return;
    setPendingScore(null);
    if (holdCoach.current) {
      holdCoach.current = false;
      sheetOpenRef.current = true;
      setSheetOpen(true);
      sheetH.value = openRef.current;
      return;
    }
    sheetOpenRef.current = false;
    setSheetOpen(false);
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
    transform: [{ translateX: mapX.value + panOffX.value }, { translateY: panOffY.value }, { scale: mapScale.value }],
  }));
  const bumpStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bump.value }],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    height: Math.min(openSV.value, Math.max(peekSV.value, sheetH.value - sheetDrag.value)),
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
    }, (stored) => (typeof stored === 'string' ? gpsPreset(stored, geometry.line, ring) : stored), batterySaver);
  }, [currentHole, batterySaver]);

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
    const manual = manualNav.current;
    manualNav.current = false;
    if (path !== '/play' || !player || currentHole >= 18) return;
    const geometry = holeOverlay(pilot.features, pilot.record.scorecard, currentHole);
    const nextTee = holeOverlay(pilot.features, pilot.record.scorecard, currentHole + 1).line[0] ?? null;
    const center = geometry.green?.rings[0] ? ringCentroid(geometry.green.rings[0]) : null;
    if (
      !shouldAutoAdvance({
        manual,
        player,
        currentHole,
        nextTee,
        currentGreen: center,
        alreadyAdvanced: advanced.current === currentHole,
      })
    ) {
      return;
    }
    advanced.current = currentHole;
    setCurrentHole((hole) => hole + 1);
  }, [path, player, currentHole]);

  const talkPrefs = useTalkPrefs();
  const [shotLog, setShotLog] = useState(readDevice().measuredShots);
  useEffect(() => subscribeDevice(() => setShotLog(readDevice().measuredShots)), []);
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
    cardSnapshot: () => visibleCall.current,
  });
  openTalk.current = talk.open;
  const spokenCallout = useRef<string | null>(null);
  const calloutGate = useRef({ stopped: false });
  const calloutLive = useRef(false);
  const calloutSpeaker = useRef(caddieSpeaker('device'));
  useEffect(() => {
    if (!talkPrefs.callouts || talkPrefs.muted || isSpeechMuted() || talk.phase !== 'idle') {
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
  }, [atTeeNow, currentHole, hole?.par, lastMark?.id, player, talk.phase, talkPrefs.callouts, talkPrefs.muted, voice, yardsFromLast, ground?.centerYards]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => setKeyboard(event.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (dwell.current) {
      clearTimeout(dwell.current);
      dwell.current = null;
    }
    if (talk.phase !== 'idle') {
      applySheet.current(true);
      return;
    }
    if (heldOpen.current || !sheetOpenRef.current || talk.askKind !== 'voice') return;
    dwell.current = setTimeout(() => {
      dwell.current = null;
      if (heldOpen.current) return;
      applySheet.current(false);
    }, VOICE_DWELL_MS);
    return () => {
      if (dwell.current) {
        clearTimeout(dwell.current);
        dwell.current = null;
      }
    };
  }, [talk.phase, talk.transcript, talk.reply, talk.draft, talk.askKind]);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sheetOpenRef.current) return;
    const next = keyboard > 0 ? Math.min(openRef.current, Math.max(peekRef.current, windowHeight - keyboard - 48)) : openRef.current;
    sheetH.value = withSpring(next, SHEET_SPRING);
  }, [keyboard, sheetH]);

  useEffect(() => {
    if (!sheetOpen) return;
    detailsRef.current?.scrollTo({ y: 0, animated: false });
  }, [sheetOpen, talk.transcript, talk.reply, talk.voiceHint]);

  useLayoutEffect(() => {
    if (!sheetOpen || sheetTab !== 'coach' || Platform.OS !== 'web') {
      setFoldPad(0);
      return;
    }
    let stopped = false;
    const measure = () => {
      if (stopped) return;
      const scroll = sheetScrollElement(detailsRef.current);
      if (!scroll || scroll.clientHeight < 40) return;
      const blocks = foldBlocks(scroll);
      if (blocks.length === 0) return;
      const next = foldInset(blocks, restFoldEdge(scroll, foldPadRef.current));
      setFoldPad((prev) => (prev === next ? prev : next));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const scroll = sheetScrollElement(detailsRef.current);
    if (observer && scroll) {
      observer.observe(scroll);
      if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
      if (scroll.parentElement) observer.observe(scroll.parentElement);
    }
    const timer = setTimeout(measure, 60);
    return () => {
      stopped = true;
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [sheetOpen, sheetTab, talk.reply, talk.transcript, talk.typed, talk.voiceHint, talk.draft, currentHole, scrubIndex, player, manual, keyboard]);

  useEffect(() => {
    if (!sheetOpen || talk.voiceHint == null || Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.querySelector<HTMLInputElement>('[aria-label="Typed ask"]')?.focus({ preventScroll: true });
  }, [sheetOpen, talk.askFocus, talk.voiceHint]);

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
  const callYards = shotShown;
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
          candidateClubIds: inPlay.map((club) => club.id),
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
  const hazard = taggedHazardLine(pilot.features, hole.holeNumber, player);
  voiceClub.current = {
    clubId: calledId,
    clubLabel: calledLabel ?? 'Shot',
    carryToClearYards: hazard?.yards ?? null,
    carry: carryStock,
  };
  const layup = !shortMode && !onGreen && hazard ? layupDecision({ carry: carryStock, carryToClearYards: hazard.yards }) : null;
  const hazardYards = player ? nearestHazardYards(player, [...polygons.hazards, ...polygons.bunkers]) : null;
  const estimatePick = estimatedPick(bag.clubs, callYards);
  const fallbackClub =
    scrubClub == null && calledId == null
      ? stripClubs.find((club) => club.id === estimatePick?.id) ?? stripClubs[0] ?? null
      : null;
  const shownId = scrubClub?.id ?? calledId ?? fallbackClub?.id ?? null;
  const shownLabel = scrubClub
    ? scrubClub.label.split('·')[0]?.trim() || scrubClub.label
    : calledLabel ?? (fallbackClub ? fallbackClub.label.split('·')[0]?.trim() || fallbackClub.label : null);
  voiceClub.current = { ...voiceClub.current, clubId: shownId, clubLabel: shownLabel ?? 'Shot' };
  const shownProfile = quotedProfile(profiles, shownId);
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
  const holeYards = lineLengthYards(overlay.line);
  const reachYards = teeWindowYards(windowStock, holeYards, grassStart);
  const pinForCamera = overlay.line[overlay.line.length - 1] ?? null;
  const onThisHole =
    player != null &&
    teePoint != null &&
    pinForCamera != null &&
    distanceYards(player, teePoint) <= holeYards + 80 &&
    distanceYards(player, pinForCamera) <= holeYards + 80;
  const cameraKind = playCamera({
    onTee,
    fullHole,
    reachYards,
    onThisHole,
    player: player != null,
  });
  const showSample = samplePatternVisible({ sampleOn, hasFix: player != null, measured: !noShots });
  const oval: DispersionOval | null = showSample ? dispersionOval([...SAMPLE_PATTERN]) : null;
  const origin = player;
  const pinPoint = overlay.line[overlay.line.length - 1] ?? null;
  const greenCenter = greenRing ? ringCentroid(greenRing) : pinPoint;
  const greenOut =
    player != null &&
    onTee &&
    origin != null &&
    greenCenter != null &&
    teeCarry != null &&
    distanceYards(origin, greenCenter) > teeCarry + PAST_STOCK_YARDS;
  const stockLanding = greenOut && teeCarry != null ? pointAtYards(overlay.line, teeCarry) : null;
  const landing = player != null ? stockLanding ?? greenCenter : null;
  const landingLabelYards = player == null ? null : stockLanding != null && teeCarry != null ? teeCarry : shotShown;
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
        windKnown: shotResult?.wind != null,
        elevationKnown: shotResult?.elevation != null,
        temperatureKnown: shotResult?.temperature != null,
      })
    : null;
  const lowConfidence = percent != null && percent < CONFIDENCE_LOW;
  const spoken = noShots
    ? null
    : caddieVoiceLine({
        voice,
        personality,
        clubLabel: shownLabel,
        windYards: shotWind,
        stockYards: shownProfile?.stockYards ?? null,
        targetYards: shotShown,
        playsLikeYards: shotShown,
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
  const noDistance = player == null && manual == null;
  const bagEmpty = inPlay.length === 0;
  const cardSentence = bagEmpty
    ? EMPTY_BAG_ADVICE
    : noDistance
    ? null
    : noShots
      ? shotCardLine({
          persona: voice,
          clubLabel: shownLabel,
          measured: false,
          stockYards: null,
          targetYards: shotShown,
          atTee: player != null && overlay.line[0] != null && distanceYards(player, overlay.line[0]) <= NEXT_TEE_YARDS,
          par: hole.par,
        })
      : oneLiner && /sample is thin|thin sample/i.test(oneLiner) && shotShown == null
        ? null
        : oneLiner;
  const measuredCall = shownProfile != null && shownProfile.sampleSize > 0 && !shownProfile.sampleWarning?.startsWith('Estimated');
  const playableClubs = bag.clubs.filter((club) => club.inPlay);
  const suggestedClub = estimatedPick(playableClubs, shotShown);
  const activeClub = playableClubs.find((club) => club.id === (pickedClubId ?? suggestedClub?.id)) ?? null;
  const namedClub = activeClub;
  const shotLine = namedClub
    ? clubCarryLine(
        namedClub.slot,
        shotLog.filter((shot) => shot.clubId === namedClub.id).map((shot) => shot.yards),
        namedClub.estimatedCarry ?? null,
      )
    : null;
  const estimateLine = shotLine ?? (measuredCall ? null : starterAdvice(bag.clubs, shotShown));
  const peekLine = (measuredCall ? oneLiner || cardSentence : null) ?? estimateLine ?? cardSentence ?? EMPTY_BAG_ADVICE;
  visibleCall.current = { line: estimateLine ?? cardSentence, clubId: shownId, clubLabel: shownLabel };
  const patternLine = patternCaption({
    onGreen,
    noShots,
    lowConfidence,
    sample: sampleOn,
    oval,
    invite: PATTERN_INVITE,
    thinLine: Boolean(oneLiner && /sample is thin|Thin sample/i.test(oneLiner)),
    emptyBag: bagEmpty,
  });
  const thruLabel = thruHud(holes, pilot.quality.map((item) => item.par));
  const chrome = playChrome({
    screenWidth: windowWidth,
    screenHeight: windowHeight,
    safe: { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left },
  });
  peekRef.current = chrome.coachPeek;
  openRef.current = chrome.coachOpen;
  const closedSheet = closedPlaySheet(chrome.coachPeek);
  closedSheetRef.current = closedSheet;
  if (!sheetOpenRef.current) sheetH.value = closedSheet;
  peekSV.value = chrome.coachPeek;
  openSV.value = chrome.coachOpen;
  const frameSheet = sheetOpen || talk.phase !== 'idle' ? chrome.coachOpen : closedSheet;
  const tipCarry = carryProfile(profiles, shownId);
  const carryYards = tipCarry != null && Number.isFinite(tipCarry.stockYards) ? Math.round(tipCarry.stockYards) : null;
  const carrySpread = carryBand(tipCarry, unit);
  const moved = player ? `${player.lat.toFixed(4)},${player.lon.toFixed(4)}` : 'desk';
  const lineKey = `${shownId ?? ''}:${oneLiner ?? ''}:${carryYards ?? ''}:${carrySpread ?? ''}:${moved}`;
  if (lineClock.current.key !== lineKey) lineClock.current = { key: lineKey, at: Date.now() };
  const ageSec = Math.max(0, Math.floor((clock - lineClock.current.at) / 1000));
  const updatedLabel = ageSec < 60 ? 'Just now' : `Updated ${Math.floor(ageSec / 60)}m ago`;
  const windFrom = sky?.current?.windFromDeg;
  const windArrowDeg =
    windFrom != null && bearing != null && Number.isFinite(windFrom) && Number.isFinite(bearing) ? windFrom + 180 - bearing : null;
  const headText = signedTenths(sky?.headwindMph);
  const elevText = signedTenths(sky?.elevationFeet);
  const tempText = wholeDegrees(sky?.current?.temperatureF);
  const shotPhase = player != null && onTee && !onGreen ? 'tee shot' : onGreen ? 'green' : player != null ? 'approach' : 'position unknown';
  const liveSky = sky?.current != null && (Number.isFinite(sky.current.windMph) || Number.isFinite(sky.current.temperatureF));
  const conditionsNote = [sampleOn ? 'Sample conditions' : null, liveSky ? 'Live sky' : 'Waiting on the sky', `hole ${hole.holeNumber}`, shotPhase]
    .filter((part) => part != null)
    .join(' · ');
  const windTag = Number.isFinite(sky?.current?.windMph) ? 'LIVE' : sampleOn ? 'SAMPLE' : null;
  const tempTag = Number.isFinite(sky?.current?.temperatureF) ? 'LIVE' : sampleOn ? 'SAMPLE' : null;
  const thru = thruScore(pilot.quality.map((item) => ({ par: item.par, strokes: holes[item.holeNumber - 1] ?? null, kept: holes[item.holeNumber - 1] != null })));
  const dispersionLine: LatLon[] = [];
  const strokes = holes[hole.holeNumber - 1] ?? null;
  const par = hole.par;
  const puttCount = putts[hole.holeNumber - 1] ?? null;
  const holeMarks = marks.filter((mark) => mark.hole === hole.holeNumber);
  const face = scoreFace({ par, storedStrokes: strokes, storedPutts: puttCount, markCount: holeMarks.length });
  const lastClosed = [...holeMarks].reverse().find((mark) => mark.yards != null) ?? null;
  const closedShots = holeMarks.filter((mark) => mark.yards != null);
  const reviewedShot = closedShots.find((mark) => mark.id === reviewShotId) ?? null;
  const chipSelectedId = reviewedShot?.clubId ?? activeClub?.id ?? null;
  const missLine = plainMiss(
    calledId == null
      ? []
      : tagged.flatMap((shot) => {
          if (shot.clubId !== calledId) return [];
          if (shot.result !== 'left' && shot.result !== 'right' && shot.result !== 'fairway' && shot.result !== 'hazard' && shot.result !== 'short') return [];
          return [{ side: shot.result, sideYards: null as number | null }];
        }),
  );
  const shownTotal = totalProfile(profiles, shownId);
  const longTotal = !onGreen && !short && shownTotal ? longestWords(shownTotal, unit) : null;
  const answered = debriefs.some((item) => item.hole === hole.holeNumber);
  const moveHole = (dir: 'next' | 'prev') => {
    const current = holeNo.current;
    if (dir === 'next' && current >= 18) return;
    if (dir === 'prev' && current <= 1) return;
    manualNav.current = true;
    advanced.current = 0;
    lastButtonNav.current = { dir, at: Date.now() };
    setCurrentHole((shown) => shown + (dir === 'next' ? 1 : -1));
  };

  const leaveHole = () => {
    moveHole('next');
  };

  const goBack = () => {
    moveHole('prev');
  };
  leaveRef.current = leaveHole;
  backRef.current = goBack;
  holeNo.current = hole.holeNumber;

  const markHere = () => {
    const spot = player ?? overlay.line[0] ?? null;
    if (!spot) return;
    const prior = [...holeMarks].reverse().find((mark) => mark.yards == null) ?? null;
    const closed = prior && player ? closeMarkedShot({ lat: prior.lat, lon: prior.lon }, player, polygons) : null;
    const clubId = activeClub?.id ?? calledId;
    const clubLabel = activeClub?.slot ?? calledLabel;
    recordMark({
      hole: hole.holeNumber,
      lat: spot.lat,
      lon: spot.lon,
      clubId,
      clubLabel,
      close: closed,
    });
    const result = lieResult(closed?.lie ?? null);
    if (prior?.clubId && closed) rememberMeasuredShot(prior.clubId, closed.yards);
    setPickedClubId(null);
    setReviewShotId(null);
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
    savedTimer.current = setTimeout(() => setSaved(null), MARKED_TOAST_MS);
  };

  const heroText = roll != null ? String(Math.round(roll)) : heroBase == null ? '' : formatDistance(heroBase, unit);
  const heroSize = chrome.yardageFont;
  const playsLikeText =
    playsLikeYards != null && shotRaw != null && Math.round(playsLikeYards) !== Math.round(shotRaw)
      ? `PLAYS LIKE ${formatDistance(playsLikeYards, unit)}`
      : null;
  const figure = clubFigure(playsLikeYards, shotRaw, player != null);
  const detail = clubDetail({
    clubLabel: shownLabel,
    metric: shownProfile?.metric === 'carry' ? 'carry' : shownProfile ? 'total' : null,
    stockYards: shownProfile?.stockYards ?? null,
    targetYards: shotShown,
    unit,
  });
  const whyLine = layup?.call === 'lay_up' ? layup.reason : detail.gap;
  const greenMarks = player && greenRing ? greenTargets(player, greenRing) : null;
  const plateRecord = aerialPlate(pilot.courseKey, hole.holeNumber);
  const plate = plateRecord != null && (player == null || pointOnAerial(plateRecord.georef, player)) ? plateRecord : null;
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

  const pendingHere = pendingScore?.hole === hole.holeNumber ? pendingScore.strokes : null;
  const shortLandscape = windowWidth > windowHeight && windowHeight <= 420;
  return (
    <View
      style={[styles.screen, noScroll]}
      onLayout={(event) => setMapH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}
    >
      <Animated.View pointerEvents="box-none" style={[styles.shake, bumpStyle]}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false, title: `Hole ${hole.holeNumber}` }} />
      <ClubPulse clubLabel={shownLabel} yards={landingLabelYards} />
      <Animated.View {...pan.panHandlers} testID="hole-map" style={[styles.mapWrap, mapStyle, noScroll]}>
        <HoleMap
          bleed
          height={mapH}
          pad={{
            ...holeFrame({
              hudHeight: mapHudInset(insets.top),
              dockHeight: 0,
              sheetClosed: sheetOpen ? Math.max(closedSheet, frameSheet - OPEN_DOCK_CLEAR) : frameSheet,
            }),
            left: 120,
          }}
          orient={bearing != null && overlay.line[0] ? { bearing, origin: overlay.line[0] } : null}
          camera={{ kind: cameraKind, reachYards, from: player }}
          labels={[]}
          ellipseScale={1.2}
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={ellipse}
          ellipseCaption={carryChipLine(showSample ? carryYards : null, true)}
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
          onTap={() => {
            if (!sheetOpenRef.current) return;
            heldOpen.current = false;
            if (dwell.current) {
              clearTimeout(dwell.current);
              dwell.current = null;
            }
            talk.close();
            applySheet.current(false);
          }}
          rawLabel=""
          playsLabel=""
          aerial
          imagery={VECTOR_TILE_SOURCE}
          plate={plate}
          aerialNote={plate ? aerialTreeNote(hole.holeNumber) : null}
          showCredit={!sheetOpen}
          creditLeft={windowWidth > windowHeight ? chrome.plate.x + chrome.plate.w + 16 : 14}
          creditRight={88}
          creditBottom={chrome.coachPeek + chrome.actionHeight + Math.max(insets.bottom, 8) + 12}
        />
        <View
          style={[StyleSheet.absoluteFill, styles.mapDrag, noScroll]}
          {...({
            onMouseDown: (event: { preventDefault?: () => void; nativeEvent: { pageX: number; pageY: number } }) => {
              event.preventDefault?.();
              dragOrigin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
            },
            onMouseMove: (event: { preventDefault?: () => void; nativeEvent: { pageX: number; pageY: number } }) => {
              const origin = dragOrigin.current;
              if (!origin) return;
              event.preventDefault?.();
              const dx = event.nativeEvent.pageX - origin.x;
              const dy = event.nativeEvent.pageY - origin.y;
              if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
              applyPan(dx, dy);
            },
            onMouseUp: () => {
              if (!dragOrigin.current) return;
              dragOrigin.current = null;
              panBase.current = { x: panOffX.value, y: panOffY.value };
              setPanMark(`${Math.round(panOffX.value)},${Math.round(panOffY.value)}`);
            },
          } as object)}
        />
      </Animated.View>
      <View
        pointerEvents="box-none"
        accessibilityLabel={`Hole ${hole.holeNumber}, par ${par ?? 'unknown'}, stroke index ${hole.strokeIndex ?? 'unknown'}`}
        accessibilityHint="Swipe left for the next hole. Swipe right for the previous hole."
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') leaveRef.current();
          if (event.nativeEvent.actionName === 'decrement') backRef.current();
        }}
        style={[styles.holePill, { top: chrome.pill.y, left: chrome.pill.x, width: chrome.pill.w, height: chrome.pill.h }]}
        testID="hole-pill"
      >
        <Glass radius={19} style={styles.holePillGlass} contentStyle={styles.holePillFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous hole"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={goBack}
            style={({ pressed }) => [styles.pillArrow, pressed && !reduceMotion && styles.pressed]}
          >
            <Text style={styles.pillArrowText}>‹</Text>
          </Pressable>
          <View style={styles.pillPair}>
            <Text style={styles.pillMeta}>PAR</Text>
            <Text style={[styles.pillNum, { fontFamily: display }]}>{par ?? '—'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Home"
            hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
            onPress={() => router.push('/')}
            style={styles.pillBallHit}
          >
            <View testID="hole-number" style={styles.pillBall}>
              <Text style={[styles.pillBallNum, { fontFamily: display }]}>{hole.holeNumber}</Text>
            </View>
          </Pressable>
          {hole.holeNumber >= 18 ? null : (
          <View style={styles.pillPair}>
            <Text style={styles.pillMeta}>{strokes != null ? 'SCR' : 'HCP'}</Text>
            <Text accessibilityLabel={strokes != null ? `Saved score ${strokes}` : undefined} style={[styles.pillNum, { fontFamily: display }]}>{strokes != null ? strokes : hole.strokeIndex ?? '—'}</Text>
          </View>
          )}
          {hole.holeNumber >= 18 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Finish hole" testID="hole-finish-pill" onPress={() => setScoreAsk((value) => value + 1)} style={styles.finishPill}>
              <Text style={styles.finishPillText}>Finish</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next hole"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={leaveHole}
              style={({ pressed }) => [styles.pillArrow, pressed && !reduceMotion && styles.pressed]}
            >
              <Text style={styles.pillArrowText}>›</Text>
            </Pressable>
          )}
        </Glass>
      </View>
      {thruLabel ? (
        <View
          testID="thru-label"
          pointerEvents="none"
          style={[styles.thruChip, { top: chrome.pill.y + chrome.pill.h + 8, right: 12 }]}
        >
          <Text accessibilityLabel={thruLabel} style={styles.thruText}>
            {thruLabel}
          </Text>
        </View>
      ) : null}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        testID="map-pan"
        style={styles.mapOffset}
        {...({ dataSet: { offset: panMark } } as object)}
      />
      <Text
        testID="caddie-speech"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.speechProbe}
        {...({ accessibilityHidden: true, 'aria-hidden': true } as object)}
      >
        {speechPhase}
      </Text>
      <View pointerEvents="box-none" style={[styles.hero, { top: chrome.plate.y, left: chrome.plate.x, maxWidth: chrome.plate.w }]}>
        <View style={[styles.heroPlate, hole.holeNumber === 2 && styles.heroPlateClear]}>
        {player == null ? (
          <Pressable
            testID="yardage-plate"
            accessibilityRole="button"
            accessibilityLabel={manual == null ? 'Waiting for GPS, or tap to set your position' : `Shot yards${playsLikeText ? `, ${playsLikeText}` : ''}`}
            delayLongPress={450}
            onPress={() => {
              setOverrideDraft(manual == null ? '' : formatDistance(manual, unit));
              setOverrideOpen(true);
            }}
            onLongPress={() => {
              setOverrideDraft(manual == null ? '' : formatDistance(manual, unit));
              setOverrideOpen(true);
            }}
          >
            {overrideOpen ? (
              <TextInput
                value={overrideDraft}
                onChangeText={setOverrideDraft}
                keyboardType="decimal-pad"
                autoFocus
                style={[styles.heroInput, { fontFamily: display }]}
                accessibilityLabel="Manual yards"
                onBlur={() => {
                  const accepted = acceptShotYards(Number(overrideDraft));
                  if (typeof accepted === 'number') setManualYards(hole.holeNumber, displayToYards(accepted, unit));
                  setOverrideOpen(false);
                }}
              />
            ) : (
              <Text style={[styles.heroNum, { fontFamily: display, fontSize: shortLandscape ? 28 : heroSize, lineHeight: shortLandscape ? 30 : heroSize + 4 }]}>{heroText === '' ? '—' : heroText}</Text>
            )}
            <Text style={[styles.heroCap, shortLandscape && { marginTop: 0 }]}>{unit === 'yd' ? 'YARDS TO GREEN' : 'METERS TO GREEN'}</Text>
            {manual == null ? <Text style={styles.fbInvite}>Waiting for GPS · tap to set position</Text> : null}
          </Pressable>
        ) : (
          <View testID="yardage-plate" pointerEvents="none" accessibilityLabel={playsLikeText ? `${heroText} yards to the green. ${playsLikeText}` : undefined}>
            <Text style={[styles.heroNum, { fontFamily: display, fontSize: shortLandscape ? 28 : heroSize, lineHeight: shortLandscape ? 30 : heroSize + 4 }]}>{heroText === '' ? '—' : heroText}</Text>
            <Text style={[styles.heroCap, shortLandscape && { marginTop: 0 }]}>{unit === 'yd' ? 'YARDS TO GREEN' : 'METERS TO GREEN'}</Text>
          </View>
        )}
        {ground ? (
          <View
            pointerEvents="none"
            style={[styles.fbLine, shortLandscape && { marginTop: 2 }]}
            accessibilityLabel={`Front ${formatDistance(ground.frontYards, unit)}, back ${formatDistance(ground.backYards, unit)}`}
          >
            <Text style={styles.fbWord}>FRONT</Text>
            <Text style={[styles.fbNum, { fontFamily: display }]}>{formatDistance(ground.frontYards, unit)}</Text>
            <Text style={styles.fbDot}>·</Text>
            <Text style={styles.fbWord}>BACK</Text>
            <Text style={[styles.fbNum, { fontFamily: display }]}>{formatDistance(ground.backYards, unit)}</Text>
          </View>
        ) : null}
        {playsLikeText && !shortLandscape ? <Text style={styles.playsLike}>{playsLikeText}</Text> : null}
        </View>
      </View>
      {hazardYards != null ? (
        <View pointerEvents="box-none" style={[styles.hazardFloat, { top: insets.top + 210 }]}>
          <Glass radius={18} contentStyle={styles.hazardFill}>
            <Text style={styles.hint}>{`Hazard ${formatDistance(hazardYards, unit)}`}</Text>
          </Glass>
        </View>
      ) : null}
      <Animated.View testID="coach-sheet" style={[styles.sheet, sheetStyle, justYards ? { display: 'none' } : null, { right: 84, bottom: Math.max(insets.bottom, 8) + chrome.actionHeight + (sheetOpen ? keyboard : 0), zIndex: sheetOpen ? 8 : 2 }]}>
        <Glass radius={28} style={styles.sheetGlass} contentStyle={styles.sheetFill}>
          <SheetBall reduceMotion={reduceMotion} compact />
          <View style={styles.grab}>
            <View {...sheetPan.panHandlers} style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
            {draftNote ? (
              <View style={styles.draftBanner}>
                <Text style={styles.draftBannerText}>{draftNote}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss note" onPress={dismissPlayNote} style={styles.draftDismiss}>
                  <Text style={styles.draftDismissText}>Dismiss</Text>
                </Pressable>
              </View>
            ) : null}
            {sheetOpen ? <View style={styles.tabs}>
              {(['course', 'coach', 'stats'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  accessibilityRole="button"
                  accessibilityLabel={tab === 'coach' ? 'Coach AI' : tab === 'course' ? 'Course' : 'Stats'}
                  onPress={() => setSheetTab(tab)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={styles.tabHit}
                >
                  <Text style={[styles.tab, sheetTab === tab && styles.tabOn]}>{tab === 'coach' ? 'Coach AI' : tab === 'course' ? 'Course' : 'Stats'}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel="Hide coach" onPress={() => applySheet.current(false)} style={styles.coachPeekHit}>
                <Text style={styles.line}>Hide</Text>
              </Pressable>
            </View> : null}
            <View style={{ marginTop: SHEET_BALL_TEXT.closedPx }}>
            {!sheetOpen ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Coach AI" testID="coach-line" onPress={() => applySheet.current(true)} style={styles.coachPeekHit}>
                {onTee && !onGreen ? <Text style={styles.teeKicker}>TEE SHOT </Text> : null}
                <Text numberOfLines={2} style={styles.line}>{peekLine}</Text>
              </Pressable>
            ) : sheetTab === 'course' ? (
              <Text style={styles.line} numberOfLines={2}>{`${courseCall(pilot.record.name)}. ${holeSubline({ hole: hole.holeNumber, par })}`}</Text>
            ) : sheetTab === 'stats' ? (
              sheetOpen ? null : (
                <View style={styles.statsPeek}>
                  <View style={styles.statsPeekCopy}>
                    <Text style={styles.thruWord}>{thru.label ?? 'THRU 0'}</Text>
                    <ThruBar label={thru.label ?? 'THRU'} pips={thru.pips} />
                  </View>
                  <DictateButton
                    live={talk.phase !== 'idle'}
                    onPress={() => {
                      applySheet.current(true);
                      talk.open();
                    }}
                  />
                </View>
              )
            ) : null}
            </View>
          </View>
          {sheetOpen && sheetTab === 'coach' ? (
          <View style={styles.heard}>
            {shortLandscape ? null : <Waveform live={talk.phase === 'listening' || talk.phase === 'speaking'} compact />}
            {talk.sample ? <Text style={styles.clubMeta}>{SAMPLE_ANSWER_LABEL}</Text> : null}
            {shortLandscape ? null : <Text style={styles.clubMeta}>You</Text>}
            <Text testID="you-line" numberOfLines={shortLandscape ? 1 : undefined} style={styles.line}>{talk.draft.trim() || talk.transcript || 'Hold the mic, or type it.'}</Text>
            {shortLandscape ? null : <Text style={styles.clubMeta}>Caddie</Text>}
            <ScrollView testID="caddie-answer" style={[styles.answerScroll, shortLandscape && { maxHeight: talk.reply ? 20 : 0 }]}>
              {talk.reply ? <YardageLine text={talk.reply} /> : <Text style={styles.line}> </Text>}
            </ScrollView>
          </View>
          ) : null}
          {pendingHere != null && sheetOpen ? (
            <View testID="confirm-score" style={styles.confirmScore}>
              <Text style={styles.confirmScoreText}>{`Save ${pendingHere}?`}</Text>
              <View style={styles.confirmActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel score" onPress={() => setPendingScore(null)} style={styles.confirmCancel}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm score"
                  onPress={() => {
                    if (pendingScore == null || pendingScore.hole !== hole.holeNumber) {
                      setPendingScore(null);
                      return;
                    }
                    const { strokes, hole: savedHole } = pendingScore;
                    setPendingScore(null);
                    talk.answer(`Saved ${strokes} on hole ${savedHole}`);
                    holdCoach.current = true;
                    setSheetTab('coach');
                    setStrokes(savedHole, strokes);
                    setPutts(savedHole, 0);
                    setPenalties(savedHole, 0);
                    setUndoHole(savedHole);
                    setScoreToast(scoreSavedLabel(strokes, par));
                    if (savedHole >= 18) {
                      finishRound({ hole: savedHole, strokes, putts: 0, penalties: 0, fairway: null, gir: null });
                      router.push('/recap');
                    } else leaveHole();
                  }}
                  style={styles.confirmGo}
                >
                  <Text style={styles.confirmGoText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {sheetOpen && sheetTab === 'coach' && talk.typed && pendingHere == null ? (
            <View style={styles.typeRow}>
              <TextInput
                value={talk.draft}
                onChangeText={talk.setDraft}
                placeholder="Ask your caddie…"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={styles.askInput}
                accessibilityLabel="Typed ask"
                onSubmitEditing={() => {
                  const text = talk.draft.trim();
                  talk.setDraft('');
                  const heard = spokenStrokes(text, par ?? 4);
                  if (heard != null) {
                    talk.pinHeard(text);
                    setPendingScore({ hole: hole.holeNumber, strokes: heard });
                    return;
                  }
                  void talk.ask(text, 'typed');
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send question"
                style={styles.coachPeekHit}
                onPress={() => {
                  const text = talk.draft.trim();
                  talk.setDraft('');
                  const heard = spokenStrokes(text, par ?? 4);
                  if (heard != null) {
                    talk.pinHeard(text);
                    setPendingScore({ hole: hole.holeNumber, strokes: heard });
                    return;
                  }
                  void talk.ask(text, 'typed');
                }}
              >
                <Text style={[styles.micLabel, styles.sendHit]}>Send</Text>
              </Pressable>
            </View>
          ) : null}
          {sheetOpen && sheetTab === 'coach' && !shortLandscape ? (
          <ScrollView ref={detailsRef} style={[styles.details, styles.scrollMask, { marginBottom: SHEET_BALL_TEXT.openPx + foldPad }]} contentContainerStyle={styles.detailsBody} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
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
            ) : !bagEmpty && patternLine ? (
              <Text style={styles.sample}>{patternLine}</Text>
            ) : null}
            {figure ? <Text style={styles.body}>{`${figure.label} ${formatDistance(figure.yards, unit)}`}</Text> : null}
            {whyLine ? <Text style={styles.body}>{whyLine}</Text> : null}
            {ask.banner ? <View>{ask.banner}</View> : null}
            {detail.median ? <Text style={styles.body}>{detail.median}</Text> : null}
            {tipCarry ? <Text style={styles.body}>{carryWords(tipCarry, unit)}</Text> : null}
            {shownId && !tipCarry ? <Text style={styles.body}>Carry was not measured.</Text> : null}
            {longTotal ? <Text style={styles.body}>{longTotal}</Text> : null}
            {missLine ? <Text style={styles.body}>{missLine}</Text> : null}
            <Text style={styles.body}>Putts stay off the score.</Text>
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
          {sheetOpen && sheetTab === 'stats' ? (
            <ScrollView
              style={[styles.details, styles.scrollMask, { marginBottom: SHEET_BALL_TEXT.openPx }]}
              contentContainerStyle={styles.statsBody}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.statsHead}>
                <Text style={styles.statNote}>{conditionsNote}</Text>
                <DictateButton
                  live={talk.phase !== 'idle'}
                  onPress={() => {
                    applySheet.current(true);
                    talk.open();
                  }}
                />
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statTile} accessibilityLabel={headText === '—' ? 'Wind unknown' : `Wind ${headText} miles per hour, ${windTag === 'LIVE' ? 'live' : windTag === 'SAMPLE' ? 'sample' : 'unknown'}`}>
                  <View style={styles.statLabelRow}>
                    <View style={styles.statLabelPair}>
                      <Text style={styles.statLabel}>WIND</Text>
                      {windTag ? <Text style={styles.statLive}>{windTag}</Text> : null}
                    </View>
                    <WindArrow degrees={windArrowDeg} />
                  </View>
                  <Text style={[styles.statValue, { fontFamily: display }]}>
                    {headText}
                    {headText === '—' ? null : <Text style={styles.statUnit}> MPH</Text>}
                  </Text>
                </View>
                <View style={styles.statTile} accessibilityLabel={elevText === '—' ? 'Elevation unknown' : `Elevation ${elevText} feet`}>
                  <Text style={styles.statLabel}>ELEV</Text>
                  <Text style={[styles.statValue, { fontFamily: display }]}>
                    {elevText}
                    {elevText === '—' ? null : <Text style={styles.statUnit}> FT</Text>}
                  </Text>
                </View>
                <View style={styles.statTile} accessibilityLabel={tempText === '—' ? 'Temperature unknown' : `Temperature ${tempText} degrees, ${tempTag === 'LIVE' ? 'live' : tempTag === 'SAMPLE' ? 'sample' : 'unknown'}`}>
                  <View style={styles.statLabelPair}>
                    <Text style={styles.statLabel}>TEMP</Text>
                    {tempTag ? <Text style={styles.statLive}>{tempTag}</Text> : null}
                  </View>
                  <Text style={[styles.statValue, { fontFamily: display }]}>
                    {tempText}
                    {tempText === '—' ? null : <Text style={styles.statUnit}> °F</Text>}
                  </Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>PUTTS</Text>
                  <PuttStepper value={puttCount} onWrite={writePutts} />
                </View>
              </View>
              <ThruBar label={thru.label ?? 'THRU'} pips={thru.pips} />
              <Pressable accessibilityRole="button" accessibilityLabel="Analysis" onPress={() => router.push('/analysis')} style={styles.textHit}>
                <Text style={styles.body}>Analysis</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </Glass>
      </Animated.View>
      {!justYards && playableClubs.length > 0 ? (
        <View
          testID="club-chip-panel"
          pointerEvents="box-none"
          style={[
            styles.clubChipWrap,
            windowWidth > windowHeight
              ? { top: chrome.pill.y, left: chrome.pill.x + chrome.pill.w + 8, right: 8, maxHeight: 56, flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }
              : { bottom: Math.max(insets.bottom, 8) + chrome.actionHeight + chrome.coachPeek + 8, left: 8, right: 8 },
          ]}
        >
          <Text testID="club-chip-hint" accessibilityLabel="Swipe for more clubs" style={styles.chipHint}>Swipe for clubs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="club-chips" contentContainerStyle={styles.clubChipRow}>
            {playableClubs.map((club) => {
              const selected = club.id === chipSelectedId;
              return (
                <Pressable
                  key={club.id}
                  accessibilityRole="button"
                  accessibilityLabel={club.slot}
                  accessibilityState={{ selected }}
                  testID={selected ? 'club-chip-on' : 'club-chip'}
                  onPress={() => {
                    const reviewId = reviewShotIdRef.current;
                    if (reviewId) {
                      reassignShot(reviewId, club.id, club.slot);
                      return;
                    }
                    setPickedClubId(club.id);
                  }}
                  style={[styles.clubChip, selected && styles.clubChipOn]}
                >
                  <Text style={[styles.clubChipText, selected && styles.clubChipTextOn]}>{club.slot}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <View pointerEvents="box-none" style={[styles.askFloat, { right: 8, bottom: Math.max(insets.bottom, 8) + chrome.actionHeight, width: 56, height: 56 }]}>
        {ask.button}
      </View>
      <View pointerEvents="box-none" style={[styles.actionDock, { bottom: Math.max(insets.bottom, 8) }]}>
        <ScoreDock
          scoreAsk={scoreAsk}
          hole={hole.holeNumber}
          par={par}
          savedStrokes={strokes}
          savedPutts={puttCount}
          savedPenalties={penalties[hole.holeNumber - 1] ?? null}
          savedFairway={fairways[hole.holeNumber - 1] ?? null}
          savedGir={girs[hole.holeNumber - 1] ?? null}
          markCount={holeMarks.length}
          screenHeight={windowHeight}
          pendingStrokes={pendingHere}
          thruLabel={thruLabel}
          onMark={markHere}
          voiceMuted={talkPrefs.muted}
          handsFree={talkPrefs.handsFree}
          onToggleMute={() => talkPrefs.setMuted(!talkPrefs.muted)}
          onToggleHandsFree={() => talkPrefs.setHandsFree(!talkPrefs.handsFree)}
          holeShots={closedShots.map((mark) => ({ id: mark.id, label: mark.clubLabel ?? 'Shot', yards: mark.yards ?? 0 }))}
          reviewShotId={reviewShotId}
          onReviewShot={chooseReview}
          onCycleShot={(id) => {
            const shot = closedShots.find((mark) => mark.id === id);
            if (!shot) return;
            const index = playableClubs.findIndex((club) => club.id === shot.clubId);
            const next = playableClubs[(index + 1) % playableClubs.length];
            if (!next) return;
            reassignShot(id, next.id, next.slot);
          }}
          shotYards={lastClosed?.yards ?? null}
          onDeleteShot={deleteLastShot}
          onAdjustShot={adjustLastShot}
          onSetShotYards={setLastShotYards}
          onPause={() => router.push('/')}
          onEnd={() => {
            finishRound();
            router.push('/recap');
          }}
          justYards={justYards}
          onToggleJustYards={() => setJustYards((value) => !value)}
          batterySaver={batterySaver}
          onToggleBattery={() => setBatterySaver((value) => !value)}
          onScoreSaved={(saved) => {
            setPendingScore(null);
            setScoreToast(scoreSavedLabel(saved, par));
          }}
          canUndoScore={undoHole != null}
          onUndoScore={() => {
            if (undoHole == null) return;
            setStrokes(undoHole, null);
            setCurrentHole(undoHole);
            setUndoHole(null);
          }}
          onSave={(draft, finish) => {
            setPendingScore(null);
            const puttsSaved = Math.min(draft.strokes, draft.putts ?? 0);
            writeStrokes(draft.strokes);
            setPutts(hole.holeNumber, puttsSaved);
            setPenalties(hole.holeNumber, draft.penalties ?? 0);
            setFairway(hole.holeNumber, draft.fairway);
            setGir(hole.holeNumber, draft.gir);
            if (!finish) setUndoHole(hole.holeNumber);
            if (finish) {
              finishRound({
                hole: hole.holeNumber,
                strokes: draft.strokes,
                putts: puttsSaved,
                penalties: draft.penalties ?? 0,
                fairway: draft.fairway,
                gir: draft.gir,
              });
              router.push('/recap');
            } else leaveHole();
          }}
        />
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
      {talk.overlay}
      {scoreToast ? (
        <View testID="par-undo-toast" accessibilityLabel={scoreToast} style={[styles.toast, { top: chrome.toast.y, left: chrome.toast.x, width: Math.max(chrome.toast.w, 200) }]}>
          <Text style={styles.toastText}>{scoreToast}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={scoreToast === 'Par saved' ? 'Undo par' : 'Undo score'}
            onPress={() => {
              if (undoHole != null) {
                setStrokes(undoHole, null);
                setCurrentHole(undoHole);
                setUndoHole(null);
              }
              setScoreToast(null);
            }}
            style={styles.toastUndo}
          >
            <Text style={styles.toastUndoText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
      {saved && !scoreToast ? (
        <View testID="marked-toast" accessibilityLabel="Marked" style={[styles.toast, { top: chrome.toast.y, left: chrome.toast.x, width: chrome.toast.w }]}>
          <Text style={styles.toastText}>Marked</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo last mark" onPress={() => { dropLastMark(); setSaved(null); }} style={styles.toastUndo}>
            <Text style={styles.toastUndoText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Points up the hole. Degrees rotate it to the direction the wind is blowing. */
function WindArrow({ degrees }: { degrees: number | null }) {
  if (degrees == null || !Number.isFinite(degrees)) return null;
  return (
    <View style={[styles.windArrow, { transform: [{ rotate: `${degrees}deg` }] }]}>
      <View style={styles.windArrowHead} />
      <View style={styles.windArrowStem} />
    </View>
  );
}

/** Putts on the Stats tile. Minus and plus stay 44px targets around a 36px ring. */
function PuttStepper({ value, onWrite }: { value: number | null; onWrite: (next: number) => void }) {
  const display = useDisplayFace();
  const shown = value == null ? 0 : value;
  const step = (move: 'up' | 'down') => {
    onWrite(scoreCommit(shown, move, 0));
    void tick();
  };
  return (
    <View style={styles.puttRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fewer putts" onPress={() => step('down')} style={styles.puttHit}>
        <View style={styles.puttRing}>
          <Text style={styles.puttSign}>−</Text>
        </View>
      </Pressable>
      <Text accessibilityLabel={`Putts ${shown}`} style={[styles.puttNum, { fontFamily: display }]}>
        {String(shown)}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="More putts" onPress={() => step('up')} style={styles.puttHit}>
        <View style={styles.puttRing}>
          <Text style={styles.puttSign}>+</Text>
        </View>
      </Pressable>
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

const noScroll = { touchAction: 'none' } as object;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: fieldNavy, overflow: 'hidden' },
  mapDrag: {},
  shake: { flex: 1, zIndex: 0 },
  mapWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: fieldNavy, zIndex: 0 },
  hud: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 10, zIndex: 20 },
  hudFill: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4 },
  hudTop: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleGap: { flex: 1 },
  thruRow: { minHeight: 20, justifyContent: 'center', paddingHorizontal: 4 },
  statsPeek: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  statsPeekCopy: { flex: 1, gap: 2 },
  thruWord: { color: '#FFFFFF', fontFamily: font.family, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1 },
  statsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingRight: 4 },
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
  nextHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevronNext: {
    width: 12,
    height: 12,
    borderRightWidth: 3,
    borderTopWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginRight: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', gap: 4, minHeight: 44, alignItems: 'center' },
  tabHit: { minWidth: 48, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  tab: { color: 'rgba(255,255,255,0.55)', fontFamily: font.family, fontSize: 11, fontWeight: '700' },
  tabOn: { color: '#FFFFFF' },
  tipCard: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  spark: { color: '#8AC926', fontSize: 14, lineHeight: 14 },
  tipTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 16, fontWeight: '700' },
  clubHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 18, overflow: 'visible', zIndex: 6 },
  clubHeadTitle: { flex: 1 },
  carrySentence: { color: '#FFFFFF', fontFamily: font.family, fontSize: 14, lineHeight: 14, fontWeight: '600' },
  carryNum: { color: '#FFFFFF', fontSize: 16, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  micSlot: { width: 30, height: 18, overflow: 'visible' },
  micHit: { position: 'absolute', width: 44, height: 44, top: -20, left: -7, alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  micButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,10,24,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  micButtonLive: { backgroundColor: 'rgba(138,201,38,0.92)', borderColor: '#FFFFFF' },
  micHead: { width: 6, height: 8, borderRadius: 3, backgroundColor: '#FFFFFF', zIndex: 1 },
  micCradle: {
    width: 12,
    height: 6,
    marginTop: -4,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  micStem: { width: 1.5, height: 3, backgroundColor: '#FFFFFF', marginTop: -1 },
  micFoot: { width: 8, height: 1.5, borderRadius: 1, backgroundColor: '#FFFFFF' },
  micLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, fontWeight: '700' },
  talkGrow: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, marginBottom: 8, paddingHorizontal: 12, minHeight: 52, borderRadius: 12, backgroundColor: '#041018' },
  askInput: {
    flex: 1,
    minHeight: 48,
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.35)',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  backHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  sheetFill: { flex: 1, minHeight: 0 },
  grab: { paddingTop: 0, paddingHorizontal: 12, paddingBottom: 0, zIndex: 4 },
  tipHit: { marginTop: 2 },
  tip: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold },
  tipLink: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, textDecorationLine: 'underline' },
  handleHit: { minHeight: 6, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.72)' },
  clubRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubCopy: { flex: 1, gap: 0 },
  clubName: { color: '#FFFFFF', fontFamily: font.family, fontSize: 22, lineHeight: 24, fontWeight: font.bold, letterSpacing: 0.3 },
  clubMeta: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 14, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  line: { color: '#FFFFFF', fontFamily: font.family, fontSize: 14, lineHeight: 15, fontWeight: font.medium },
  unlock: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 22, fontWeight: font.medium, marginTop: 0 },
  sample: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  dim: { opacity: 0.55 },
  kicker: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  details: { flex: 1, minHeight: 0, zIndex: 1 },
  scrollMask: {
    maskImage: `linear-gradient(to bottom, transparent, #000 ${SHEET_BALL_SCROLL_FADE}px, #000 calc(100% - ${SHEET_BALL_SCROLL_FADE_BOTTOM}px))`,
  } as unknown as ViewStyle,
  heard: { paddingHorizontal: 16, paddingBottom: 4, gap: 4, zIndex: 1 },
  detailsBody: { paddingHorizontal: 16, paddingTop: SHEET_BALL_SCROLL_FADE, paddingBottom: 48, gap: 12 },
  body: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  textHit: { minHeight: 56, justifyContent: 'center' },
  dock: { position: 'absolute', left: 12, right: 112, zIndex: 6, gap: 4 },
  dockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  askFloat: { position: 'absolute', zIndex: 10 },
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
  draftBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, backgroundColor: '#041018', borderRadius: 12, paddingLeft: 12, paddingVertical: 4 },
  draftBannerText: { flex: 1, color: '#FFFFFF', fontFamily: font.family, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  draftDismiss: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  draftDismissText: { color: '#8AC926', fontFamily: font.family, fontSize: 13, fontWeight: '800' },
  heroScrim: { position: 'absolute', left: 0, width: 220, height: 250, zIndex: 3 },
  holePill: { position: 'absolute', left: 12, zIndex: 6, overflow: 'hidden' },
  holePillGlass: { height: 56, overflow: 'hidden' },
  holePillFill: {
    height: 56,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  pillPair: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  pillStack: { alignItems: 'center', justifyContent: 'center', minWidth: 28 },
  actionDock: { position: 'absolute', left: 0, right: 0, zIndex: 9 },
  confirmScore: { minHeight: 56, borderRadius: 14, backgroundColor: '#041018', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginHorizontal: 8, marginBottom: 8, gap: 12 },
  confirmActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confirmCancel: { minWidth: 56, minHeight: 56, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  confirmCancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  confirmGo: { minWidth: 56, minHeight: 56, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#C8102E', alignItems: 'center', justifyContent: 'center' },
  confirmGoText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  confirmScoreText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  confirmScoreHit: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    zIndex: 100,
    elevation: 100,
    width: 220,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F4F1EA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  toastText: { color: '#0B1F3A', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  toastUndo: { minWidth: 56, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  toastUndoText: { color: '#0B1F3A', fontSize: 16, fontWeight: '800' },
  thruChip: { position: 'absolute', zIndex: 20, maxWidth: 150, minHeight: 28, justifyContent: 'center', backgroundColor: 'rgba(2,6,14,0.88)', borderRadius: 8, paddingHorizontal: 8 },
  thruText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  mapOffset: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', left: -20, top: 0 },
  speechProbe: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', left: -20, top: 0 },
  clubChipWrap: { position: 'absolute', zIndex: 6, gap: 2, backgroundColor: '#041018', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  chipHint: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', alignSelf: 'flex-end' },
  clubChipRow: { gap: 6, alignItems: 'center', paddingRight: 8 },
  finishPill: { minWidth: 64, minHeight: 44, borderRadius: 12, backgroundColor: '#8AC926', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  finishPillText: { color: '#0B1F3A', fontSize: 13, fontWeight: '800' },
  clubChip: { minHeight: 56, minWidth: 56, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,14,0.88)' },
  clubChipOn: { backgroundColor: '#8AC926' },
  clubChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  clubChipTextOn: { color: '#0B1F3A' },
  answerScroll: { maxHeight: 72, flexGrow: 0 },
  coachPeekHit: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  sendHit: { minWidth: 44, minHeight: 44, textAlign: 'center', lineHeight: 44 },
  pillArrow: { width: 44, height: 56, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillArrowText: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '800' },
  pillBallHit: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pillBall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBallNum: { color: '#06101C', fontSize: 22, lineHeight: 22, fontWeight: '700' },
  hero: { position: 'absolute', left: 12, zIndex: 8, alignItems: 'flex-start', maxWidth: 176 },
  heroPlate: {
    maxWidth: 176,
    backgroundColor: '#02060E',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 8,
  },
  heroPlateClear: { paddingHorizontal: 2, paddingBottom: 4 },
  heroNum: {
    alignSelf: 'flex-start',
    color: '#FFFFFF',
    fontSize: 120,
    lineHeight: 98,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  heroInput: {
    color: '#FFFFFF',
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    minWidth: 140,
    fontVariant: ['tabular-nums'],
  },
  heroCap: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1.26,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  fbLine: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  fbWord: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  fbNum: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  fbDot: { color: '#FFFFFF', opacity: 0.55, marginHorizontal: 4, fontSize: 11, lineHeight: 14 },
  playsLike: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 6,
  },
  fbInvite: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  rail: { position: 'absolute', right: 12, zIndex: 7, gap: 12, alignItems: 'center' },
  railBtn: { width: 56, height: 56 },
  railFill: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  railLabel: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  markBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8AC926',
    borderWidth: 2,
    borderColor: '#06101C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markBadgeNum: { color: '#06101C', fontSize: 15, lineHeight: 16, fontWeight: '700' },
  sight: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  sightRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#8AC926',
  },
  sightH: { position: 'absolute', width: 22, height: 2, backgroundColor: '#8AC926' },
  sightV: { position: 'absolute', width: 2, height: 22, backgroundColor: '#8AC926' },
  undoFloat: { position: 'absolute', left: 12, right: 84, zIndex: 7 },
  teeKicker: { color: '#8AC926', fontFamily: font.family, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  teeChip: {
    backgroundColor: '#02060E',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statsBody: { paddingHorizontal: 6, paddingTop: SHEET_BALL_SCROLL_FADE, paddingBottom: 48, gap: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  statTile: {
    width: '48%',
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabelPair: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLive: {
    color: '#8AC926',
    backgroundColor: '#02060E',
    fontFamily: font.family,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontFamily: font.family,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 1.26,
  },
  statValue: { color: '#FFFFFF', fontSize: 44, lineHeight: 44, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  statUnit: { color: 'rgba(255,255,255,0.78)', fontFamily: font.family, fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1.2 },
  statNote: { color: 'rgba(255,255,255,0.85)', fontFamily: font.family, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  windArrow: { width: 14, height: 18, alignItems: 'center' },
  windArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  windArrowStem: { width: 2, height: 8, backgroundColor: '#FFFFFF', marginTop: -1 },
  puttRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  puttHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  puttRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puttSign: { color: '#FFFFFF', fontSize: 22, lineHeight: 24, fontWeight: '700' },
  puttNum: { color: '#FFFFFF', fontSize: 40, lineHeight: 40, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'], fontWeight: '700' },
});
