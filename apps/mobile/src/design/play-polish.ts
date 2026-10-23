import type { DistanceUnit } from '@coopr/engine';
import { unitLabel } from '@coopr/engine';

export interface ClubFigure {
  label: 'Plays like' | 'Shot';
  yards: number;
}

/**
 * The card number is the plays-like when that adjustment exists.
 * A phone with no position can still show the shot. A live GPS number stays on the map.
 */
export function clubFigure(playsLikeYards: number | null, shotYards: number | null, gpsLive: boolean): ClubFigure | null {
  if (playsLikeYards != null && Number.isFinite(playsLikeYards)) return { label: 'Plays like', yards: playsLikeYards };
  if (!gpsLive && shotYards != null && Number.isFinite(shotYards)) return { label: 'Shot', yards: shotYards };
  return null;
}

function countWord(unit: DistanceUnit, count: number): string {
  const plural = unitLabel(unit);
  if (count === 1 && plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}

/**
 * One plain line for the open sheet. A lay-up sentence from the engine wins.
 * A missing stock or target stays blank. The line does not say "plays-like".
 */
export function clubWhy(input: {
  layupReason: string | null;
  stockYards: number | null;
  targetYards: number | null;
  playsLike: boolean;
  unit: DistanceUnit;
}): string | null {
  const layup = input.layupReason?.replace(/\s+/g, ' ').trim();
  if (layup) return layup;
  if (input.stockYards == null || input.targetYards == null) return null;
  if (!Number.isFinite(input.stockYards) || !Number.isFinite(input.targetYards)) return null;
  const stock = Math.round(input.stockYards);
  const target = Math.round(input.targetYards);
  const gap = Math.abs(stock - target);
  if (gap === 0) return 'Dead on your number.';
  const side = stock > target ? 'long' : 'short';
  return `${gap} ${countWord(input.unit, gap)} ${side}.`;
}

export interface ScoreGlance {
  /** A glow. Bogey and an unconfirmed par stay still. */
  motion: 'birdie' | 'par' | null;
  name: 'Eagle' | 'Birdie' | 'Par' | null;
  versus: string | null;
}

/** Names only the scores that are exactly par, birdie, or eagle. Other diffs stay a number. */
export function scoreGlance(strokes: number | null, par: number | null, confirmed: boolean): ScoreGlance {
  if (!confirmed || strokes == null || par == null || !Number.isFinite(strokes) || !Number.isFinite(par)) {
    return { motion: null, name: null, versus: null };
  }
  const diff = Math.round(strokes) - Math.round(par);
  const versus = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  if (diff === 0) return { motion: 'par', name: 'Par', versus };
  if (diff === -1) return { motion: 'birdie', name: 'Birdie', versus };
  if (diff === -2) return { motion: 'birdie', name: 'Eagle', versus };
  if (diff < -2) return { motion: 'birdie', name: null, versus };
  return { motion: null, name: null, versus };
}

/** Crest red for birdie or better. White for par. Nothing for a bogey or an unconfirmed number. */
export function scoreGlow(motion: 'birdie' | 'par' | null): '#C8102E' | '#FFFFFF' | null {
  if (motion === 'birdie') return '#C8102E';
  if (motion === 'par') return '#FFFFFF';
  return null;
}

/** Which way the map should enter when the hole changes. */
export function holeShift(from: number, to: number): 'forward' | 'back' | 'none' {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return 'none';
  return to > from ? 'forward' : 'back';
}

/** Map travel and the smaller sheet travel. The sheet lags, so the hole feels deeper than the card. */
export function holeEnter(shift: 'forward' | 'back' | 'none'): { map: number; sheet: number } {
  if (shift === 'forward') return { map: 64, sheet: 22 };
  if (shift === 'back') return { map: -64, sheet: -22 };
  return { map: 0, sheet: 0 };
}

/**
 * A drag on the score chip.
 * Up adds a stroke. Down takes one off. A short press is a tap that keeps the shown number.
 * A sideways drag belongs to the hole change, not the score.
 */
export function scoreDrag(dy: number, dx: number): 'tap' | 'up' | 'down' | null {
  if (!Number.isFinite(dy) || !Number.isFinite(dx)) return null;
  if (Math.abs(dy) < 16 && Math.abs(dx) < 16) return 'tap';
  if (Math.abs(dy) < 28 || Math.abs(dy) <= Math.abs(dx)) return null;
  return dy < 0 ? 'up' : 'down';
}

/** The number a score gesture writes. Strokes stop at 1. Putts stop at 0. */
export function scoreCommit(shown: number, move: 'tap' | 'up' | 'down', floor: number): number {
  const base = Math.round(shown);
  if (!Number.isFinite(base)) return floor;
  if (move === 'tap') return Math.max(floor, base);
  if (move === 'up') return base + 1;
  return Math.max(floor, base - 1);
}

/** Swipe up opens the club sheet. Swipe down closes it. A short drag stays where it was. */
export function sheetSnap(open: boolean, dy: number, vy: number): boolean {
  if (!Number.isFinite(dy) || !Number.isFinite(vy)) return open;
  if (vy < -0.65 || dy < -48) return true;
  if (vy > 0.65 || dy > 48) return false;
  return open;
}
