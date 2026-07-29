import { Tabs, Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme';
import { isOnboardingComplete } from '../../src/db/settings';

export default function TabsLayout() {
  const t = useTheme();
  // First-run gate: a fresh install with no baseline is sent to onboarding. The demo
  // seed marks onboarding complete, so seeded builds go straight into the app.
  if (!isOnboardingComplete()) return <Redirect href="/(onboarding)" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Play' }} />
      <Tabs.Screen name="caddie" options={{ title: 'Caddie' }} />
      <Tabs.Screen name="bag" options={{ title: 'Bag' }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
