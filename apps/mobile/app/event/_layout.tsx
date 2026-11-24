import { Stack } from 'expo-router';
import { colors } from '@coopr/tokens';

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.navy,
        headerTitleStyle: { color: colors.navy },
        contentStyle: { backgroundColor: '#F7F5F2' },
      }}
    />
  );
}
