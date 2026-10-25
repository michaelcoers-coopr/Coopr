import { Stack } from 'expo-router';
import { scan } from '../../src/bag-scan/chrome';

export default function BagLayout() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: scan.navy } }} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: scan.navy },
          headerTintColor: scan.white,
          headerTitleStyle: { fontWeight: '800', color: scan.white },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: scan.navy },
        }}
      />
    </>
  );
}
