import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme';
import { runMigrations } from '../src/db/migrations';
import { seedIfEmpty } from '../src/db/seed';
import { registry } from '../src/providers/registry';

const queryClient = new QueryClient();

// Demo seed: loads Seed User 001 (the founding dataset) on first run so the app is
// populated for validation. Production sets this false so a fresh user goes through
// onboarding to build their own baseline.
const LOAD_DEMO_SEED = true;

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Offline-first boot: migrate the local store, optionally load the demo seed, and
    // ensure a local (anonymous) user before anything reads. No network required.
    runMigrations();
    if (LOAD_DEMO_SEED) seedIfEmpty();
    void registry.auth?.ensureLocalUser();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="assessment" options={{ headerShown: true, title: 'Golf IQ' }} />
            <Stack.Screen name="club/[id]" options={{ headerShown: true, title: 'Club' }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
