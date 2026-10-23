import type { DistanceUnit } from '@coopr/engine';
import { unitLabel } from '@coopr/engine';
import { touch } from '@coopr/tokens';

/** One stepper group: minus, figure, plus. Wide enough for a 56pt target on a 375pt phone. */
export const SCORE_GROUP_MIN = touch + 8 + 36 + 8 + touch;

/** Two score groups sit on one line only when both fit. Otherwise they wrap, fully visible. */
export function scorePairFits(innerWidth: number): boolean {
  if (!Number.isFinite(innerWidth)) return false;
  return innerWidth >= SCORE_GROUP_MIN * 2 + 8;
}

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

/** One line under the club. A missing stock or target stays blank. */
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
  const basis = input.playsLike ? 'plays-like' : 'shot';
  if (gap === 0) return `Even with the ${basis}.`;
  const side = stock > target ? 'long' : 'short';
  return `${gap} ${countWord(input.unit, gap)} ${side} of the ${basis}.`;
}

export interface ScoreGlance {
  /** A scale pulse. Bogey and an unconfirmed par stay still. */
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

/** Which way the map should enter when the hole changes. */
export function holeShift(from: number, to: number): 'forward' | 'back' | 'none' {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return 'none';
  return to > from ? 'forward' : 'back';
}
