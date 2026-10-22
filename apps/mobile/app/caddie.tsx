import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { DistanceMetric } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { orderedLines, recommend } from '@coopr/engine';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Lines, Muted, Screen, Title } from '../src/ui';

export default function CaddieScreen() {
  const { profiles } = useLocalStore();
  const [distance, setDistance] = useState('');
  const [metric, setMetric] = useState<DistanceMetric>('carry');
  const [front, setFront] = useState('');
  const [lines, setLines] = useState<string[] | null>(null);

  const ask = () => {
    const target = Number(distance);
    if (!Number.isFinite(target)) {
      setLines(['Distance: enter a number before asking.']);
      return;
    }
    const carryToClear = front.trim() === '' ? null : Number(front);
    const card = recommend({
      targetDistanceYards: target,
      targetMetric: metric,
      hazards:
        carryToClear != null && Number.isFinite(carryToClear)
          ? [{ side: 'front', kind: 'carry line', carryToClearYards: carryToClear }]
          : [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles,
      personality: 'funny_knowledgeable',
    });
    setLines(orderedLines(card));
  };

  return (
    <Screen>
      <Title>Caddie</Title>
      <Muted>Manual distance. The card is math first. A personality may rephrase later and cannot pick the club.</Muted>
      <TextInput value={distance} onChangeText={setDistance} placeholder="Distance (yards)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        {(['carry', 'total'] as const).map((item) => (
          <Text key={item} onPress={() => setMetric(item)} style={[styles.chip, item === metric && styles.chipOn]}>
            {item}
          </Text>
        ))}
      </View>
      <TextInput value={front} onChangeText={setFront} placeholder="Front carry to clear (optional)" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} />
      <Button label="Ask" onPress={ask} />
      {lines ? (
        <Card>
          <Lines lines={lines} />
        </Card>
      ) : null}
      <Muted>{profiles.length === 0 ? 'No measured profiles yet. Practice first, or open founder verification.' : `${profiles.length} local profile${profiles.length === 1 ? '' : 's'}.`}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { color: colors.text, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { color: colors.muted, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { color: colors.bg, backgroundColor: colors.accent, borderColor: colors.accent },
});
