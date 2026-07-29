import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/theme';
import { runMigrations } from '../src/db/migrations';
import { seedIfEmpty } from '../src/db/seed';
import { registry } from '../src/providers/registry';
import { ensureLocalUserRow } from '../src/db/users';
import { runSyncSafely } from '../src/features/sync-runner';

const queryClient = new QueryClient();

// Demo seed: loads Seed User 001 (the founding dataset) on first run so the app is
// populated for validation. Production sets this false so a fresh user goes through
// onboarding to build their own baseline.
const LOAD_DEMO_SEED = true;

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Offline-first boot: migrate the local store and optionally load the demo seed.
    // The UI is ready immediately — nothing here waits on the network.
    runMigrations();
    if (LOAD_DEMO_SEED) seedIfEmpty();
    setReady(true);

    // Online layer runs in the background and never gates play: ensure the auth
    // session + its local user row, then attempt a sync. Failures (offline, or no
    // cloud configured) are swallowed; local SQLite stays authoritative.
    void (async () => {
      try {
        const session = await registry.auth?.ensureLocalUser();
        if (session) ensureLocalUserRow(session.userId, session.email, session.isAnonymous);
        await runSyncSafely();
      } catch {
        /* offline-first: ignore */
      }
    })();
  }, []);

  useEffect(() => {
    // Sync when the app returns to the foreground (cheap no-op when cloud is unset).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runSyncSafely();
    });
    return () => sub.remove();
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
            <Stack.Screen name="equipment-lab" options={{ headerShown: true, title: 'Equipment Lab' }} />
            <Stack.Screen name="club/[id]" options={{ headerShown: true, title: 'Club' }} />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
