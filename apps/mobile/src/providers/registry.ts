import type { ProviderRegistry } from '@coopr/core';
import { noopAnalytics } from '@coopr/core';
import { LocalAuthProvider } from './local-auth';
import { supabase } from './supabase-client';
import { SupabaseLanguageProvider } from './supabase-language';

// The app's provider registry.
//
// Auth stays LOCAL for now so the seeded demo golfer (and any locally-created data) is
// what you see — cloud auth + sync are built (see supabase-auth.ts / supabase-sync.ts)
// but wait on the local→cloud identity migration before they replace local auth.
//
// The caddie VOICE, however, only needs the edge function, so it wires up whenever a
// Supabase client exists (EXPO_PUBLIC_SUPABASE_* set). It never gates play: if the
// function or key is missing, narration throws and callers fall back to the deterministic
// answer. Vision, course data, weather, equipment research, and subscriptions attach here
// later without touching feature code.
export const registry: ProviderRegistry = {
  auth: new LocalAuthProvider(),
  language: supabase ? new SupabaseLanguageProvider(supabase) : undefined,
  analytics: noopAnalytics,
};
