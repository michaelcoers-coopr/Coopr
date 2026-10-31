import { StyleSheet, Text, View } from 'react-native';
import { useDisplayFace } from './display-font';

export interface RecapHole {
  par: number | null;
  strokes: number | null;
  putts: number | null;
  fairway: string | null;
  gir: boolean | null;
}

function versus(diff: number): string {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

export function recapSummary(holes: readonly RecapHole[]) {
  let gross = 0;
  let parSum = 0;
  let scored = 0;
  let puttSum = 0;
  let fairwayHits = 0;
  let fairwayHoles = 0;
  let girHits = 0;
  let girHoles = 0;
  const front = { strokes: 0, par: 0, scored: 0 };
  const back = { strokes: 0, par: 0, scored: 0 };
  holes.forEach((hole, index) => {
    const par = hole.par;
    if (hole.strokes == null || par == null) return;
    scored += 1;
    gross += hole.strokes;
    parSum += par;
    const side = index < 9 ? front : back;
    side.strokes += hole.strokes;
    side.par += par;
    side.scored += 1;
    if (hole.putts != null) puttSum += hole.putts;
    if (par >= 4) {
      fairwayHoles += 1;
      if (hole.fairway === 'hit') fairwayHits += 1;
    }
    girHoles += 1;
    if (hole.gir === true) girHits += 1;
  });
  const headline = scored === 0 ? 'No score saved' : `Gross ${gross} · ${versus(gross - parSum)}`;
  const nines = `Front ${front.scored ? front.strokes : '—'} (${versus(front.strokes - front.par)}) · Back ${back.scored ? back.strokes : '—'} (${versus(back.strokes - back.par)})`;
  return { headline, nines, putts: `Putts ${puttSum}`, fairways: `Fairways ${fairwayHits} of ${fairwayHoles}`, greens: `Greens ${girHits} of ${girHoles}`, scored };
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
