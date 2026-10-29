import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { HANDICAP_MAX, HANDICAP_MIN, rangedNumber, SPEED_MAX, SPEED_MIN } from '../src/bag-scan/logic';
import { useBagScan } from '../src/bag-scan/session';
import { useLocalStore } from '../src/local-store';
import { Button, Muted, Screen, Title } from '../src/ui';

export default function OnboardScreen() {
  const { finishOnboarding } = useLocalStore();
  const bag = useBagScan();
  const [name, setName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [speed, setSpeed] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finish = (save: boolean): boolean => {
    if (!save) {
      finishOnboarding({ name: '', handicap: null, driverSpeed: null });
      router.replace('/');
      return true;
    }
    const handicapValue = rangedNumber(handicap, HANDICAP_MIN, HANDICAP_MAX);
    const speedValue = rangedNumber(speed, SPEED_MIN, SPEED_MAX);
    if (handicapValue.problem || speedValue.problem) {
      setError(handicapValue.problem ? `Handicap has to be from ${HANDICAP_MIN} to ${HANDICAP_MAX}.` : `Driver speed has to be from ${SPEED_MIN} to ${SPEED_MAX} mph.`);
      return false;
    }
    setError(null);
    finishOnboarding({ name, handicap: handicapValue.value, driverSpeed: speedValue.value });
    router.replace('/');
    return true;
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Save" onPress={() => finish(true)} />
          <Button
            label="Use a starter bag"
            onPress={() => {
              const handicapValue = rangedNumber(handicap, HANDICAP_MIN, HANDICAP_MAX);
              const speedValue = rangedNumber(speed, SPEED_MIN, SPEED_MAX);
              if (finish(true)) bag.useStarterBag({ handicap: handicapValue.value, driverSpeed: speedValue.value });
            }}
          />
          <Button label="Skip" tone="ghost" onPress={() => finish(false)} />
        </>
      }
    >
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  error: { color: colors.red, fontWeight: '700' },
});
