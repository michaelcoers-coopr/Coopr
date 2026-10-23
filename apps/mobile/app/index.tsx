import { useEffect, useState, type ReactNode } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { holeOverlay, ringCentroid, roundProgress, shotBearing } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font, radius, signal, space, type } from '@coopr/tokens';
import { useReduceMotion } from '../src/design/reduce-motion';
import { useDisplayFace } from '../src/design/display-font';
import { bagGlance, hypeHero, resumeLine, skyLine, TEE_IT_UP } from '../src/design/home-copy';
import { fieldNavy } from '../src/design/theme';
import { Glass } from '../src/design/glass';
import { Pips } from '../src/design/signature-ui';
import { HoleMap } from '../src/hole-map';
import { holeLabels } from '../src/map-labels';
import { useLocalStore } from '../src/local-store';
import { readWeather, type WeatherRead } from '../src/weather';
import { Crest } from '../src/ui';

const pilot = loadHighCedarsPilot();
const holeOne = holeOverlay(pilot.features, pilot.record.scorecard, 1);

function ringsOf(features: readonly MapFeature[]): LatLon[][] {
  return features.flatMap((feature) => feature.rings.filter((ring) => ring.length >= 3).map((ring) => [...ring]));
}

export default function HomeScreen() {
  const { currentHole, score, clubs, unit, holes, displayName } = useLocalStore();
  const display = useDisplayFace();
  const hero = hypeHero({ name: displayName, course: pilot.record.name });
  const roundsKept = holes.length >= 18 && holes.every((strokes) => strokes != null) ? 1 : 0;
  const progress = roundProgress(roundsKept);
  const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
  const resume = resumeLine({
    hole: currentHole,
    holesEntered: score.holesEntered,
    gross: score.holesEntered > 0 ? score.gross : null,
  });
  const [washH, setWashH] = useState(844);
  const [sky, setSky] = useState<WeatherRead | null>(null);
  const bearing = shotBearing(holeOne.line);
  const weather = skyLine(
    sky?.current
      ? { temperatureF: sky.current.temperatureF, windMph: sky.current.windMph, headwindMph: sky.headwindMph }
      : null,
  );
  const reduceMotion = useReduceMotion();
  const drift = useSharedValue(0.5);
  const washStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.08 }, { translateX: (drift.value - 0.5) * 28 }, { translateY: (0.5 - drift.value) * 16 }],
  }));

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0.5;
      return;
    }
    drift.value = withRepeat(withTiming(1, { duration: 16000 }), -1, true);
  }, [drift, reduceMotion]);

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

  return (
    <View style={styles.screen} onLayout={(event) => setWashH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents="none" style={[styles.wash, washStyle]}>
          <HoleMap
            bleed
            height={washH + 120}
            orient={bearing != null && holeOne.line[0] ? { bearing, origin: holeOne.line[0] } : null}
            labels={holeLabels(holeOne.line, unit, null)}
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
          />
        </Animated.View>
        <BlurView pointerEvents="none" intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.scrim} />
      </View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.crestPlate}>
            <Crest size={56} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${TEE_IT_UP}. ${hero}`}
            onPress={() => router.push('/play')}
            style={({ pressed }) => [pressed && !reduceMotion && styles.pressed]}
          >
            <Glass radius={radius.sheet} style={styles.play} contentStyle={styles.playFill}>
              <Text style={styles.kicker}>{resume.title}</Text>
              <Text style={[styles.playTitle, { fontFamily: display }]}>{hero}</Text>
              <Text style={styles.playDetail}>{resume.detail}</Text>
              <Text style={styles.playMeta}>{`${bagGlance(inPlay)} in the bag`}</Text>
              {weather ? (
                <View style={styles.weatherStamp}>
                  <WindMark />
                  <Text style={styles.weatherText}>{weather}</Text>
                </View>
              ) : null}
              <View style={styles.playButton}>
                <Text style={[styles.playButtonText, { fontFamily: display }]}>{TEE_IT_UP}</Text>
              </View>
            </Glass>
          </Pressable>
          <View style={styles.glance}>
            <Stat
              icon={<FlagMark />}
              label="Gross"
              value={score.holesEntered > 0 ? String(score.gross) : undefined}
              detail={score.holesEntered > 0 ? undefined : progress.gross}
              pips={progress}
            />
            <Stat icon={<DashMark />} label="Handicap" detail={progress.handicap} pips={progress} />
          </View>
        </ScrollView>
        <Glass radius={28} style={styles.tab} contentStyle={styles.tabFill}>
          <View style={styles.tabItem} accessibilityRole="tab" accessibilityLabel="Round" accessibilityState={{ selected: true }}>
            <View style={styles.tabMark} />
            <Text style={styles.tabText}>Round</Text>
          </View>
          <Pressable accessibilityRole="tab" accessibilityLabel="More" onPress={() => router.push('/more')} style={({ pressed }) => [styles.tabItem, pressed && !reduceMotion && styles.pressed]}>
            <Text style={styles.tabText}>More</Text>
          </Pressable>
        </Glass>
      </SafeAreaView>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  pips,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  detail?: string;
  pips?: { filled: number; total: number };
}) {
  const display = useDisplayFace();
  return (
    <Glass radius={radius.card} style={styles.stat} contentStyle={styles.statFill}>
      {icon}
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        {detail ? <Text style={styles.statNote}>{detail}</Text> : null}
        {pips ? <Pips filled={pips.filled} total={pips.total} /> : null}
      </View>
      {value ? <Text style={[styles.statValue, { fontFamily: display }]}>{value}</Text> : null}
    </Glass>
  );
}

function FlagMark() {
  return (
    <View style={styles.icon}>
      <View style={styles.flagPole} />
      <View style={styles.flagFly} />
    </View>
  );
}

function DashMark() {
  return (
    <View style={styles.icon}>
      <View style={styles.dashRing} />
      <View style={styles.dash} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: fieldNavy },
  wash: { position: 'absolute', top: -60, right: -60, bottom: -60, left: -60 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4,10,24,0.55)' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space[3], paddingTop: space[2], paddingBottom: space[4], gap: space[2] },
  pressed: { transform: [{ scale: 0.98 }] },
  crestPlate: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.sheet,
    padding: space[1],
  },
  weatherStamp: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: 36,
    marginTop: space[1],
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: signal.go,
    borderWidth: 2,
    borderColor: colors.navy,
    transform: [{ rotate: '-1.5deg' }],
  },
  weatherText: { color: colors.navy, fontFamily: font.family, fontSize: type.body, lineHeight: 22, fontWeight: font.bold, fontVariant: ['tabular-nums'], flexShrink: 1 },
  play: { minHeight: 220 },
  playFill: { minHeight: 220, padding: space[3], gap: space[1], justifyContent: 'center' },
  kicker: {
    color: '#FFFFFF',
    fontFamily: font.family,
    fontSize: type.caption,
    fontWeight: font.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  playTitle: { color: colors.white, fontFamily: font.family, fontSize: 42, lineHeight: 46, fontWeight: font.bold, letterSpacing: 0.4 },
  playDetail: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 24, fontWeight: font.medium },
  playMeta: { color: '#FFFFFF', fontFamily: font.family, fontSize: type.caption, lineHeight: 18, fontWeight: font.semibold, fontVariant: ['tabular-nums'] },
  playButton: {
    alignSelf: 'flex-start',
    marginTop: space[2],
    minHeight: 56,
    paddingHorizontal: 18,
    backgroundColor: colors.red,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  playButtonText: { color: colors.white, fontFamily: font.family, fontSize: 32, lineHeight: 36, letterSpacing: 1 },
  glance: { gap: space[2] },
  stat: { minHeight: 72 },
  statFill: { minHeight: 72, paddingHorizontal: space[2], paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  statCopy: { flex: 1, gap: space[1] },
  statLabel: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: font.bold },
  statValue: { color: colors.white, fontFamily: font.family, fontSize: type.title, lineHeight: 40, fontWeight: font.bold, fontVariant: ['tabular-nums'] },
  statNote: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 24, fontWeight: font.medium },
  icon: { width: 28, height: 28, marginBottom: 4 },
  flagPole: { position: 'absolute', left: 6, top: 2, width: 2, height: 22, backgroundColor: colors.white },
  flagFly: {
    position: 'absolute',
    left: 8,
    top: 2,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.red,
  },
  dashRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.white },
  dash: { position: 'absolute', left: 6, top: 10, width: 10, height: 2, backgroundColor: colors.white },
  wind: { width: 22, height: 18, justifyContent: 'space-between' },
  windLine: { height: 2, borderRadius: 1, backgroundColor: colors.navy },
  windLineShort: { height: 2, width: 14, borderRadius: 1, backgroundColor: colors.navy },
  tab: { marginHorizontal: space[3], marginBottom: space[1] },
  tabFill: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch' },
  tabItem: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabMark: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.red },
  tabText: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: font.bold },
});
