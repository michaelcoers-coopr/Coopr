import type { AuthProvider, AuthSession } from '@coopr/core';
import { sqlite } from '../db/client';
import { getFirstUserId } from '../db/repo';
import { newId } from '../lib/id';

// Offline-first auth: the app is fully usable as an anonymous local user before any
// sign-in. Cloud sign-in (Supabase + Apple) plugs in behind this same interface as an
// online enhancement — it is not required for core play (invariant 4).
export class LocalAuthProvider implements AuthProvider {
  async getSession(): Promise<AuthSession | null> {
    const id = getFirstUserId();
    return id ? { userId: id, isAnonymous: true, email: null } : null;
  }

  async ensureLocalUser(): Promise<AuthSession> {
    let id = getFirstUserId();
    if (!id) {
      id = newId();
      const now = Date.now();
      sqlite.runSync(
        'INSERT INTO users (id, email, is_anonymous, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?);',
        [id, null, 1, now, now, null],
      );
    }
    return { userId: id, isAnonymous: true, email: null };
  }

  async signInWithEmail(): Promise<AuthSession> {
    throw new Error('Cloud auth not configured yet. Local-only mode is active.');
  }
  async signInWithApple(): Promise<AuthSession> {
    throw new Error('Cloud auth not configured yet. Local-only mode is active.');
  }
  async signOut(): Promise<void> {}

  async deleteAccount(): Promise<void> {
    // The golfer owns their history (invariant 8): a full local wipe. Cloud deletion
    // is added with the Supabase provider.
    const now = Date.now();
    sqlite.runSync('UPDATE users SET deleted_at = ? WHERE deleted_at IS NULL;', [now]);
  }
}
