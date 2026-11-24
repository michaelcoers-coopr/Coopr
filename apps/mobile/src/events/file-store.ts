import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEventStore, type EventStore } from './store';
import type { StoredEvent } from './types';

/**
 * JSON file for local expo and CI. A rename keeps one save from tearing the file.
 * Two hosts writing this file can still drop a score. Set DATABASE_URL for a real
 * event so each score is a compare-and-swap. See docs/CHARITY_EVENTS.md.
 */
export function openFileEventStore(file: string): EventStore {
  const store = createEventStore({
    onChange(events) {
      mkdirSync(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify({ events }));
      renameSync(temp, file);
    },
  });
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { events?: StoredEvent[] };
      if (Array.isArray(parsed.events)) store.load(parsed.events);
    } catch {
      // A torn file should not take the board down. The next save rewrites it.
    }
  }
  return store;
}

function defaultFile(): string {
  const override = process.env.COOPR_EVENT_STORE?.trim();
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', '.data', 'charity-events.json');
}

let singleton: EventStore | null = null;

export function eventStore(): EventStore {
  if (!singleton) {
    singleton = openFileEventStore(defaultFile());
    singleton.ensureDemo();
  }
  return singleton;
}
