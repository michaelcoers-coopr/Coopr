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

/**
 * The flag is drawn above the green point, and the tee mark hangs below the line.
 * Those ornaments have to clear the yardage pill and the closed sheet.
 */
const PIN_CLEAR = 40;
const TEE_CLEAR = 20;
const SHEET_GAP = 8;

/**
 * Room the map keeps for the yardage panel.
 * The panel's measured height is not an input, so opening the breakdown does not move the hole.
 */
export const MAP_PANEL_CLEAR = 214;

/** Closed club card for a club with no measured shots: handle, name, invitation, strip. */
export const NO_SHOTS_SHEET = 160;

export function mapHudInset(safeTop: number): number {
  const safe = Number.isFinite(safeTop) ? Math.max(0, safeTop) : 0;
  return safe + MAP_PANEL_CLEAR;
}

/**
 * The sample oval's caption. A club with no shots has no oval and no caption.
 * A thin sample stays on the caddie line, not this one.
 */
export function patternCaption(input: {
  onGreen: boolean;
  noShots: boolean;
  lowConfidence: boolean;
  sample: boolean;
  oval: { carryStdYards: number; lateralStdYards: number } | null;
  invite: string;
}): string | null {
  if (input.onGreen || input.noShots) return null;
  if (input.oval) return `${input.sample ? 'Sample pattern · ' : ''}±${input.oval.carryStdYards} × ±${input.oval.lateralStdYards} yd`;
  if (input.lowConfidence) return null;
  return input.invite;
}

/** Sheet height while the club card is closed. A no-shot club hugs its contents. A called shot keeps the full card. */
export function closedPlaySheet(input: { noTarget: boolean; noShots: boolean; cardStack: number; risk: boolean; closed: number }): number {
  const closed = Number.isFinite(input.closed) ? Math.max(0, input.closed) : 0;
  if (input.noShots) return Math.min(closed, NO_SHOTS_SHEET + (input.risk ? 28 : 0));
  if (input.noTarget) {
    const stack = Number.isFinite(input.cardStack) ? input.cardStack : 148;
    return Math.min(closed, Math.max(148, stack));
  }
  return closed;
}

export function holeFrame(input: { hudHeight: number; dockHeight: number; sheetClosed: number }): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const hud = Number.isFinite(input.hudHeight) ? Math.max(0, input.hudHeight) : 0;
  const dock = Number.isFinite(input.dockHeight) ? Math.max(0, input.dockHeight) : 0;
  const sheet = Number.isFinite(input.sheetClosed) ? Math.max(0, input.sheetClosed) : 0;
  return {
    top: hud + PIN_CLEAR,
    right: 18,
    bottom: dock + SHEET_GAP + sheet + TEE_CLEAR,
    left: 18,
  };
}

/** Map travel and the smaller sheet travel. The sheet lags, so the hole feels deeper than the card. */
export function holeEnter(shift: 'forward' | 'back' | 'none'): { map: number; sheet: number } {
  if (shift === 'forward') return { map: 108, sheet: 20 };
  if (shift === 'back') return { map: -108, sheet: -20 };
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
