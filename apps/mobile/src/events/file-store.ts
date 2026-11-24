import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEventStore, type EventStore } from './store';
import type { StoredEvent } from './types';

/**
 * One JSON file on the API process. Expo API routes are request/response, so the
 * board polls instead of holding a socket. The file survives a restart of `expo start`
 * on a machine with a disk. EAS Hosting can wipe the disk. Set COOPR_EVENT_STORE to a
 * persistent path before a real event. See docs/CHARITY_EVENTS.md.
 */
export function openFileEventStore(file: string): EventStore {
  const store = createEventStore({
    onChange(events) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ events }));
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
