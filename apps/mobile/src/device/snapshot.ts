import type { FairwayResult, FixId } from '@coopr/analysis';
import { parseFoursomeSave, type FoursomeSave } from '@coopr/games';
import type { StoredRound } from '../analysis/from-round';
import { sanitizeClub, sanitizeFit } from '../bag-scan/logic';
import { EMPTY_FIT, type ScanClub, type StoredFit } from '../bag-scan/types';
import { parseVoice, type CaddieVoice } from '../design/caddie-voice';

/** The caddie reads this shape. The saved bag stays a scan club. */
export interface PlayingClubView {
  id: string;
  label: string;
  slot: 'in_play' | 'testing';
  note: string | null;
}

export interface DeviceSettings {
  voice: CaddieVoice;
  handsFree: boolean;
  callouts: boolean;
  onboarded: boolean;
  displayName: string;
}

export interface DeviceSnapshot {
  version: 1;
  bag: ScanClub[];
  fit: StoredFit;
  settings: DeviceSettings;
  rounds: StoredRound[];
  lastFix: { id: FixId; strokesPer18: number } | null;
  foursome: FoursomeSave | null;
  foursomeHistory: FoursomeSave[];
}

export const MAX_ROUNDS = 40;

const FAIRWAYS: readonly FairwayResult[] = ['hit', 'left', 'right', 'short', 'long'];

export function emptySettings(): DeviceSettings {
  return { voice: 'chirpy', handsFree: false, callouts: false, onboarded: false, displayName: '' };
}

export function emptySnapshot(): DeviceSnapshot {
  return { version: 1, bag: [], fit: { ...EMPTY_FIT }, settings: emptySettings(), rounds: [], lastFix: null, foursome: null, foursomeHistory: [] };
}

function fairwayOf(value: unknown): FairwayResult | null {
  return typeof value === 'string' && (FAIRWAYS as readonly string[]).includes(value) ? (value as FairwayResult) : null;
}

function roundOf(value: unknown): StoredRound | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.playedOn !== 'string' || typeof row.courseName !== 'string' || !Array.isArray(row.holes)) return null;
  const holes: StoredRound['holes'] = [];
  for (const item of row.holes) {
    if (!item || typeof item !== 'object') continue;
    const hole = item as Record<string, unknown>;
    if (typeof hole.number !== 'number') continue;
    holes.push({
      number: hole.number,
      par: typeof hole.par === 'number' ? hole.par : null,
      yards: typeof hole.yards === 'number' ? hole.yards : null,
      strokeIndex: typeof hole.strokeIndex === 'number' ? hole.strokeIndex : null,
      strokes: typeof hole.strokes === 'number' ? hole.strokes : null,
      putts: typeof hole.putts === 'number' ? hole.putts : null,
      penalties: typeof hole.penalties === 'number' ? hole.penalties : null,
      fairway: fairwayOf(hole.fairway),
      gir: typeof hole.gir === 'boolean' ? hole.gir : null,
    });
  }
  return { id: row.id, playedOn: row.playedOn, courseName: row.courseName, holes };
}

function foursomesOf(value: unknown): FoursomeSave[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const save = parseFoursomeSave(item);
    return save ? [save] : [];
  });
}

function roundsOf(value: unknown): StoredRound[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const round = roundOf(item);
    return round && round.id !== 'open' ? [round] : [];
  });
}

function fixOf(value: unknown): DeviceSnapshot['lastFix'] {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { id?: unknown; strokesPer18?: unknown };
  if (typeof raw.id !== 'string' || typeof raw.strokesPer18 !== 'number') return null;
  return { id: raw.id as FixId, strokesPer18: raw.strokesPer18 };
}

function settingsOf(value: unknown): DeviceSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    voice: parseVoice(raw.voice),
    handsFree: raw.handsFree === true,
    callouts: raw.callouts === true,
    onboarded: raw.onboarded === true,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
  };
}

function bagOf(value: unknown): ScanClub[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const club = sanitizeClub(item);
    return club ? [club] : [];
  });
}

export function parseSnapshot(raw: string | null): DeviceSnapshot {
  if (!raw) return emptySnapshot();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptySnapshot();
    const row = parsed as Record<string, unknown>;
    return {
      version: 1,
      bag: bagOf(row.bag),
      fit: sanitizeFit(row.fit),
      settings: settingsOf(row.settings),
      rounds: roundsOf(row.rounds).slice(-MAX_ROUNDS),
      lastFix: fixOf(row.lastFix),
      foursome: parseFoursomeSave(row.foursome),
      foursomeHistory: foursomesOf(row.foursomeHistory).slice(-MAX_ROUNDS),
    };
  } catch {
    return emptySnapshot();
  }
}

export function serializeSnapshot(snapshot: DeviceSnapshot): string {
  return JSON.stringify({ ...snapshot, version: 1 });
}

/**
 * A finished round is appended. An id that is already saved is left as it was.
 * The open round is renamed so the in-progress row can be cleared afterwards.
 */
/** A finished foursome is appended. An id that is already saved is left as it was. */
export function appendFoursome(snapshot: DeviceSnapshot, save: FoursomeSave): DeviceSnapshot {
  if (snapshot.foursomeHistory.some((item) => item.id === save.id)) return snapshot;
  const finished = { ...save, finishedOn: save.finishedOn ?? new Date().toISOString() };
  return { ...snapshot, foursomeHistory: [...snapshot.foursomeHistory, finished].slice(-MAX_ROUNDS) };
}

/**
 * History is written first. The open game is cleared only when it is the round that just finished.
 * The owner's gross is appended to round history and is not overwritten if that id is already there.
 */
export function finishFoursome(snapshot: DeviceSnapshot, finished: FoursomeSave, owner: StoredRound | null): DeviceSnapshot {
  if (snapshot.foursome?.id !== finished.id) return snapshot;
  let next = appendFoursome(snapshot, finished);
  if (owner) next = appendCompletedRound(next, owner);
  if (next.foursome?.id !== finished.id) return next;
  return { ...next, foursome: null };
}

export function appendCompletedRound(snapshot: DeviceSnapshot, round: StoredRound): DeviceSnapshot {
  const id = round.id === 'open' ? `round-${Date.now()}` : round.id;
  if (snapshot.rounds.some((item) => item.id === id)) return snapshot;
  const prior = snapshot.rounds.filter((item) => item.id !== 'open');
  return { ...snapshot, rounds: [...prior, { ...round, id }].slice(-MAX_ROUNDS) };
}

export function clubLabel(club: ScanClub): string {
  const brandModel = [club.brand, club.model].filter(Boolean).join(' ');
  if (brandModel) return brandModel;
  const typed = [club.type, club.clubNumber].filter(Boolean).join(' ');
  if (typed) return typed;
  return club.slot;
}

export function playingFromBag(bag: readonly ScanClub[]): PlayingClubView[] {
  return bag.map((club) => ({
    id: club.id,
    label: clubLabel(club),
    slot: club.inPlay ? 'in_play' : 'testing',
    note: null,
  }));
}

function thinClub(club: PlayingClubView): ScanClub {
  return {
    id: club.id,
    slot: club.label,
    inPlay: club.slot === 'in_play',
    brand: null,
    model: club.label,
    type: null,
    loft: null,
    flex: null,
    ironBuild: null,
    photoUri: null,
    fitAck: null,
    fitAckOn: null,
    clubNumber: null,
    identifiedBy: 'typed',
  };
}

/** Scan clubs keep loft and photos. A club typed in the caddie becomes a thin scan club. */
export function mergePlayingIntoBag(bag: readonly ScanClub[], playing: readonly PlayingClubView[]): ScanClub[] {
  const byId = new Map(bag.map((club) => [club.id, club]));
  return playing.map((club) => {
    const existing = byId.get(club.id);
    if (existing) return { ...existing, inPlay: club.slot === 'in_play' };
    return thinClub(club);
  });
}
