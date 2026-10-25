import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyze } from '@coopr/analysis';
import { signal } from '@coopr/tokens';
import { loadHighCedarsPilot } from '@coopr/course';
import { useDisplayFace } from '../src/design/display-font';
import { useLocalStore } from '../src/local-store';
import { readArchive, readLastFix } from '../src/analysis/archive';
import { openRound, storedShots, toEngine, type StoredRound } from '../src/analysis/from-round';
import { NEEDS_MORE_LINE, presentAnalysis, shareText, showsNeedsMore, type AnalysisPanel } from '../src/analysis/present';
import { sampleBundle } from '../src/analysis/sample-season';

const pilot = loadHighCedarsPilot();
const NAVY = '#0B1F3A';
const LIME = signal.go;

function cardOf() {
  return pilot.record.scorecard.map((hole) => ({
    holeNumber: hole.holeNumber,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
    yards: hole.yardagesByTee.white ?? null,
  }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AnalysisScreen() {
  const display = useDisplayFace();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { founderTools, holes, putts, penalties, shots } = useLocalStore();
  const [page, setPage] = useState(0);
  const [sampleOn, setSampleOn] = useState(false);
  const sample = founderTools ? sampleBundle() : null;

  const panels = useMemo(() => {
    if (sampleOn && sample) {
      return presentAnalysis(analyze({ rounds: sample.rounds, shots: sample.shots }));
    }
    const open = openRound({
      holes,
      putts,
      penalties,
      playedOn: today(),
      courseName: pilot.record.name,
      card: cardOf(),
    });
    const finished = readArchive().filter((round) => round.id !== 'open');
    const rounds: StoredRound[] = open ? [...finished, open] : finished;
    const engine = toEngine(rounds, storedShots(shots));
    return presentAnalysis(analyze({ rounds: engine.rounds, shots: engine.shots, lastFix: readLastFix() }));
  }, [holes, penalties, putts, sample, sampleOn, shots]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: NAVY } }} />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.backHit}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        {sample ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sampleOn ? 'Showing the sample season' : 'Show the sample season'}
            onPress={() => setSampleOn((on) => !on)}
            style={styles.sampleToggle}
          >
            <Text style={styles.sampleToggleText}>{sampleOn ? 'Sample on' : 'Sample'}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1)))}
      >
        {panels.map((panel) => (
          <ScrollView key={panel.id} style={{ width }} contentContainerStyle={styles.page}>
            <Panel panel={panel} display={display} />
          </ScrollView>
        ))}
      </ScrollView>
      <View style={[styles.dots, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {panels.map((panel, index) => (
          <View key={panel.id} style={[styles.dot, index === page && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function Panel({ panel, display }: { panel: AnalysisPanel; display: string }) {
  const needsMore = showsNeedsMore(panel);
  const facts = shareText(panel);
  return (
    <View>
      <Text style={styles.eyebrow}>{panel.eyebrow}</Text>
      <View style={styles.chips}>
        {panel.sample ? <Text style={styles.sample}>SAMPLE</Text> : null}
        {panel.confidence && !needsMore ? <Text style={styles.confidence}>{panel.confidence}</Text> : null}
      </View>
      <Text style={[styles.title, { fontFamily: display }]}>{panel.title}</Text>
      {needsMore ? (
        <Text style={styles.invite}>{panel.invitation ?? NEEDS_MORE_LINE}</Text>
      ) : panel.figure != null ? (
        <View style={panel.id === 'share' ? styles.shareCard : undefined}>
          <Text style={[styles.figure, { fontFamily: display, color: panel.id === 'one_fix' || panel.id === 'share' ? LIME : '#FFFFFF' }]}>{panel.figure}</Text>
          {panel.unit ? <Text style={styles.unit}>{panel.unit}</Text> : null}
          {panel.headline ? <Text style={[styles.headline, { fontFamily: display }]}>{panel.headline}</Text> : null}
        </View>
      ) : null}
      {panel.caveat ? <Text style={styles.body}>{panel.caveat}</Text> : null}
      {panel.take ? <Text style={styles.body}>{panel.take}</Text> : null}
      {panel.action ? <Text style={styles.action}>{panel.action}</Text> : null}
      {panel.rows.map((row) => (
        <View key={`${row.label}-${row.detail}`} style={styles.row}>
          <Text style={styles.rowLabel} numberOfLines={1}>{row.label}</Text>
          <Text style={[styles.rowDetail, { fontFamily: display, color: row.tone === 'loss' ? '#C8102E' : row.tone === 'gain' ? LIME : '#FFFFFF' }]}>
            {row.detail}
          </Text>
        </View>
      ))}
      {facts ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share these facts"
          onPress={() => void Share.share({ message: facts })}
          style={styles.shareHit}
        >
          <Text style={styles.shareText}>SHARE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NAVY },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 44 },
  backHit: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 17 },
  sampleToggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  sampleToggleText: { color: '#C8102E', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  page: { paddingHorizontal: 20, paddingBottom: 28 },
  eyebrow: { color: 'rgba(255,255,255,0.62)', fontSize: 12, letterSpacing: 1.4, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8, minHeight: 28, alignItems: 'center', marginTop: 8 },
  sample: { color: '#C8102E', borderColor: '#C8102E', borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '800' },
  confidence: { color: LIME, fontSize: 12, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, marginTop: 8 },
  figure: { fontSize: 84, lineHeight: 84, marginTop: 8 },
  unit: { color: 'rgba(255,255,255,0.72)', fontSize: 13, letterSpacing: 1.2, fontWeight: '700' },
  headline: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, marginTop: 8 },
  shareCard: { marginTop: 12, borderWidth: 1, borderColor: '#8AC926', borderRadius: 18, padding: 16 },
  invite: { color: '#FFFFFF', fontSize: 22, lineHeight: 28, marginTop: 18 },
  body: { color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 22, marginTop: 14 },
  action: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.16)' },
  rowLabel: { color: '#FFFFFF', fontSize: 15, flex: 1, flexShrink: 1 },
  shareHit: { minHeight: 44, marginTop: 16, borderRadius: 14, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: NAVY, fontSize: 16, fontWeight: '800', letterSpacing: 0.6 },
  rowDetail: { fontSize: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotOn: { backgroundColor: LIME },
});
