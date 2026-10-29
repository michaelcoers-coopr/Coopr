import { useEffect, useId, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { buildTalkContext, holeOverlay, ringCentroid, roundProgress, shotBearing } from '@coopr/engine';
import { requestTalk, SAMPLE_ANSWER_LABEL } from '../src/talk-client';
import { readArchive } from '../src/analysis/archive';
import { homeRoundSummary } from '../src/analysis/home-rounds';
import type { StoredRound } from '../src/analysis/from-round';
import { subscribeDevice } from '../src/device-store';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font, signal, type } from '@coopr/tokens';
import { useReduceMotion } from '../src/design/reduce-motion';
import { useDisplayFace } from '../src/design/display-font';
import { bagGlance, courseCall, coursePill, hypeHero, resumeLine, skyLine } from '../src/design/home-copy';
import { homeWordmark } from '../src/design/round-chrome';
import { foldSnap } from '../src/design/play-polish';
import { fieldNavy } from '../src/design/theme';
import { Glass } from '../src/design/glass';
import { Pips } from '../src/design/signature-ui';
import { SheetBall } from '../src/design/sheet-ball';
import { SHEET_BALL_SCROLL_FADE, SHEET_BALL_TEXT } from '../src/design/sheet-ball-geometry';
import { HoleMap } from '../src/hole-map';
import { aerialPlate } from '../src/aerial/registry';
import { VECTOR_TILE_SOURCE } from '../src/tile-source';
import { useLocalStore } from '../src/local-store';
import { readWeather, type WeatherRead } from '../src/weather';
import { Crest } from '../src/ui';

const pilot = loadHighCedarsPilot();
const holeOne = holeOverlay(pilot.features, pilot.record.scorecard, 1);
const holeOneCard = pilot.record.scorecard.find((item) => item.holeNumber === 1);
const HOME_CLOSED = 268;
const HOME_OPEN = 540;
const RAIL = 56;
const SHEET_SPRING = { damping: 18, stiffness: 190, mass: 0.75 };
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
  const { currentHole, score, clubs, displayName, onboarded, founderTools } = useLocalStore();
  const display = useDisplayFace();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const word = homeWordmark({ screenWidth: windowWidth, safeTop: insets.top, safeLeft: insets.left });
  const reduceMotion = useReduceMotion();
  const scrimId = useId().replace(/:/g, '');
  const hero = hypeHero({ name: displayName.trim(), course: pilot.record.name });
  const [archive, setArchive] = useState<StoredRound[]>([]);
  const summary = homeRoundSummary(archive);
  const progress = roundProgress(summary.kept);
  const handicapLine = summary.disclaimer ? `${summary.handicap} ${summary.disclaimer}` : summary.handicap;
  const grossShown = summary.kept >= 3 && summary.lastKept?.gross != null ? String(summary.lastKept.gross) : '—';
  const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
  const cardHole = pilot.record.scorecard.find((item) => item.holeNumber === currentHole);
  const resume = resumeLine({
    hole: currentHole,
    holesEntered: score.holesEntered,
    gross: score.holesEntered > 0 ? score.gross : null,
    par: cardHole?.par ?? null,
  });
  const started = score.holesEntered > 0;
  const sticker = started ? 'RESUME ROUND' : 'START ROUND';
  const courseName = courseCall(pilot.record.name);
  const pillLine = coursePill({ course: courseName, hole: 1, par: holeOneCard?.par ?? null });
  const firstHole = started
    ? `${currentHole}${cardHole?.par != null ? ` · PAR ${cardHole.par}` : ''}`
    : `1${holeOneCard?.par != null ? ` · PAR ${holeOneCard.par}` : ''}`;
  const [mapH, setMapH] = useState(844);
  const [sky, setSky] = useState<WeatherRead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<'round' | 'games' | 'more'>('round');
  const [askOn, setAskOn] = useState(false);
  const [askDraft, setAskDraft] = useState('');
  const [askReply, setAskReply] = useState<string | null>(null);
  const [askSample, setAskSample] = useState(false);
  const sheetOpenRef = useRef(false);
  const sheetScrollRef = useRef<ScrollViewInstance>(null);
  const sheetH = useSharedValue(HOME_CLOSED);
  const breathe = useSharedValue(1);
  const bearing = shotBearing(holeOne.line);
  const weather = skyLine(
    sky?.current
      ? { temperatureF: sky.current.temperatureF, windMph: sky.current.windMph, headwindMph: sky.headwindMph }
      : null,
  );
  const plate = aerialPlate(pilot.courseKey, 1);

  useEffect(() => {
    if (!onboarded) router.replace('/onboard');
  }, [onboarded]);

  useEffect(() => {
    const pull = () => setArchive(readArchive());
    pull();
    return subscribeDevice(pull);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(withTiming(1.06, { duration: 1600 }), -1, true);
  }, [breathe, reduceMotion]);

  useEffect(() => {
    const at = holeOne.line[0];
    if (!at) return;
    let cancel = false;
    const ring = holeOne.green?.rings[0];
    const greenCenter = ring ? ringCentroid(ring) : null;
    void readWeather({ at, holeLine: holeOne.line, player: at, greenCenter }).then((read) => {
      if (!cancel) setSky(read);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const applySheet = (open: boolean) => {
    sheetOpenRef.current = open;
    setSheetOpen(open);
    sheetH.value = withSpring(open ? HOME_OPEN : HOME_CLOSED, SHEET_SPRING);
  };

  const openGames = () => {
    router.push('/games');
  };

  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) < 16) {
          applySheet(!sheetOpenRef.current);
          return;
        }
        applySheet(gesture.dy < 0);
      },
    }),
  ).current;

  const sheetStyle = useAnimatedStyle(() => ({ height: sheetH.value }));
  const askPulse = useAnimatedStyle(() => ({ transform: [{ scale: breathe.value }] }));

  const sendAsk = () => {
    const text = askDraft.trim();
    if (!text) return;
    setAskDraft('');
    const holeNo = started ? currentHole : 1;
    const par = (started ? cardHole?.par : holeOneCard?.par) ?? null;
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
    let stopped = false;
    let placed = 0;
    const snap = () => {
      if (stopped) return;
      const scroll = sheetScrollElement(sheetScrollRef.current);
      if (!scroll || scroll.clientHeight < 80) return;
      if (Math.abs(scroll.scrollTop - placed) > 2) return;
      scroll.scrollTop = 0;
      const blocks = foldBlocks(scroll);
      const next = blocks.length === 0 ? 0 : foldSnap(blocks, scroll.clientHeight);
      const top = next > 0 ? Math.min(Math.max(0, scroll.scrollHeight - scroll.clientHeight), next) : 0;
      scroll.scrollTop = top;
      placed = top;
    };
    snap();
    const timers = [160, 420, 800].map((ms) => setTimeout(snap, ms));
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(snap);
    const scroll = sheetScrollElement(sheetScrollRef.current);
    if (observer && scroll) {
      observer.observe(scroll);
      if (scroll.parentElement) observer.observe(scroll.parentElement);
    }
    return () => {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
      observer?.disconnect();
    };
  }, [sheetOpen, sheetTab, askOn, askReply, askDraft, started, firstHole]);

  const bottomInset = Math.max(insets.bottom, 8);
  const railBottom = HOME_CLOSED + bottomInset + 16;

  return (
    <View style={styles.screen} onLayout={(event) => setMapH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <HoleMap
          bleed
          height={mapH}
          orient={bearing != null && holeOne.line[0] ? { bearing, origin: holeOne.line[0] } : null}
          labels={[]}
          line={holeOne.line}
          fairways={ringsOf(holeOne.fairways)}
          green={holeOne.green ? ringsOf([holeOne.green]) : []}
          bunkers={ringsOf(holeOne.bunkers)}
          hazards={ringsOf(holeOne.hazards)}
          ellipse={null}
          dispersionLine={[]}
          measure={[]}
          onTap={() => undefined}
          rawLabel=""
          playsLabel=""
          aerial
          imagery={VECTOR_TILE_SOURCE}
          plate={plate}
          showCredit={!sheetOpen}
          creditLeft={14}
          creditRight={88}
          creditBottom={HOME_CLOSED + bottomInset + 20}
        />
      </View>
      <View pointerEvents="none" style={[styles.scrim, { top: insets.top }]}>
        <Svg width={360} height={420}>
          <Defs>
            <RadialGradient id={scrimId} cx="18%" cy="34%" rx="78%" ry="70%">
              <Stop offset="0" stopColor="#02060E" stopOpacity="0.94" />
              <Stop offset="0.5" stopColor="#02060E" stopOpacity="0.82" />
              <Stop offset="0.78" stopColor="#02060E" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#02060E" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="360" height="420" fill={`url(#${scrimId})`} />
        </Svg>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pillLine}. Opens the round sheet.`}
        onPress={() => applySheet(true)}
        style={[styles.pillHit, { top: insets.top + 12 }]}
      >
        <Glass radius={19} style={styles.pill} contentStyle={styles.pillFill}>
          <View style={styles.crestClip}>
            <Crest size={26} />
          </View>
          <Text style={styles.pillText} numberOfLines={1}>
            {pillLine}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </Glass>
      </Pressable>
      <View pointerEvents="box-none" style={[styles.wordmark, { top: word.top, left: word.left, maxWidth: word.maxWidth }]}>
        <View style={styles.wordPlate}>
          <Text style={[styles.word, { fontFamily: display, fontSize: word.fontSize, lineHeight: word.lineHeight }]}>TEE</Text>
          <Text style={[styles.word, { fontFamily: display, fontSize: word.fontSize, lineHeight: word.lineHeight }]}>
            IT <Text style={styles.wordLime}>UP</Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sticker}. ${resume.detail}`}
          testID="start-round"
          onPress={() => router.push('/play')}
          style={({ pressed }) => [styles.sticker, pressed && !reduceMotion && styles.pressed]}
        >
          <Text style={[styles.stickerText, { fontFamily: display }]}>{sticker}</Text>
        </Pressable>
        {sheetOpen ? null : (
          <View style={styles.weather}>
            <WindMark />
            <Text style={styles.weatherText}>{weather ?? 'Waiting on the sky'}</Text>
          </View>
        )}
      </View>
      {sheetOpen ? null : (
        <View pointerEvents="box-none" style={[styles.rail, { bottom: railBottom }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Foursome games" onPress={openGames} style={styles.railBtn}>
            <Glass radius={28} style={styles.railBtn} contentStyle={styles.railFill}>
              <PeopleMark />
              <Text style={styles.railLabel}>GAMES</Text>
            </Glass>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Bag, ${inPlay} clubs in play`} onPress={() => router.push('/bag')} style={styles.railBtn}>
            <Glass radius={28} style={styles.railBtn} contentStyle={styles.railFill}>
              <BagMark />
              <Text style={styles.railLabel}>BAG</Text>
            </Glass>
            <View pointerEvents="none" style={styles.badge}>
              <Text style={[styles.badgeNum, { fontFamily: display }]}>{String(inPlay)}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ask COOPR"
            onPress={() => {
              setSheetTab('round');
              setAskOn(true);
              applySheet(true);
            }}
            style={styles.railBtn}
          >
            <Animated.View style={askPulse}>
              <Glass radius={28} borderColor="rgba(190,245,70,0.95)" style={styles.railBtn} contentStyle={styles.railFill}>
                <MicMark />
                <Text style={styles.railLabel}>ASK</Text>
              </Glass>
            </Animated.View>
          </Pressable>
        </View>
      )}
      <Animated.View style={[styles.sheet, sheetStyle, { bottom: bottomInset, zIndex: sheetOpen ? 8 : 2 }]}>
        <Glass radius={28} style={styles.sheetGlass} contentStyle={styles.sheetFill}>
          <SheetBall reduceMotion={reduceMotion} />
          <View style={styles.grab}>
            <View {...sheetPan.panHandlers} style={styles.handleHit}>
              <View style={styles.handle} />
            </View>
            <View style={styles.tabs}>
              <Pressable accessibilityRole="tab" accessibilityLabel="Round" accessibilityState={{ selected: sheetTab === 'round' }} onPress={() => setSheetTab('round')} style={styles.tabHit}>
                <Text style={[styles.tab, sheetTab === 'round' && styles.tabOn]}>Round</Text>
              </Pressable>
              <Pressable accessibilityRole="tab" accessibilityLabel="Games" onPress={openGames} style={styles.tabHit}>
                <Text style={styles.tab}>Games</Text>
              </Pressable>
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="More"
                onPress={() => router.push('/more')}
                style={styles.tabHit}
              >
                <Text style={styles.tab}>More</Text>
              </Pressable>
            </View>
          </View>
          {sheetOpen ? (
            <ScrollView
              ref={sheetScrollRef}
              testID="home-sheet-scroll"
              style={[styles.scroll, { marginBottom: SHEET_BALL_TEXT.openPx }]}
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.roundBody}>
                  <Text style={styles.caddieKicker}>✦  COOPR Caddie</Text>
                  <Text style={styles.hello}>{hero}</Text>
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
                      <Pressable accessibilityRole="button" accessibilityLabel="Send question" onPress={sendAsk} style={styles.sendHit}>
                        <Text style={styles.send}>Send</Text>
                      </Pressable>
                      {askReply ? (
                        <View>
                          {askSample ? <Text style={styles.hello}>{SAMPLE_ANSWER_LABEL}</Text> : null}
                          <Text style={styles.hello}>{askReply}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.teeCard}>
                    <TeeRow label="COURSE" value={courseName.toUpperCase()} />
                    <TeeRow label="TEES" value="WHITE" />
                    <TeeRow label={started ? 'NEXT HOLE' : 'FIRST HOLE'} value={firstHole} />
                    <TeeRow label="BAG" value={bagGlance(inPlay).toUpperCase()} />
                    <TeeRow label="WIND" value={windCell(sky)} />
                    <TeeRow label="TEMP" value={tempCell(sky)} />
                  </View>
                  <View style={styles.tiles}>
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
                  <Text style={styles.section}>RECENT ROUNDS</Text>
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
                  <Pressable accessibilityRole="button" accessibilityLabel="Analysis" onPress={() => router.push('/analysis')} style={styles.foursome}>
                    <View style={styles.foursomeCopy}>
                      <Text style={styles.foursomeTitle}>ANALYSIS</Text>
                      <Text style={styles.foursomeNote}>Where the strokes went. A number shows up only after the card has enough holes.</Text>
                    </View>
                    <Text style={styles.foursomeChevron}>›</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Foursome games" onPress={openGames} style={styles.foursome}>
                    <View style={styles.foursomeIcon}>
                      <PeopleMark />
                    </View>
                    <View style={styles.foursomeCopy}>
                      <Text style={styles.foursomeTitle}>FOURSOME GAMES</Text>
                      <Text style={styles.foursomeNote}>Add your group. Play for something.</Text>
                    </View>
                    <Text style={styles.foursomeChevron}>›</Text>
                  </Pressable>
              </View>
            </ScrollView>
          ) : (
            <View style={[styles.peek, { marginTop: SHEET_BALL_TEXT.closedPx }]}>
              <Text style={styles.caddieKicker}>✦  COOPR Caddie</Text>
              <Text style={styles.hello} numberOfLines={2}>
                {hero}
              </Text>
              <View style={styles.peekPips}>
                <Pips filled={progress.filled} total={progress.total} />
                <Text style={styles.peekNote} numberOfLines={2}>
                  {handicapLine}
                </Text>
              </View>
            </View>
          )}
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

function WindMark() {
  return (
    <View style={styles.wind}>
      <View style={styles.windLine} />
      <View style={styles.windLineShort} />
      <View style={styles.windLine} />
    </View>
  );
}

function PeopleMark() {
  return (
    <View style={styles.people}>
      <View style={styles.person} />
      <View style={[styles.person, styles.personRight]} />
    </View>
  );
}

function BagMark() {
  return <View style={styles.bag} />;
}

function MicMark() {
  return (
    <View style={styles.mic}>
      <View style={styles.micHead} />
      <View style={styles.micCradle} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: fieldNavy },
  scrim: { position: 'absolute', left: 0, width: 360, height: 420, zIndex: 3 },
  pillHit: { position: 'absolute', left: 12, right: 72, zIndex: 6, minHeight: 44, justifyContent: 'center' },
  pill: { minHeight: 44 },
  pillFill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  crestClip: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pillText: { flex: 1, color: '#FFFFFF', fontFamily: font.family, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  chevron: { color: 'rgba(255,255,255,0.85)', fontSize: 18, lineHeight: 20, fontWeight: '700', paddingRight: 4 },
  wordmark: { position: 'absolute', left: 16, zIndex: 4, maxWidth: 250 },
  wordPlate: { alignSelf: 'flex-start', backgroundColor: '#02060E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  word: { color: '#FFFFFF', fontSize: 52, lineHeight: 58, fontWeight: '700', letterSpacing: 0 },
  wordLime: { color: '#8AC926' },
  sticker: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 52,
    minWidth: 168,
    paddingHorizontal: 16,
    backgroundColor: colors.red,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  stickerText: { color: colors.white, fontSize: 28, lineHeight: 32, letterSpacing: 1 },
  pressed: { transform: [{ scale: 0.98 }, { rotate: '-2deg' }] },
  weather: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: signal.go,
    transform: [{ rotate: '-1.5deg' }],
  },
  weatherText: { color: colors.navy, fontFamily: font.family, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  wind: { width: 18, height: 14, justifyContent: 'space-between' },
  windLine: { height: 2, borderRadius: 1, backgroundColor: colors.navy },
  windLineShort: { height: 2, width: 12, borderRadius: 1, backgroundColor: colors.navy },
  rail: { position: 'absolute', right: 12, zIndex: 7, gap: 12, alignItems: 'center' },
  railBtn: { width: RAIL, height: RAIL },
  railFill: { width: RAIL, height: RAIL, alignItems: 'center', justifyContent: 'center' },
  railLabel: { color: '#FFFFFF', fontFamily: font.family, fontSize: 9, lineHeight: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNum: { color: '#06101C', fontSize: 13, lineHeight: 16, fontWeight: '700' },
  people: { width: 22, height: 16, flexDirection: 'row' },
  person: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF', marginTop: 4 },
  personRight: { marginLeft: -4 },
  bag: { width: 14, height: 16, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 3, borderTopWidth: 3 },
  mic: { width: 14, height: 16, alignItems: 'center' },
  micHead: { width: 6, height: 8, borderRadius: 3, backgroundColor: '#FFFFFF' },
  micCradle: { width: 10, height: 6, marginTop: -3, borderWidth: 2, borderTopWidth: 0, borderColor: '#FFFFFF', borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  sheet: { position: 'absolute', left: 12, right: 12 },
  sheetGlass: { flex: 1, minHeight: 0 },
  sheetFill: { flex: 1, minHeight: 0, overflow: 'hidden' },
  grab: { paddingTop: 6, paddingHorizontal: 12, zIndex: 4 },
  handleHit: { minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  tabs: { flexDirection: 'row', minHeight: 44, alignItems: 'center' },
  tabHit: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  tab: { color: 'rgba(255,255,255,0.55)', fontFamily: font.family, fontSize: 16, fontWeight: '700' },
  tabOn: { color: '#FFFFFF' },
  peek: { paddingHorizontal: 16, gap: 6, zIndex: 1 },
  caddieKicker: { color: '#8AC926', fontFamily: font.family, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  hello: { color: '#FFFFFF', fontFamily: font.family, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  peekPips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peekNote: { flex: 1, color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  scroll: { flex: 1, minHeight: 0, zIndex: 1 },
  scrollBody: { paddingHorizontal: 14, paddingTop: SHEET_BALL_SCROLL_FADE, paddingBottom: 48, gap: 12 },
  roundBody: { gap: 12 },
  askBox: { gap: 8 },
  askInput: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendHit: { minHeight: 44, justifyContent: 'center' },
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
  foursome: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#8AC926',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  foursomeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(138,201,38,0.16)' },
  foursomeCopy: { flex: 1 },
  foursomeTitle: { color: '#FFFFFF', fontFamily: font.family, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  foursomeNote: { color: '#FFFFFF', fontFamily: font.family, fontSize: 13, lineHeight: 18 },
  foursomeChevron: { color: '#8AC926', fontSize: 22, fontWeight: '700' },
  stub: { gap: 10, paddingTop: 8 },
  stubTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '700' },
  stubLine: { color: '#FFFFFF', fontFamily: font.family, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  stubInvite: { color: '#8AC926', fontFamily: font.family, fontSize: 17, lineHeight: 24, fontWeight: '700' },
});
