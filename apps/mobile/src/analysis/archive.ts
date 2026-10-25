import type { FixId } from '@coopr/analysis';
import type { StoredRound } from './from-round';

export const ANALYSIS_ROUNDS_KEY = 'coopr.analysis.rounds.v1';
const LAST_FIX_KEY = 'coopr.analysis.lastFix.v1';

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
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
    });
  }
  return { id: row.id, playedOn: row.playedOn, courseName: row.courseName, holes };
}

export function readArchive(): StoredRound[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(ANALYSIS_ROUNDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const round = roundOf(item);
      return round ? [round] : [];
    });
  } catch {
    return [];
  }
}

export function writeArchive(rounds: readonly StoredRound[]): void {
  const store = storage();
  if (!store) return;
  store.setItem(ANALYSIS_ROUNDS_KEY, JSON.stringify(rounds));
}

/** Keeps the newest 40 finished rounds. The open round is not written here. */
export function archiveRound(round: StoredRound): void {
  const prior = readArchive().filter((item) => item.id !== round.id && item.id !== 'open');
  writeArchive([...prior, { ...round, id: round.id === 'open' ? `round-${Date.now()}` : round.id }].slice(-40));
}

export function readLastFix(): { id: FixId; strokesPer18: number } | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; strokesPer18?: number };
    if (typeof parsed.id !== 'string' || typeof parsed.strokesPer18 !== 'number') return null;
    return { id: parsed.id as FixId, strokesPer18: parsed.strokesPer18 };
  } catch {
    return null;
  }
}

export function writeLastFix(fix: { id: FixId; strokesPer18: number }): void {
  const store = storage();
  if (!store) return;
  store.setItem(LAST_FIX_KEY, JSON.stringify(fix));
}
