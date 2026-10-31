import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@coopr/tokens';
import { useBagScan } from '../src/bag-scan/session';
import { useLocalStore } from '../src/local-store';
import { Button, Muted, Screen, Title } from '../src/ui';

/** First launch asks for a name, then the course. Handicap and speed live on Setup. */
export default function OnboardScreen() {
  const { finishOnboarding } = useLocalStore();
  const bag = useBagScan();
  const [name, setName] = useState('');

  const teeOff = () => {
    finishOnboarding({ name, handicap: null, driverSpeed: null });
    bag.useStarterBag();
    router.replace('/');
  };

  return (
    <Screen footer={<Button label="Tee off" onPress={teeOff} />}>
      <Stack.Screen options={{ headerShown: false, title: 'Start' }} />
      <Title>What's your name?</Title>
      <Muted>Your entry. A starter bag comes with you. Those carries are estimated. Handicap and driver speed are in Setup.</Muted>
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Name, your entry"
          placeholder="Optional"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
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
