import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function OnboardingLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.ink },
        headerTintColor: t.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.ink },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Welcome', headerShown: false }} />
      <Stack.Screen name="session" options={{ title: 'Baseline session' }} />
      <Stack.Screen name="csv" options={{ title: 'Import session' }} />
    </Stack>
  );
}
