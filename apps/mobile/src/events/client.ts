import { webStore } from '../web-storage';
import { DEMO_CODE, DEMO_ORGANIZER_TOKEN, POLL_MS, type EventFormat, type GuestRole, type LiveSession, type PublicEvent } from './types';
import { enqueueScore, flushOutbox, type OutboxEntry } from './outbox';

export { POLL_MS };
export const SESSION_KEY = 'coopr.event.session.v1';
export const OUTBOX_KEY = 'coopr.event.outbox.v1';
export const ORGANIZER_KEY = 'coopr.event.organizer.v1';
export const SEQ_KEY = 'coopr.event.seq.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memory = new Map<string, string>();
const memoryStore: StorageLike = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

function storage(): StorageLike {
  return webStore() ?? memoryStore;
}

export function eventOrigin(): string | null {
  const configured = process.env.EXPO_PUBLIC_EVENT_ORIGIN?.trim();
  if (configured && !configured.includes('REPLACE')) return configured.replace(/\/$/, '');
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (origin && origin !== 'null') return origin;
  return null;
}

export function joinPath(code: string): string {
  return `/event/join?code=${encodeURIComponent(code)}`;
}

export function joinLink(code: string): string {
  const origin = eventOrigin();
  const path = joinPath(code);
  return origin ? `${origin}${path}` : path;
}

function readJson<T>(store: StorageLike, key: string): T | null {
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadSession(store: StorageLike = storage()): LiveSession | null {
  const session = readJson<LiveSession>(store, SESSION_KEY);
  if (!session || typeof session.token !== 'string' || typeof session.code !== 'string') return null;
  return session;
}

export function saveSession(session: LiveSession, store: StorageLike = storage()) {
  store.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(store: StorageLike = storage()) {
  store.setItem(SESSION_KEY, '');
}

export function loadOrganizerToken(code: string, store: StorageLike = storage()): string | null {
  if (code.toUpperCase() === DEMO_CODE) return DEMO_ORGANIZER_TOKEN;
  const map = readJson<Record<string, string>>(store, ORGANIZER_KEY) ?? {};
  return map[code.toUpperCase()] ?? null;
}

export function saveOrganizerToken(code: string, token: string, store: StorageLike = storage()) {
  const map = readJson<Record<string, string>>(store, ORGANIZER_KEY) ?? {};
  map[code.toUpperCase()] = token;
  store.setItem(ORGANIZER_KEY, JSON.stringify(map));
}

function loadOutbox(store: StorageLike): OutboxEntry[] {
  const items = readJson<OutboxEntry[]>(store, OUTBOX_KEY);
  return Array.isArray(items) ? items : [];
}

function saveOutbox(store: StorageLike, items: OutboxEntry[]) {
  store.setItem(OUTBOX_KEY, JSON.stringify(items));
}

function nextSeq(store: StorageLike): number {
  const current = Number(store.getItem(SEQ_KEY) ?? '0');
  const seq = Math.max(Date.now(), (Number.isFinite(current) ? current : 0) + 1);
  store.setItem(SEQ_KEY, String(seq));
  return seq;
}

/** Scorers only. Viewers look at the round and do not post. */
export function queueEventScore(hole: number, strokes: number | null, store: StorageLike = storage()): OutboxEntry | null {
  const session = loadSession(store);
  if (!session || session.role !== 'scorer') return null;
  if (!Number.isInteger(hole) || hole < 1 || hole > 18) return null;
  const seq = nextSeq(store);
  const entry: OutboxEntry = {
    idempotencyKey: `${session.code}:${session.playerId}:${hole}:${seq}`,
    eventCode: session.code,
    groupId: session.groupId,
    playerId: session.playerId,
    hole,
    strokes,
    clientSeq: seq,
    status: 'pending',
    error: null,
  };
  saveOutbox(store, enqueueScore(loadOutbox(store), entry));
  return entry;
}

export function outboxNote(store: StorageLike = storage()): string | null {
  const items = loadOutbox(store);
  if (items.some((item) => item.status === 'conflict')) return 'Score held';
  if (items.some((item) => item.status === 'pending')) return 'Syncing';
  if (items.some((item) => item.status === 'rejected')) return 'Not posted';
  return null;
}

export async function eventRequest(path: string, init?: { method?: string; token?: string | null; guest?: string | null; body?: unknown }): Promise<{ status: number; body: Record<string, unknown> }> {
  const origin = eventOrigin();
  if (!origin) return { status: 0, body: { error: 'Scores stay on this phone until the event host is set.' } };
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (init?.token) headers['x-coopr-organizer'] = init.token;
    if (init?.guest) headers['x-coopr-guest'] = init.guest;
    const response = await fetch(`${origin}${path}`, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = (await response.json()) as Record<string, unknown>;
    return { status: response.status, body };
  } catch {
    return { status: 0, body: { error: 'No signal. The score stays on this phone.' } };
  }
}

export async function flushEventOutbox(store: StorageLike = storage()): Promise<void> {
  const session = loadSession(store);
  if (!session) return;
  const next = await flushOutbox(loadOutbox(store), async (entry) => {
    if (entry.eventCode !== session.code) return { status: 0 };
    const result = await eventRequest(`/v1/events/${encodeURIComponent(entry.eventCode)}/score`, {
      method: 'POST',
      guest: session.token,
      body: {
        groupId: entry.groupId,
        playerId: entry.playerId,
        hole: entry.hole,
        strokes: entry.strokes,
        clientSeq: entry.clientSeq,
        idempotencyKey: entry.idempotencyKey,
      },
    });
    const error = typeof result.body.error === 'string' ? result.body.error : undefined;
    return { status: result.status, error };
  });
  saveOutbox(store, next);
}

export async function postMulligan(hole: number): Promise<string | null> {
  const session = loadSession();
  if (!session || session.role !== 'scorer') return 'Only the scorer counts mulligans.';
  const store = storage();
  const seq = nextSeq(store);
  const result = await eventRequest(`/v1/events/${encodeURIComponent(session.code)}/mulligan`, {
    method: 'POST',
    guest: session.token,
    body: { hole, idempotencyKey: `mul-${session.playerId}-${hole}-${seq}` },
  });
  if (result.status === 200) return null;
  return typeof result.body.error === 'string' ? result.body.error : 'The mulligan stayed on this phone.';
}

export async function loadPublicEvent(code: string): Promise<PublicEvent | null> {
  if (code.toUpperCase() === DEMO_CODE) await eventRequest('/v1/events/demo', { method: 'POST', body: {} });
  const result = await eventRequest(`/v1/events/${encodeURIComponent(code.toUpperCase())}`);
  const event = result.body.event;
  if (result.status !== 200 || typeof event !== 'object' || event == null) return null;
  return event as PublicEvent;
}

export function sessionFromJoin(code: string, body: Record<string, unknown>): LiveSession | null {
  if (typeof body.token !== 'string' || typeof body.groupId !== 'string' || typeof body.playerId !== 'string') return null;
  const role: GuestRole = body.role === 'scorer' ? 'scorer' : 'viewer';
  const format: EventFormat = body.format === 'stroke' ? 'stroke' : 'scramble';
  return {
    code: code.toUpperCase(),
    eventName: typeof body.eventName === 'string' ? body.eventName : 'Live event',
    format,
    groupId: body.groupId,
    playerId: body.playerId,
    name: typeof body.name === 'string' ? body.name : 'Guest',
    role,
    token: body.token,
    scorerName: typeof body.scorerName === 'string' ? body.scorerName : 'the scorer',
  };
}
