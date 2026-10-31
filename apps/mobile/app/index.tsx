import { useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { buildTalkContext, holeOverlay, ringCentroid, roundProgress, shotBearing } from '@coopr/engine';
import { requestTalk, SAMPLE_ANSWER_LABEL } from '../src/talk-client';
import { readArchive } from '../src/analysis/archive';
import { homeRoundSummary } from '../src/analysis/home-rounds';
import type { StoredRound } from '../src/analysis/from-round';
import { subscribeDevice } from '../src/device-store';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font } from '@coopr/tokens';
import { useReduceMotion } from '../src/design/reduce-motion';
import { useDisplayFace } from '../src/design/display-font';
import { bagGlance, courseCall, coursePill, hypeHero, skyLine, TEE_IT_UP } from '../src/design/home-copy';
import { homeSheetHeights, snapHomeSheet, type HomeSheetStop } from '../src/design/responsive';
import { foldSnap } from '../src/design/play-polish';
import { fieldNavy } from '../src/design/theme';
import { Glass } from '../src/design/glass';
import { SheetBall } from '../src/design/sheet-ball';
import { SHEET_BALL_SCROLL_FADE, SHEET_BALL_TEXT } from '../src/design/sheet-ball-geometry';
import { HoleMap } from '../src/hole-map';
import { aerialPlate } from '../src/aerial/registry';
import { AERIAL_CREDIT } from '../src/aerial/project';
import { VECTOR_TILE_SOURCE } from '../src/tile-source';
import { useLocalStore } from '../src/local-store';
import { useBagScan } from '../src/bag-scan/session';
import { starterBag } from '../src/clubs/starter';
import { suggestedPath } from '../src/design/suggested-line';
import { readWeather, type WeatherRead } from '../src/weather';
import { Crest } from '../src/ui';

const pilot = loadHighCedarsPilot();
const SHEET_SPRING = { damping: 18, stiffness: 190, mass: 0.75 };

/**
 * LAWYER: The USDA NAIP, OpenStreetMap, and stylized-imagery lines are not painted
 * on the map. They open from the © control and stay on More. If counsel requires
 * the credit to stay visible on the picture, put the short line back on the map.
 */
function ringsOf(features: readonly MapFeature[]): LatLon[][] {
  return features.flatMap((feature) => feature.rings.filter((ring) => ring.length >= 3).map((ring) => [...ring]));
}

function windCell(sky: WeatherRead | null): string {
  const mph = sky?.current?.windMph;
  if (mph == null || !Number.isFinite(mph)) return '—';
  const base = `${Math.round(mph)} MPH`;
  const face = sky?.headwindMph;
  if (face == null || !Number.isFinite(face)) return base;
  const rounded = Math.round(face);
  if (rounded > 0) return `${base} · ${rounded} IN YOUR FACE`;
  if (rounded < 0) return `${base} · ${Math.abs(rounded)} HELPING`;
  return `${base} · ACROSS`;
}

function tempCell(sky: WeatherRead | null): string {
  const temp = sky?.current?.temperatureF;
  if (temp == null || !Number.isFinite(temp)) return '—';
  return `${Math.round(temp)}°`;
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

export default function HomeScreen() {
  const { currentHole, score, clubs, displayName, onboarded, inProgress } = useLocalStore();
  const bag = useBagScan();
  const display = useDisplayFace();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheets = homeSheetHeights(windowWidth, windowHeight, Math.max(insets.bottom, 0));
  const sheetsRef = useRef(sheets);
  sheetsRef.current = sheets;
  const reduceMotion = useReduceMotion();
  const hero = hypeHero({ name: displayName.trim(), course: pilot.record.name });
  const [archive, setArchive] = useState<StoredRound[]>([]);
  const summary = homeRoundSummary(archive);
  const progress = roundProgress(summary.kept);
  const grossShown = summary.kept >= 3 && summary.lastKept?.gross != null ? String(summary.lastKept.gross) : '—';
  const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
  const started = inProgress || score.holesEntered > 0 || currentHole > 1;
  const sticker = started ? 'RESUME ROUND' : 'START ROUND';
  const courseName = courseCall(pilot.record.name);
  const [previewHole, setPreviewHole] = useState<number | null>(null);
  const viewHoleRef = useRef(1);
  const [flyPaused, setFlyPaused] = useState(false);
  const viewHole = previewHole ?? (started ? currentHole : 1);
  viewHoleRef.current = viewHole;
  const viewCard = pilot.record.scorecard.find((item) => item.holeNumber === viewHole);
  const overlay = holeOverlay(pilot.features, pilot.record.scorecard, viewHole);
  const pillLine = coursePill({ course: courseName, hole: viewHole, par: viewCard?.par ?? null });
  const firstHole = `${viewHole}${viewCard?.par != null ? ` · PAR ${viewCard.par}` : ''}`;
  const [mapH, setMapH] = useState(844);
  const [sky, setSky] = useState<WeatherRead | null>(null);
  const [level, setLevel] = useState<HomeSheetStop>('peek');
  const [creditOn, setCreditOn] = useState(false);
  const [askOn, setAskOn] = useState(false);
  const [askDraft, setAskDraft] = useState('');
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askSample, setAskSample] = useState(false);
  const levelRef = useRef<HomeSheetStop>('peek');
  const dragged = useRef(false);
  const heightRef = useRef(sheets.peek);
  const dragStart = useRef(sheets.peek);
  const sheetScrollRef = useRef<ScrollViewInstance>(null);
  const sheetH = useSharedValue(sheets.peek);
  const bearing = shotBearing(overlay.line);
  const weather = skyLine(
    sky?.current
      ? { temperatureF: sky.current.temperatureF, windMph: sky.current.windMph, headwindMph: sky.headwindMph }
      : null,
  );
  const plate = aerialPlate(pilot.courseKey, viewHole);
  const sheetOpen = level !== 'peek';
  const measured = bag.clubs.flatMap((club) => (club.estimatedCarry != null && club.estimatedCarry > 0 ? [club.estimatedCarry] : []));
  const starterCarries = starterBag({ handicap: null, driverSpeed: null }).flatMap((club) => (club.estimatedCarry != null ? [club.estimatedCarry] : []));
  const flight = suggestedPath(overlay.line, viewCard?.par ?? 4, measured.length > 0 ? measured : starterCarries);
  const flyState = flight == null || reduceMotion ? 'still' : flyPaused ? 'paused' : 'playing';

  useEffect(() => {
    if (!onboarded) router.replace('/onboard');
  }, [onboarded]);

  useEffect(() => {
    const pull = () => setArchive(readArchive());
    pull();
    return subscribeDevice(pull);
  }, []);

  useEffect(() => {
    const hole = holeOverlay(pilot.features, pilot.record.scorecard, viewHole);
    const at = hole.line[0];
    if (!at) return;
    let cancel = false;
    const ring = hole.green?.rings[0];
    const greenCenter = ring ? ringCentroid(ring) : null;
    void readWeather({ at, holeLine: hole.line, player: at, greenCenter }).then((read) => {
      if (!cancel) setSky(read);
    });
    return () => {
      cancel = true;
    };
  }, [viewHole]);

  const applyLevel = (stop: HomeSheetStop) => {
    levelRef.current = stop;
    setLevel(stop);
    const next = sheetsRef.current;
    const height = next[stop];
    heightRef.current = height;
    sheetH.value = reduceMotion ? height : withSpring(height, SHEET_SPRING);
  };
  const applyRef = useRef(applyLevel);
  applyRef.current = applyLevel;

  const cycleSheet = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const order: HomeSheetStop[] = ['peek', 'half', 'full'];
    const index = order.indexOf(levelRef.current);
    applyRef.current(order[(index + 1) % order.length] ?? 'peek');
  };

  useEffect(() => {
    const next = sheetsRef.current;
    const height = next[levelRef.current];
    heightRef.current = height;
    sheetH.value = height;
  }, [sheets.peek, sheets.half, sheets.full, sheetH]);

  const flyStart = useRef<{ x: number; y: number } | null>(null);
  const nudgeHole = (dx: number) => {
    if (dx <= -120) setPreviewHole((hole) => Math.min(18, (hole ?? viewHoleRef.current) + 1));
    else if (dx >= 120) setPreviewHole((hole) => Math.max(1, (hole ?? viewHoleRef.current) - 1));
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const down = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[role="button"], input, textarea, a')) return;
      setFlyPaused(true);
      flyStart.current = { x: event.clientX, y: event.clientY };
    };
    const up = (event: MouseEvent) => {
      const start = flyStart.current;
      flyStart.current = null;
      setFlyPaused(false);
      if (start == null) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < 120 || Math.abs(dx) < Math.abs(dy)) return;
      nudgeHole(dx);
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('mouseup', up);
    };
  }, []);

  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        dragged.current = false;
        dragStart.current = heightRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dy) > 12) dragged.current = true;
        const next = sheetsRef.current;
        const height = Math.min(next.full, Math.max(next.peek, dragStart.current - gesture.dy));
        heightRef.current = height;
        sheetH.value = height;
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) < 12) return;
        const next = sheetsRef.current;
        const projected = heightRef.current - gesture.vy * 90;
        applyRef.current(snapHomeSheet(projected, next, 0));
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value, maxHeight: sheetH.value }));

  const sendAsk = () => {
    const text = askDraft.trim();
    if (!text) return;
    setAskDraft('');
    const holeNo = viewHole;
    const par = viewCard?.par ?? null;
    const context = buildTalkContext({
      hole: holeNo,
      par,
      atTee: !started,
      gpsYards: null,
      headwindMph: sky?.headwindMph ?? null,
      elevationFeet: sky?.elevationFeet ?? null,
      temperatureF: sky?.current?.temperatureF ?? null,
      windMph: sky?.current?.windMph ?? null,
      profiles: [],
      cardLine: par == null ? `Hole ${holeNo}` : `Hole ${holeNo}, par ${par}`,
    });
    void requestTalk(text, context).then((reply) => {
      setAskReply(reply.line);
      setAskSample(reply.mode === 'sample');
    });
  };

  useEffect(() => {
    if (!sheetOpen || Platform.OS !== 'web') return;
    const scroll = sheetScrollElement(sheetScrollRef.current);
    if (!scroll) return;
    foldSnap(foldBlocks(scroll), scroll.clientHeight);
  }, [sheetOpen]);

  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <View style={styles.screen} onLayout={(event) => setMapH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <HoleMap
          bleed
          height={mapH}
          orient={bearing != null && overlay.line[0] ? { bearing, origin: overlay.line[0] } : null}
          labels={[]}
          line={overlay.line}
          fairways={ringsOf(overlay.fairways)}
          green={overlay.green ? ringsOf([overlay.green]) : []}
          bunkers={ringsOf(overlay.bunkers)}
          hazards={ringsOf(overlay.hazards)}
          ellipse={null}
          dispersionLine={[]}
          measure={[]}
          onTap={() => undefined}
          rawLabel=""
          playsLabel=""
          aerial
          imagery={VECTOR_TILE_SOURCE}
          plate={plate}
          flight={flight ?? undefined}
          flightLoop={!reduceMotion}
          flightPaused={flyPaused}
          reduceMotion={reduceMotion}
          showCredit={false}
          creditLeft={14}
          creditRight={88}
          creditBottom={sheets.peek + bottomInset + 20}
        />
      </View>
      <View
        testID="flyover-layer"
        {...({ dataSet: { flyover: flyState } } as object)}
        style={styles.flyover}
      />
      {flight ? (
        <View testID="suggested-line" pointerEvents="none" style={[styles.suggested, { top: insets.top + 60 }]}>
          <Text style={styles.suggestedText}>Suggested line · estimated</Text>
        </View>
      ) : null}
      <View accessibilityRole="header" accessibilityLabel={pillLine} testID="course-pill" style={[styles.pillHit, { top: insets.top + 8 }]}>
        <Glass radius={19} style={styles.pill} contentStyle={styles.pillFill}>
          <View style={styles.crestClip}>
            <Crest size={26} />
          </View>
          <Text style={styles.pillText} numberOfLines={1}>
            {pillLine}
          </Text>
        </Glass>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map credit"
        testID="map-credit"
        onPress={() => setCreditOn((open) => !open)}
        style={[styles.creditHit, { top: insets.top + 8 }]}
      >
        <Text style={styles.creditMark}>©</Text>
      </Pressable>
      {creditOn ? (
        <View testID="map-credit-panel" style={[styles.creditPanel, { top: insets.top + 60 }]}>
          <Text style={styles.creditBody}>{AERIAL_CREDIT}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close map credit" onPress={() => setCreditOn(false)} style={styles.rowHit}>
            <Text style={styles.rowTitle}>Close</Text>
          </Pressable>
        </View>
      ) : null}
      <Animated.View
        testID="home-sheet"
        style={[styles.sheet, sheetStyle, { bottom: bottomInset, zIndex: sheetOpen ? 8 : 4 }]}
      >
        <Glass radius={28} style={styles.sheetGlass} contentStyle={styles.sheetFill}>
          <View testID="home-sheet-level" {...({ dataSet: { level } } as object)} />
          <SheetBall reduceMotion={reduceMotion} />
          <View {...sheetPan.panHandlers} style={styles.grab}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={level === 'full' ? 'Show less' : 'Show more'}
              testID="home-sheet-handle"
              onPress={cycleSheet}
              style={styles.handleHit}
            >
              <View style={styles.handle} />
            </Pressable>
          </View>
          <View style={styles.peek}>
            <Text style={styles.kicker}>{TEE_IT_UP}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sticker}
              testID="start-round"
              onPress={() => router.push('/play')}
              style={({ pressed }) => [styles.start, pressed && !reduceMotion && styles.pressed]}
            >
              <Text style={[styles.startText, { fontFamily: display }]}>{sticker}</Text>
            </Pressable>
          </View>
          {sheetOpen ? (
            <View testID="home-actions" style={[styles.actions, (windowWidth > windowHeight || windowWidth >= 640) && styles.actionsRow]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Games" onPress={() => router.push('/games')} style={[styles.action, (windowWidth > windowHeight || windowWidth >= 640) && styles.actionRow]}>
                <Text style={styles.rowTitle}>Games</Text>
                <Text style={styles.rowNote}>Foursome games</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Bag, ${inPlay} clubs in play`} onPress={() => router.push('/bag')} style={[styles.action, (windowWidth > windowHeight || windowWidth >= 640) && styles.actionRow]}>
                <Text style={styles.rowTitle}>Bag</Text>
                <Text style={styles.rowNote}>{bagGlance(inPlay)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ask caddie"
                onPress={() => setAskOn(true)}
                style={[styles.action, (windowWidth > windowHeight || windowWidth >= 640) && styles.actionRow]}
              >
                <Text style={styles.rowTitle}>Ask caddie</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Past rounds" onPress={() => router.push('/rounds')} style={[styles.action, (windowWidth > windowHeight || windowWidth >= 640) && styles.actionRow]}>
                <Text style={styles.rowTitle}>Past rounds</Text>
              </Pressable>
            </View>
          ) : null}
          {sheetOpen ? (
            <ScrollView
              ref={sheetScrollRef}
              testID="home-sheet-scroll"
              style={[styles.scroll, { marginBottom: SHEET_BALL_TEXT.openPx }]}
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.caddie}>{hero}</Text>
              <Text style={styles.conditions} accessibilityLabel={weather ? `Conditions, ${weather}` : 'Waiting on the sky'}>
                {weather ?? 'Waiting on the sky'}
              </Text>
              {askOn ? (
                <View style={styles.askBox}>
                  <TextInput
                    value={askDraft}
                    onChangeText={setAskDraft}
                    placeholder="Ask your caddie…"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    style={styles.askInput}
                    accessibilityLabel="Typed ask"
                    onSubmitEditing={sendAsk}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="Send question" onPress={sendAsk} style={styles.rowHit}>
                    <Text style={styles.send}>Send</Text>
                  </Pressable>
                  {askReply ? (
                    <ScrollView style={styles.askAnswer} testID="home-ask-answer">
                      {askSample ? <Text style={styles.caddie}>{SAMPLE_ANSWER_LABEL}</Text> : null}
                      <Text style={styles.caddie}>{askReply}</Text>
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}
              <Text testID="recent-rounds" style={styles.section}>RECENT ROUNDS</Text>
              <View style={styles.empty}>
                {summary.last ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Rounds" onPress={() => router.push('/rounds')}>
                    <Text style={styles.emptyText}>{`${summary.last.courseName} · ${summary.last.playedOn}`}</Text>
                    <Text style={styles.emptyText}>{summary.last.gross == null ? 'Gross not finished' : `Gross ${summary.last.gross}`}</Text>
                    <Text style={styles.emptyText}>{`${summary.rows.length} on this phone`}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.emptyText}>No rounds yet. Your first one lands here.</Text>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Analysis" onPress={() => router.push('/analysis')} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>Analysis</Text>
                  <Text style={styles.rowNote}>Where the strokes went. A number shows up only after the card has enough holes.</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => router.push('/more')} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>More</Text>
                  <Text style={styles.rowNote}>Setup, privacy, and the card</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <View style={styles.teeCard}>
                <TeeRow label="COURSE" value={courseName.toUpperCase()} />
                <TeeRow label="TEES" value="WHITE" />
                <TeeRow label={started ? 'NEXT HOLE' : 'FIRST HOLE'} value={firstHole} />
                <TeeRow label="BAG" value={bagGlance(inPlay).toUpperCase()} />
                <TeeRow label="WIND" value={windCell(sky)} />
                <TeeRow label="TEMP" value={tempCell(sky)} />
              </View>
              <View testID="gross-tile" style={styles.tiles}>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>GROSS</Text>
                  <Text style={[styles.tileValue, { fontFamily: display }]}>{grossShown}</Text>
                  {progress.filled < 3 ? <Text style={styles.tileNote}>{progress.gross}</Text> : null}
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>LAST 3 TO PAR</Text>
                  <Text style={[styles.tileValue, summary.trend ? styles.tileTrend : null, { fontFamily: display }]}>{summary.trend ?? '—'}</Text>
                  <Text style={styles.tileNote}>{summary.handicap}</Text>
                  {summary.disclaimer ? <Text style={styles.tileDisclaimer}>{summary.disclaimer}</Text> : null}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </Glass>
      </Animated.View>
    </View>
  );
}

function TeeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.teeRow}>
      <Text style={styles.teeLabel}>{label}</Text>
      <Text style={styles.teeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: fieldNavy },
  flyover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 1, pointerEvents: 'none' },
  suggested: { position: 'absolute', left: 16, zIndex: 6, backgroundColor: '#02060E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  suggestedText: { color: '#FFFFFF', fontFamily: font.family, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  pillHit: { position: 'absolute', left: 12, right: 64, zIndex: 6, minHeight: 44, justifyContent: 'center' },
  pill: { minHeight: 44 },
  pillFill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  crestClip: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pillText: { flex: 1, color: '#FFFFFF', fontFamily: font.family, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  creditHit: {
    position: 'absolute',
    right: 8,
    zIndex: 7,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#02060E',
  },
  creditMark: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  creditPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: '#02060E',
  },
  creditBody: { color: '#FFFFFF', fontFamily: font.family, fontSize: 14, lineHeight: 20 },
  sheet: { position: 'absolute', left: 12, right: 12 },
  sheetGlass: { flex: 1, minHeight: 0 },
  sheetFill: { flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' },
  grab: { zIndex: 4 },
  handleHit: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  peek: { height: 92, paddingHorizontal: 16, gap: 4, zIndex: 1, flexShrink: 0, width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  kicker: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 16, fontWeight: '800', letterSpacing: 1 },
  start: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  startText: { color: colors.white, fontSize: 28, lineHeight: 32, letterSpacing: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingHorizontal: 12, paddingBottom: 8, zIndex: 2, flexShrink: 0, width: '100%' },
  action: { flexGrow: 1, flexBasis: '46%', minWidth: 140, minHeight: 56, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  actionsRow: { flexWrap: 'nowrap' },
  actionRow: { flexBasis: '22%', minWidth: 72 },
  pressed: { opacity: 0.9 },
  scroll: { flex: 1, minHeight: 0, zIndex: 1 },
  scrollBody: { paddingHorizontal: 14, paddingTop: SHEET_BALL_SCROLL_FADE, paddingBottom: 48, gap: 12 },
  caddie: { color: 'rgba(255,255,255,0.82)', fontFamily: font.family, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  conditions: { color: '#FFFFFF', fontFamily: font.family, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  row: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowHit: { minHeight: 44, justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 17, fontWeight: '800' },
  rowNote: { color: 'rgba(255,255,255,0.82)', fontFamily: font.family, fontSize: 13, lineHeight: 18 },
  chevron: { color: '#8AC926', fontSize: 22, fontWeight: '700' },
  askBox: { gap: 8 },
  askAnswer: { maxHeight: 120 },
  askInput: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  send: { color: '#8AC926', fontFamily: font.family, fontSize: 16, fontWeight: '700' },
  teeCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  teeRow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  teeLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  teeValue: { flex: 1, color: '#FFFFFF', fontFamily: font.family, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minHeight: 108,
    borderRadius: 16,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  tileLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  tileValue: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '700' },
  tileNote: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  tileTrend: { fontSize: 22, lineHeight: 26 },
  tileDisclaimer: { color: '#FFFFFF', fontFamily: font.family, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  section: { color: '#FFFFFF', fontFamily: font.family, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  empty: { minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 14, justifyContent: 'center' },
  emptyText: { color: '#FFFFFF', fontFamily: font.family, fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
