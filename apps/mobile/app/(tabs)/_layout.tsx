import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const t = useTheme();
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
