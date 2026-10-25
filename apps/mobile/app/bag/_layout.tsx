import { Stack } from 'expo-router';
import { BagScanProvider } from '../../src/bag-scan/session';
import { scan } from '../../src/bag-scan/chrome';

export default function BagLayout() {
  return (
    <BagScanProvider>
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
    </BagScanProvider>
  );
}
