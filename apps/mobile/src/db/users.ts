import { sqlite } from './client';

// Ensures a local `users` row exists for the active auth session, so local reads
// (which key off users.id) work identically whether auth is local-only or Supabase.
// For a Supabase session, id === auth.uid(), which is also the sync owner_id.
export function ensureLocalUserRow(id: string, email: string | null = null, isAnonymous = true): void {
  const now = Date.now();
  sqlite.runSync(
    'INSERT OR IGNORE INTO users (id, email, is_anonymous, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL);',
    [id, email, isAnonymous ? 1 : 0, now, now],
  );
}
