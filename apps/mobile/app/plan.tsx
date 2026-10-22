import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { loadHighCedarsPilot } from '@coopr/course';
import { useLocalStore } from '../src/local-store';
import { Card, Muted, Screen, Title } from '../src/ui';

const pilot = loadHighCedarsPilot();

export default function PlanScreen() {
  const { plans, setPlan } = useLocalStore();
  const [note] = useState('A plan is a choice before the round. It does not change a score.');

  return (
    <Screen>
      <Title>Game plan</Title>
      <Muted>{note}</Muted>
      {pilot.record.scorecard.map((hole) => {
        const plan = plans[hole.holeNumber] ?? { clubLabel: '', target: '' };
        return (
          <Card key={hole.holeNumber}>
            <Text style={styles.hole}>{`Hole ${hole.holeNumber} · par ${hole.par ?? '—'}`}</Text>
            <View style={styles.row}>
              <TextInput
                value={plan.clubLabel}
                onChangeText={(clubLabel) => setPlan(hole.holeNumber, { clubLabel })}
                placeholder="Tee club"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.half]}
                accessibilityLabel={`Hole ${hole.holeNumber} club`}
              />
              <TextInput
                value={plan.target}
                onChangeText={(target) => setPlan(hole.holeNumber, { target })}
                placeholder="Target"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.half]}
                accessibilityLabel={`Hole ${hole.holeNumber} target`}
              />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hole: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  input: {
    color: colors.navy,
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 2,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 12,
    fontSize: 18,
  },
});
