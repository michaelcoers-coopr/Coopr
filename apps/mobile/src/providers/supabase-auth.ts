import type { AuthProvider, AuthSession } from '@coopr/core';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cloud auth behind the AuthProvider interface. Local-only mode remains the default;
// this activates only when Supabase is configured. Needs one live integration pass
// (Apple Sign In requires the Expo apple-authentication plugin + Supabase Apple
// provider config) before shipping — the shape and calls are here.
export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.getSession();
    const s = data.session;
    return s ? { userId: s.user.id, isAnonymous: false, email: s.user.email ?? null } : null;
  }

  async ensureLocalUser(): Promise<AuthSession> {
    const existing = await this.getSession();
    if (existing) return existing;
    // Supabase anonymous sign-in keeps offline-first parity before a real account.
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.user) throw error ?? new Error('anonymous sign-in failed');
    return { userId: data.user.id, isAnonymous: true, email: null };
  }

  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('sign-in failed');
    return { userId: data.user.id, isAnonymous: false, email: data.user.email ?? null };
  }

  async signInWithApple(): Promise<AuthSession> {
    // Wire expo-apple-authentication to obtain an identity token, then:
    // this.client.auth.signInWithIdToken({ provider: 'apple', token }). Required for
    // App Store when other social sign-in is offered.
    throw new Error('Apple Sign In wiring pending (expo-apple-authentication).');
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async deleteAccount(): Promise<void> {
    // Hard delete runs server-side (edge function with the service role) to remove the
    // auth user and their rows. The local wipe is handled by the app on success.
    await this.client.functions.invoke('delete-account');
  }
}
