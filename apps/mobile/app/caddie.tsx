import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PERSONALITY_LABELS, PERSONALITIES, type DistanceMetric } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { orderedLines, recommend } from '@coopr/engine';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Choice, Lines, Muted, Screen, Title } from '../src/ui';

export default function CaddieScreen() {
  const { profiles, caddieName, personality, personalityLabel, founderTools, setCaddieName, setPersonality } = useLocalStore();
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
      personality,
    });
    setLines(orderedLines(card));
  };

  return (
    <Screen>
      <Title>{caddieName || 'Caddie'}</Title>
      <TextInput
        value={caddieName}
        onChangeText={setCaddieName}
        placeholder="Caddie name"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Caddie name"
      />
      <Muted>The default stays COOPR, Funny but Knowledgeable, until you pick another. The hole screen uses this tone.</Muted>
      <View style={styles.wrap}>
        {PERSONALITIES.map((item) => (
          <Choice key={item} label={PERSONALITY_LABELS[item]} selected={personality === item} onPress={() => setPersonality(item)} />
        ))}
      </View>
      <Muted>
        {founderTools
          ? `${caddieName}, ${personalityLabel}. Distances below are the founder profile. A manual distance still cannot invent a number.`
          : 'Manual distance. The card is math first. A personality may rephrase later and cannot pick the club.'}
      </Muted>
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
      <Muted>
        {profiles.length === 0
          ? 'No measured profiles yet. Practice first.'
          : `${profiles.length} profile${profiles.length === 1 ? '' : 's'} on this device.`}
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { color: colors.navy, backgroundColor: colors.white, borderColor: colors.navy, borderWidth: 2, borderRadius: 14, minHeight: 56, paddingHorizontal: 14, fontSize: 20 },
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { color: colors.navy, borderColor: colors.navy, borderWidth: 2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, fontWeight: '700', overflow: 'hidden' },
  chipOn: { color: colors.white, backgroundColor: colors.navy, borderColor: colors.navy },
});
