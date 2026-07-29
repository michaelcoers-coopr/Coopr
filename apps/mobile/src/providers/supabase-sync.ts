import type { SyncProvider, RowDelta } from '@coopr/core';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cloud sync behind the SyncProvider interface, consumed by the local SyncEngine
// (which owns the last-write-wins merge). This adapter is a thin transport: push
// upserts/soft-deletes, pull rows changed since a watermark. Needs one live pass
// against the deployed Postgres schema (supabase/schema.sql) + RLS before shipping.
export class SupabaseSyncProvider implements SyncProvider {
  constructor(private readonly client: SupabaseClient) {}

  async push(deltas: RowDelta[]): Promise<void> {
    // Group by table; upsert data rows, and mark deletes by writing deleted_at.
    const byTable = new Map<string, RowDelta[]>();
    for (const d of deltas) {
      const arr = byTable.get(d.table);
      if (arr) arr.push(d);
      else byTable.set(d.table, [d]);
    }
    for (const [table, rows] of byTable) {
      const payload = rows.map((d) =>
        d.deletedAt != null
          ? { id: d.id, deleted_at: d.deletedAt, updated_at: d.updatedAt }
          : { ...(d.data ?? {}), id: d.id, updated_at: d.updatedAt },
      );
      const { error } = await this.client.from(table).upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    }
  }

  async pull(since: number): Promise<RowDelta[]> {
    // Server `changes_since` RPC unions all synced tables filtered by updated_at >
    // since, returning rows shaped {tbl, id, updated_at, deleted_at, data}. Map those
    // onto RowDelta.
    const { data, error } = await this.client.rpc('changes_since', { since_ms: since });
    if (error) throw error;
    type Row = { tbl: string; id: string; updated_at: number; deleted_at: number | null; data: Record<string, unknown> | null };
    return ((data ?? []) as Row[]).map((r) => ({
      table: r.tbl,
      id: r.id,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      data: r.data,
    }));
  }
}
