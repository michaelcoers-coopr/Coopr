import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@coopr/tokens';
import { FloatingAsk } from '../src/design/floating-ask';
import { LocalStoreProvider } from '../src/local-store';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocalStoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.navy,
            headerTitleStyle: { fontWeight: '800', fontSize: 20 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
            title: 'COOPR',
          }}
        />
        <FloatingAsk />
      </LocalStoreProvider>
    </SafeAreaProvider>
  );
}
