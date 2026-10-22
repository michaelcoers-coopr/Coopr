import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { loadHighCedarsPilot } from '@coopr/course';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Choice, Muted, Screen, Title } from '../src/ui';

const pilot = loadHighCedarsPilot();

function versus(strokes: number, par: number | null): string {
  if (par == null) return '';
  const diff = strokes - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

export default function ScorecardScreen() {
  const { holes, setStrokes, score, photoScorecards } = useLocalStore();
  const pars = pilot.record.scorecard;

  return (
    <Screen>
      <Title>Scorecard</Title>
      <Muted>High Cedars. Strokes only. The caddie cannot edit this card.</Muted>
      <Card>
        <Text style={styles.gross}>{score.holesEntered === 0 ? 'No strokes entered' : `Gross ${score.gross}`}</Text>
        <Muted>{`Front ${holes.slice(0, 9).some((strokes) => strokes != null) ? score.front : '—'} · Back ${holes.slice(9).some((strokes) => strokes != null) ? score.back : '—'} · Holes with a score ${score.holesEntered}`}</Muted>
        <Muted>Handicap is unknown. An estimate is not an official GHIN Handicap Index.</Muted>
      </Card>
      {photoScorecards.map((card) => (
        <Card key={card.id}>
          <Muted>{`${card.courseName ?? 'Course name unknown'} from a photo${card.sourceApp ? `, ${card.sourceApp}` : ''}${card.capturedOn ? `, ${card.capturedOn}` : ''}. This does not replace the High Cedars card.`}</Muted>
          {card.holes.map((hole) => (
            <Muted key={hole.hole}>{`Hole ${hole.hole} · par ${hole.par ?? '—'} · SI ${hole.strokeIndex ?? '—'} · ${hole.yardage ?? '—'} · strokes ${hole.strokes ?? '—'}`}</Muted>
          ))}
        </Card>
      ))}
      <Text style={styles.nine}>Front nine</Text>
      {holes.slice(0, 9).map((strokes, index) => {
        const hole = pars.find((item) => item.holeNumber === index + 1);
        const par = hole?.par ?? null;
        return (
          <View key={index + 1} style={styles.row}>
            <Text style={styles.hole}>{index + 1}</Text>
            <Text style={styles.par}>{`Par ${par ?? '—'}`}</Text>
            <Text style={styles.strokes}>{strokes ?? '—'}</Text>
            <Text style={styles.versus}>{strokes == null ? '' : versus(strokes, par)}</Text>
            <Choice label="−" selected={false} onPress={() => setStrokes(index + 1, strokes == null || strokes <= 1 ? null : strokes - 1)} />
            <Choice label="+" selected={false} onPress={() => setStrokes(index + 1, (strokes ?? 0) + 1)} />
          </View>
        );
      })}
      <Text style={styles.nine}>Back nine</Text>
      {holes.slice(9).map((strokes, index) => {
        const holeNumber = index + 10;
        const hole = pars.find((item) => item.holeNumber === holeNumber);
        const par = hole?.par ?? null;
        return (
          <View key={holeNumber} style={styles.row}>
            <Text style={styles.hole}>{holeNumber}</Text>
            <Text style={styles.par}>{`Par ${par ?? '—'}`}</Text>
            <Text style={styles.strokes}>{strokes ?? '—'}</Text>
            <Text style={styles.versus}>{strokes == null ? '' : versus(strokes, par)}</Text>
            <Choice label="−" selected={false} onPress={() => setStrokes(holeNumber, strokes == null || strokes <= 1 ? null : strokes - 1)} />
            <Choice label="+" selected={false} onPress={() => setStrokes(holeNumber, (strokes ?? 0) + 1)} />
          </View>
        );
      })}
      <Button label="Back to the hole" onPress={() => router.push('/play')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gross: { color: colors.navy, fontSize: 36, fontWeight: '800' },
  nine: { color: colors.navy, fontSize: 24, fontWeight: '800', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  hole: { color: colors.navy, width: 28, fontSize: 20, fontWeight: '800' },
  par: { color: colors.muted, width: 64, fontSize: 16 },
  strokes: { color: colors.navy, width: 36, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  versus: { color: colors.navy, width: 36, fontSize: 18, fontWeight: '800' },
});
