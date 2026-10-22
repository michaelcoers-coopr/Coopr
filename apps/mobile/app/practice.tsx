import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { EnvironmentName } from '@coopr/domain';
import { colors } from '@coopr/tokens';
import { useLocalStore } from '../src/local-store';
import { Button, Card, Muted, Screen, Title } from '../src/ui';

const ENVIRONMENTS: EnvironmentName[] = ['simulator', 'range', 'course'];

export default function PracticeScreen() {
  const { addShot, shots } = useLocalStore();
  const [clubLabel, setClubLabel] = useState('');
  const [environment, setEnvironment] = useState<EnvironmentName>('range');
  const [swingMode, setSwingMode] = useState('unknown');
  const [carry, setCarry] = useState('');
  const [total, setTotal] = useState('');
  const [message, setMessage] = useState('Carry and total are separate. Leaving one blank keeps it unknown.');

  const save = () => {
    const carryYards = carry.trim() === '' ? null : Number(carry);
    const totalYards = total.trim() === '' ? null : Number(total);
    if (!clubLabel.trim()) {
      setMessage('Name the club before saving.');
      return;
    }
    if ((carryYards != null && !Number.isFinite(carryYards)) || (totalYards != null && !Number.isFinite(totalYards))) {
      setMessage('Distances need to be numbers.');
      return;
    }
    if (carryYards == null && totalYards == null) {
      setMessage('Enter a carry, a total, or both. An empty pair is not a shot.');
      return;
    }
    addShot({
      clubId: clubLabel.trim(),
      clubLabel: clubLabel.trim(),
      environment,
      swingMode: swingMode.trim() || 'unknown',
      carry: carryYards,
      total: totalYards,
      lateralMiss: 'none',
    });
    setCarry('');
    setTotal('');
    setMessage('Saved on this device. A blank field was not copied from the other.');
  };

  return (
    <Screen>
      <Title>Practice & calibrate</Title>
      <Muted>Manual shots work offline. Simulator, range, and course stay separate.</Muted>
      <TextInput value={clubLabel} onChangeText={setClubLabel} placeholder="Club" placeholderTextColor={colors.muted} style={styles.input} />
      <View style={styles.row}>
        {ENVIRONMENTS.map((item) => (
          <Text key={item} onPress={() => setEnvironment(item)} style={[styles.chip, item === environment && styles.chipOn]}>
            {item}
          </Text>
        ))}
      </View>
      <TextInput value={swingMode} onChangeText={setSwingMode} placeholder="Swing mode" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={carry} onChangeText={setCarry} placeholder="Carry yards" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={total} onChangeText={setTotal} placeholder="Total yards" keyboardType="decimal-pad" placeholderTextColor={colors.muted} style={styles.input} />
      <Button label="Save shot" onPress={save} />
      <Muted>{message}</Muted>
      {shots.map((shot) => (
        <Card key={shot.id}>
          <Muted>
            {`${shot.clubLabel} · ${shot.environment} · ${shot.swingMode} · carry ${shot.carry ?? 'unknown'} · total ${shot.total ?? 'unknown'}`}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 14,
    fontSize: 20,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: { color: colors.navy, borderColor: colors.navy, borderWidth: 2, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, fontWeight: '700', overflow: 'hidden' },
  chipOn: { color: colors.white, backgroundColor: colors.navy, borderColor: colors.navy },
});
