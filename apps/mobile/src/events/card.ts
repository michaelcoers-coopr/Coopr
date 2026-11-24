import { webStore } from '../web-storage';
import { loadSession, SESSION_KEY, type StorageLike } from './client';

export const CARD_KEY = 'coopr.event.card.v1';

export interface EventCard {
  code: string;
  courseName: string;
  pars: number[];
}

interface StoredSession {
  code?: string;
  pars?: number[];
  courseName?: string;
}

let memoryCard: EventCard | null = null;

export function validPars(pars: readonly number[] | null | undefined): pars is number[] {
  return Array.isArray(pars) && pars.length === 18 && pars.every((par) => Number.isInteger(par) && par >= 3 && par <= 6);
}

function readJson<T>(store: StorageLike | null, key: string): T | null {
  const raw = store?.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function storeOf(store?: StorageLike | null): StorageLike | null {
  return store === undefined ? webStore() : store;
}

/** Keep the event card on the phone. A later miss does not erase it. */
export function rememberEventCard(card: EventCard, store?: StorageLike | null) {
  if (!validPars(card.pars)) return;
  const saved = { code: card.code.toUpperCase(), courseName: card.courseName, pars: [...card.pars] };
  memoryCard = saved;
  storeOf(store)?.setItem(CARD_KEY, JSON.stringify(saved));
}

export function eventRoundCard(store?: StorageLike | null): EventCard | null {
  const disk = storeOf(store);
  const fromDisk = readJson<StoredSession>(disk, SESSION_KEY);
  const session = store === undefined ? loadSession() : fromDisk;
  const code = session?.code?.toUpperCase();
  if (!code) return null;
  if (validPars(session?.pars)) return { code, courseName: session.courseName ?? '', pars: session.pars };
  if (memoryCard?.code === code && validPars(memoryCard.pars)) return memoryCard;
  const saved = readJson<EventCard>(disk, CARD_KEY);
  if (saved?.code?.toUpperCase() === code && validPars(saved.pars)) return { code, courseName: saved.courseName, pars: saved.pars };
  return null;
}

export function eventRoundPars(store?: StorageLike | null): readonly number[] | null {
  return eventRoundCard(store)?.pars ?? null;
}

/** The par the phone shows and saves. An event card wins over the phone's home course. */
export function parForHole(hole: number, eventPars: readonly number[] | null, coursePar: number | null): number | null {
  const event = eventPars?.[hole - 1];
  if (typeof event === 'number') return event;
  return coursePar;
}

export function eventPar(hole: number, store?: StorageLike | null): number | null {
  return parForHole(hole, eventRoundPars(store), null);
}

/** Hole numbers whose par is not the event card. Empty means the round is on the event course. */
export function foreignPars(eventPars: readonly number[], used: readonly (number | null | undefined)[]): number[] {
  const holes: number[] = [];
  for (let index = 0; index < eventPars.length; index += 1) {
    if (used[index] !== eventPars[index]) holes.push(index + 1);
  }
  return holes;
}
