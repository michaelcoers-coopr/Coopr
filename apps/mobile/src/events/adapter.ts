import { createEventStore, type EventStore } from './store';
import type { StoredEvent } from './types';

/** One saved event plus the revision a later write must match. */
export interface EventRecord {
  event: StoredEvent;
  revision: number;
}

/**
 * Persistence for one charity event at a time.
 * `compareAndSwap` writes only when `expectedRevision` is still current.
 * `null` means "insert this code". A lost race returns null so the caller can retry.
 */
export interface EventAdapter {
  kind: 'memory' | 'postgres';
  migrate(): Promise<void>;
  list(): Promise<EventRecord[]>;
  read(code: string): Promise<EventRecord | null>;
  compareAndSwap(event: StoredEvent, expectedRevision: number | null): Promise<EventRecord | null>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** In-process adapter. CI uses it for concurrent posts and idempotent replays. */
export function createMemoryEventAdapter(): EventAdapter {
  const rows = new Map<string, EventRecord>();

  return {
    kind: 'memory',
    async migrate() {
      await Promise.resolve();
    },
    async list() {
      await Promise.resolve();
      return [...rows.values()].map((row) => ({ event: clone(row.event), revision: row.revision }));
    },
    async read(code: string) {
      await Promise.resolve();
      const row = rows.get(code.trim().toUpperCase());
      return row ? { event: clone(row.event), revision: row.revision } : null;
    },
    async compareAndSwap(event: StoredEvent, expectedRevision: number | null) {
      await Promise.resolve();
      const code = event.code.trim().toUpperCase();
      const current = rows.get(code) ?? null;
      if (expectedRevision == null) {
        if (current) return null;
        const saved = { event: clone(event), revision: 1 };
        rows.set(code, saved);
        return { event: clone(saved.event), revision: saved.revision };
      }
      if (!current || current.revision !== expectedRevision) return null;
      const saved = { event: clone(event), revision: current.revision + 1 };
      rows.set(code, saved);
      return { event: clone(saved.event), revision: saved.revision };
    },
  };
}

const ATTEMPTS = 16;

/**
 * Run a store mutation, then save each changed event with compare-and-swap.
 * A lost race retries against the latest row, so two groups cannot erase each other.
 * Score posts stay idempotent because the key and the strokes land in the same row.
 */
export async function commitOnAdapter<T>(adapter: EventAdapter, run: (store: EventStore) => T | Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const records = await adapter.list();
    const revisions = new Map(records.map((record) => [record.event.code, record.revision]));
    const before = new Map(records.map((record) => [record.event.code, JSON.stringify(record.event)]));
    let dirty = false;
    const store = createEventStore({
      onChange() {
        dirty = true;
      },
    });
    store.load(records.map((record) => record.event));
    const result = await run(store);
    if (!dirty) return result;
    let conflict = false;
    for (const event of store.snapshot()) {
      if (before.get(event.code) === JSON.stringify(event)) continue;
      const expected = revisions.has(event.code) ? revisions.get(event.code) ?? null : null;
      const saved = await adapter.compareAndSwap(event, expected);
      if (!saved) {
        conflict = true;
        break;
      }
    }
    if (!conflict) return result;
  }
  throw new Error('Another group posted at the same moment. Try again.');
}

/** Insert SAMPLE when it is missing. A current seed is left alone, including its scores. */
export async function seedSampleEvent(adapter: EventAdapter): Promise<void> {
  await adapter.migrate();
  await commitOnAdapter(adapter, (store) => {
    store.ensureDemo();
  });
}
