import { StyleSheet, Text, View } from 'react-native';
import { useDisplayFace } from './display-font';
import { recapSummary, type RecapHole } from './recap-math';

export type { RecapHole } from './recap-math';
export { recapSummary } from './recap-math';

function versus(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

export function RecapBody({ holes }: { holes: readonly RecapHole[] }) {
  const summary = recapSummary(holes);
  const display = useDisplayFace();
  return (
    <View testID="recap-card" style={styles.card}>
      <Text testID="recap-gross" style={[styles.gross, { fontFamily: display }]}>{summary.headline}</Text>
      <Text style={styles.line}>{summary.nines}</Text>
      <Text style={styles.line}>{summary.putts}</Text>
      <Text style={styles.line}>{summary.fairways}</Text>
      <Text style={styles.line}>{summary.greens}</Text>
      <View style={styles.grid}>
        {holes.map((hole, index) => {
          const mark = hole.strokes == null || hole.par == null ? '—' : versus(hole.strokes - hole.par);
          return <Text key={index} style={styles.hole}>{`${index + 1} ${hole.strokes ?? '—'} ${mark}`}</Text>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 8 },
  gross: { color: '#0B1F3A', fontSize: 56, lineHeight: 64, fontWeight: '700' },
  line: { color: '#0B1F3A', fontSize: 16, lineHeight: 24, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  hole: { minWidth: 72, minHeight: 32, color: '#0B1F3A', fontSize: 16, fontWeight: '700' },
});
