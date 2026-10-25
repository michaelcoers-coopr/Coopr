import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { useLocalStore } from '../src/local-store';
import { Button, Muted, Screen, Title } from '../src/ui';

function optionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export default function OnboardScreen() {
  const { finishOnboarding } = useLocalStore();
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [speed, setSpeed] = useState('');

  const finish = (save: boolean) => {
    finishOnboarding(
      save
        ? { name, handicap: optionalNumber(handicap), driverSpeed: optionalNumber(speed) }
        : { name: '', handicap: null, driverSpeed: null },
    );
    router.replace('/');
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false, title: 'Start' }} />
      <Title>Before you tee off</Title>
      <Muted>Skip anything. COOPR keeps what you type on this phone.</Muted>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <Muted>Your entry.</Muted>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Name, your entry"
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Handicap</Text>
        <Muted>Your entry. COOPR does not compute a handicap index.</Muted>
        <TextInput
          value={handicap}
          onChangeText={setHandicap}
          accessibilityLabel="Handicap, your entry"
          keyboardType="decimal-pad"
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Driver speed</Text>
        <Muted>Your entry. Not a measured swing speed.</Muted>
        <TextInput
          value={speed}
          onChangeText={setSpeed}
          accessibilityLabel="Driver speed, your entry"
          keyboardType="decimal-pad"
          placeholder="Miles per hour, optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      <Button label="Save" onPress={() => finish(true)} />
      <Button label="Skip" tone="ghost" onPress={() => finish(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 18, fontWeight: '800' },
  input: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.navy,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: 18,
    paddingHorizontal: 14,
  },
});
