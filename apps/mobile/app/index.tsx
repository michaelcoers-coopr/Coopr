import { useEffect, useState, type ReactNode } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { holeOverlay, ringCentroid, shotBearing } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font, radius, space, TAGLINE, type } from '@coopr/tokens';
import { bagGlance, resumeLine, skyLine } from '../src/design/home-copy';
import { Glass } from '../src/design/glass';
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
  const { currentHole, score, clubs, unit } = useLocalStore();
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
  const drift = useSharedValue(0);
  const washStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.12 }, { translateX: (drift.value - 0.5) * 36 }, { translateY: (0.5 - drift.value) * 22 }],
  }));

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 16000 }), -1, true);
  }, [drift]);

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
            <Crest size={72} />
          </View>
          <Text style={styles.word}>COOPR</Text>
          <View style={styles.rule} />
          <Text style={styles.tag}>{TAGLINE}</Text>
          {weather ? (
            <Glass radius={24} style={styles.weather} contentStyle={styles.weatherFill}>
              <WindMark />
              <Text style={styles.weatherText}>{weather}</Text>
            </Glass>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Play High Cedars" onPress={() => router.push('/play')}>
            <Glass radius={radius.sheet} style={styles.play} contentStyle={styles.playFill}>
              <Text style={styles.kicker}>High Cedars</Text>
              <Text style={styles.playTitle}>{resume.title}</Text>
              <Text style={styles.playDetail}>{resume.detail}</Text>
              <View style={styles.playButton}>
                <Text style={styles.playButtonText}>Play</Text>
              </View>
            </Glass>
          </Pressable>
          <View style={styles.glance}>
            <Stat icon={<BagMark />} label="In the bag" value={bagGlance(inPlay)} />
            <Stat icon={<FlagMark />} label="Gross" value={score.holesEntered > 0 ? String(score.gross) : '—'} />
            <Stat icon={<DashMark />} label="Handicap" value="—" note="Unknown" />
          </View>
        </ScrollView>
        <Glass radius={28} style={styles.tab} contentStyle={styles.tabFill}>
          <View style={styles.tabItem} accessibilityRole="tab" accessibilityLabel="Round" accessibilityState={{ selected: true }}>
            <View style={styles.tabMark} />
            <Text style={styles.tabText}>Round</Text>
          </View>
          <Pressable accessibilityRole="tab" accessibilityLabel="More" onPress={() => router.push('/more')} style={styles.tabItem}>
            <Text style={styles.tabText}>More</Text>
          </Pressable>
        </Glass>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return (
    <Glass radius={radius.card} style={styles.stat} contentStyle={styles.statFill}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </Glass>
  );
}

function BagMark() {
  return (
    <View style={styles.icon}>
      <View style={styles.bagHandle} />
      <View style={styles.bagBody} />
    </View>
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
  screen: { flex: 1, backgroundColor: '#0E3320' },
  wash: { position: 'absolute', top: -60, right: -60, bottom: -60, left: -60 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(11,31,58,0.32)' },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space[3], paddingBottom: 28, gap: 12 },
  crestPlate: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.sheet,
    padding: 6,
  },
  word: {
    color: colors.white,
    fontFamily: font.family,
    fontSize: type.title,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  rule: { alignSelf: 'center', width: 36, height: 3, borderRadius: 2, backgroundColor: colors.red, marginTop: -8 },
  tag: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 24, textAlign: 'center' },
  weather: { alignSelf: 'center' },
  weatherFill: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  weatherText: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 24, fontWeight: '700' },
  play: { minHeight: 180 },
  playFill: { minHeight: 180, padding: space[2], gap: 6, justifyContent: 'center' },
  kicker: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: font.family,
    fontSize: type.body,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  playTitle: { color: colors.white, fontFamily: font.family, fontSize: type.title, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  playDetail: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 24 },
  playButton: {
    marginTop: 8,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
  glance: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: '46%', minWidth: 150, minHeight: 112 },
  statFill: { minHeight: 112, paddingHorizontal: space[2], paddingVertical: 12, justifyContent: 'center', gap: 2 },
  statLabel: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: '600' },
  statValue: { color: colors.white, fontFamily: font.family, fontSize: type.club, lineHeight: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNote: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 22 },
  icon: { width: 28, height: 28, marginBottom: 4 },
  bagHandle: {
    alignSelf: 'center',
    width: 10,
    height: 6,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.white,
  },
  bagBody: { alignSelf: 'center', width: 18, height: 16, borderRadius: 4, borderWidth: 2, borderColor: colors.white, marginTop: -1 },
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
  windLine: { height: 2, borderRadius: 1, backgroundColor: colors.white },
  windLineShort: { height: 2, width: 14, borderRadius: 1, backgroundColor: colors.white },
  tab: { marginHorizontal: space[3], marginBottom: space[1] },
  tabFill: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch' },
  tabItem: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabMark: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.red },
  tabText: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
});
