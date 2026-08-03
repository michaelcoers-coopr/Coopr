import type { ProviderRegistry } from '@coopr/core';
import { noopAnalytics } from '@coopr/core';
import { LocalAuthProvider } from './local-auth';
import { supabase, isSupabaseConfigured } from './supabase-client';
import { SupabaseAuthProvider } from './supabase-auth';
import { SupabaseSyncProvider } from './supabase-sync';
import { SupabaseLanguageProvider } from './supabase-language';

// The app's provider registry. When Supabase env vars are present, the cloud auth and
// sync adapters are wired; otherwise the app runs fully offline with local-only auth.
// Either way core play is identical — sync enhances, never gates (invariant 4). Vision,
// course data, weather, equipment research, and subscriptions attach here later without
// touching feature code (invariant 9).
export const registry: ProviderRegistry = {
  auth: isSupabaseConfigured && supabase ? new SupabaseAuthProvider(supabase) : new LocalAuthProvider(),
  sync: isSupabaseConfigured && supabase ? new SupabaseSyncProvider(supabase) : undefined,
  // Wired when Supabase is configured; narration still no-ops gracefully until the
  // coach-narrate function + ANTHROPIC_API_KEY are deployed.
  language: isSupabaseConfigured && supabase ? new SupabaseLanguageProvider(supabase) : undefined,
  analytics: noopAnalytics,
};
