import type { SyncProvider, RowDelta } from '@coopr/core';
import { sqlite } from './client';

// Sync reconciliation core. The local SQLite store is authoritative (invariant 4);
// this only enhances it and never gates play. Strategy: last-write-wins per row by
// `updated_at`, with soft deletes. Every user write also calls `enqueueOutbox` so the
// change is pushed on the next sync. The concrete cloud adapter (Supabase) implements
// SyncProvider; this engine is provider-agnostic.

// Note: the local `users` table is a mirror of Supabase auth.users and is NOT synced.
const SYNCED_TABLES = new Set([
  'golfer_profiles', 'caddie_profiles', 'bags', 'clubs', 'club_feedback',
  'sessions', 'shots', 'calibration_profiles', 'recommendations', 'rounds',
  'hole_scores', 'course_shots', 'integration_connections',
]);

export function enqueueOutbox(table: string, rowId: string, op: 'upsert' | 'delete', updatedAt: number): void {
  sqlite.runSync(
    'INSERT OR REPLACE INTO sync_outbox (id, table_name, row_id, op, updated_at) VALUES (?, ?, ?, ?, ?);',
    [`${table}:${rowId}`, table, rowId, op, updatedAt],
  );
}

function getMeta(key: string): number {
  const row = sqlite.getFirstSync<{ v: string }>('SELECT v FROM _sync_meta WHERE k = ?;', [key]);
  return row ? Number(row.v) : 0;
}
function setMeta(key: string, value: number): void {
  sqlite.runSync('INSERT OR REPLACE INTO _sync_meta (k, v) VALUES (?, ?);', [key, String(value)]);
}

function localUpdatedAt(table: string, id: string): number | null {
  const row = sqlite.getFirstSync<{ updated_at: number }>(`SELECT updated_at FROM ${table} WHERE id = ?;`, [id]);
  return row?.updated_at ?? null;
}

// Apply an incoming delta only if it is newer than the local row (LWW). Deletes are
// soft and win ties by not being older.
function applyDelta(d: RowDelta): void {
  if (!SYNCED_TABLES.has(d.table)) return;
  const local = localUpdatedAt(d.table, d.id);
  if (local != null && local >= d.updatedAt) return; // local is newer or equal — keep it

  if (d.deletedAt != null) {
    sqlite.runSync(
      `UPDATE ${d.table} SET deleted_at = ?, updated_at = ? WHERE id = ?;`,
      [d.deletedAt, d.updatedAt, d.id],
    );
    return;
  }
  if (!d.data) return;
  const cols = Object.keys(d.data);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => normalize(d.data![c]));
  sqlite.runSync(
    `INSERT OR REPLACE INTO ${d.table} (${cols.join(', ')}) VALUES (${placeholders});`,
    values,
  );
}

function normalize(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return JSON.stringify(v);
}

export class SyncEngine {
  constructor(private readonly provider: SyncProvider) {}

  ensureMeta(): void {
    sqlite.execSync('CREATE TABLE IF NOT EXISTS _sync_meta (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);');
  }

  /** Push pending local changes, then pull and merge remote changes. Best-effort. */
  async sync(): Promise<void> {
    this.ensureMeta();
    // Push
    const pending = sqlite.getAllSync<{ table_name: string; row_id: string; op: string; updated_at: number }>(
      'SELECT table_name, row_id, op, updated_at FROM sync_outbox ORDER BY updated_at ASC;',
    );
    if (pending.length > 0) {
      const deltas: RowDelta[] = pending.map((p) => toDelta(p.table_name, p.row_id, p.op, p.updated_at));
      await this.provider.push(deltas);
      sqlite.runSync('DELETE FROM sync_outbox;');
    }
    // Pull
    const since = getMeta('last_pull');
    const incoming = await this.provider.pull(since);
    let maxSeen = since;
    sqlite.withTransactionSync(() => {
      for (const d of incoming) {
        applyDelta(d);
        if (d.updatedAt > maxSeen) maxSeen = d.updatedAt;
      }
    });
    setMeta('last_pull', maxSeen);
  }
}

function toDelta(table: string, id: string, op: string, updatedAt: number): RowDelta {
  if (op === 'delete') {
    return { table, id, updatedAt, deletedAt: updatedAt, data: null };
  }
  const row = sqlite.getFirstSync<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?;`, [id]);
  return { table, id, updatedAt, deletedAt: null, data: row ?? null };
}
