import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LatLon, MapFeature } from '@coopr/domain';
import { holeOverlay } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font, radius, space, TAGLINE, type } from '@coopr/tokens';
import { bagGlance, resumeLine } from '../src/design/home-copy';
import { Glass } from '../src/design/glass';
import { HoleMap } from '../src/hole-map';
import { useLocalStore } from '../src/local-store';
import { Crest } from '../src/ui';

const pilot = loadHighCedarsPilot();

function ringsOf(features: readonly MapFeature[]): LatLon[][] {
  return features.flatMap((feature) => feature.rings.filter((ring) => ring.length >= 3).map((ring) => [...ring]));
}

export default function HomeScreen() {
  const { currentHole, score, clubs } = useLocalStore();
  const inPlay = clubs.filter((club) => club.slot === 'in_play').length;
  const resume = resumeLine({
    hole: currentHole,
    holesEntered: score.holesEntered,
    gross: score.holesEntered > 0 ? score.gross : null,
  });
  const [washH, setWashH] = useState(844);
  const overlay = holeOverlay(pilot.features, pilot.record.scorecard, 1);

  return (
    <View style={styles.screen} onLayout={(event) => setWashH(Math.max(1, Math.round(event.nativeEvent.layout.height)))}>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <HoleMap
          bleed
          height={washH}
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
        />
        <BlurView pointerEvents="none" intensity={46} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.scrim} />
      </View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.crestPlate}>
            <Crest size={96} />
          </View>
          <Text style={styles.word}>COOPR</Text>
          <View style={styles.rule} />
          <Text style={styles.tag}>{TAGLINE}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Play High Cedars" onPress={() => router.push('/play')}>
            <Glass radius={radius.sheet} style={styles.play} contentStyle={styles.playFill}>
              <View style={styles.tick} />
              <Text style={styles.kicker}>High Cedars</Text>
              <Text style={styles.playTitle}>{resume.title}</Text>
              <Text style={styles.playDetail}>{resume.detail}</Text>
            </Glass>
          </Pressable>
          <View style={styles.glance}>
            <Stat label="In the bag" value={bagGlance(inPlay)} />
            <Stat label="Gross" value={score.holesEntered > 0 ? String(score.gross) : '—'} />
            <Stat label="Handicap" value="—" note="Unknown" />
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/more')} style={styles.more}>
            <Text style={styles.moreText}>More</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Glass radius={radius.card} style={styles.stat} contentStyle={styles.statFill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C2418' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,31,58,0.5)' },
  safe: { flex: 1 },
  content: { paddingHorizontal: space[3], paddingBottom: space[4], gap: space[2] },
  crestPlate: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.sheet,
    padding: 8,
    marginTop: space[1],
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
  play: { minHeight: 148 },
  playFill: { minHeight: 148, padding: space[3], paddingLeft: space[3] + 8, gap: 6, justifyContent: 'center' },
  tick: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.red },
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
  glance: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] + 4, marginTop: space[1] },
  stat: { flexGrow: 1, flexBasis: '46%', minWidth: 150, minHeight: 104 },
  statFill: { minHeight: 104, paddingHorizontal: space[2], paddingVertical: space[2], justifyContent: 'center', gap: 2 },
  statLabel: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: '600' },
  statValue: { color: colors.white, fontFamily: font.family, fontSize: type.club, lineHeight: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statNote: { color: colors.white, fontFamily: font.family, fontSize: type.body, lineHeight: 22 },
  more: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: colors.white, fontFamily: font.family, fontSize: type.body, fontWeight: '700' },
});
