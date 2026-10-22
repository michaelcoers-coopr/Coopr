import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@coopr/tokens';
import { LocalStoreProvider } from '../src/local-store';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocalStoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
            title: 'COOPR',
          }}
        />
      </LocalStoreProvider>
    </SafeAreaProvider>
  );
}
