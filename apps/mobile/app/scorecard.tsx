import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { useLocalStore } from '../src/local-store';
import { Card, Muted, Screen, Title } from '../src/ui';

export default function ScorecardScreen() {
  const { holes, setStrokes, score } = useLocalStore();

  return (
    <Screen>
      <Title>Scorecard</Title>
      <Muted>Strokes only. The caddie cannot edit this card, and the gross does not come from a sentence.</Muted>
      <Card>
        <Text style={styles.gross}>{`Gross ${score.gross}`}</Text>
        <Muted>{`Front ${score.front} · Back ${score.back} · Holes entered ${score.holesEntered}`}</Muted>
        <Muted>Handicap: unknown. An estimate would be labeled as not an official GHIN Handicap Index.</Muted>
      </Card>
      {holes.map((strokes, index) => (
        <View key={index + 1} style={styles.row}>
          <Text style={styles.hole}>{index + 1}</Text>
          <Text style={styles.strokes}>{strokes ?? '–'}</Text>
          <Text style={styles.step} onPress={() => setStrokes(index + 1, Math.max(0, (strokes ?? 0) - 1) || null)}>
            −
          </Text>
          <Text style={styles.step} onPress={() => setStrokes(index + 1, (strokes ?? 0) + 1)}>
            +
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gross: { color: colors.text, fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  hole: { color: colors.muted, width: 28 },
  strokes: { color: colors.text, width: 36, fontSize: 18 },
  step: {
    color: colors.bg,
    backgroundColor: colors.accent,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontWeight: '800',
  },
});
