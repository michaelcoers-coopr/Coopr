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
/**
 * The HUD, the card, and the reply share this whole-yard shot.
 * Plays-like when wind, elevation, and temperature are known. Otherwise the raw center.
 */
export function shotReadout(playsLikeYards: number | null, rawYards: number | null): number | null {
  const value = playsLikeYards != null && Number.isFinite(playsLikeYards) ? playsLikeYards : rawYards;
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/** No position means no shot adjustment. A scrubbed club is not a stand-in distance. */
export function hudChips(
  hasFix: boolean,
  chips: { wind: string; elevation: string; temperature: string } | null,
): { wind: string; elevation: string; temperature: string } {
  if (!hasFix || chips == null) return { wind: 'Wind ?', elevation: 'Elev ?', temperature: 'Temp ?' };
  return chips;
}

/** The sample oval needs a real GPS position and a measured pattern. */
export function samplePatternVisible(input: { sampleOn: boolean; hasFix: boolean; measured: boolean }): boolean {
  return input.sampleOn && input.hasFix && input.measured;
}

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

export type ScoreStamp = 'BIRDIE' | 'EAGLE' | 'ALBATROSS';

/** Birdie or better celebrates. Double or worse gets the consolation. Bogey stays quiet. */
export function scoreMoment(strokes: number | null, par: number | null): 'celebrate' | 'consolation' | null {
  if (strokes == null || par == null || !Number.isFinite(strokes) || !Number.isFinite(par)) return null;
  const diff = Math.round(strokes) - Math.round(par);
  if (diff <= -1) return 'celebrate';
  if (diff >= 2) return 'consolation';
  return null;
}

/** The stamp uses the real score against par. A bogey has no stamp. */
export function scoreStamp(strokes: number | null, par: number | null): ScoreStamp | null {
  if (scoreMoment(strokes, par) !== 'celebrate' || strokes == null || par == null) return null;
  const diff = Math.round(strokes) - Math.round(par);
  if (diff <= -3) return 'ALBATROSS';
  if (diff === -2) return 'EAGLE';
  return 'BIRDIE';
}

export const CONSOLATION = 'Shake it off. Next tee.';

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
 * The score bar floats on the map, so it does not stack under the sheet.
 */
const PIN_CLEAR = 36;
const TEE_CLEAR = 16;
/** Room so the tee mark sits above the floating Score / Mark / Ask chips. */
const SCORE_CLEAR = 68;

/**
 * Room the map keeps for the compact yardage HUD.
 * The panel's measured height is not an input, so opening the breakdown does not move the hole.
 */
export const MAP_PANEL_CLEAR = 128;

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
  /** The caddie already said the sample is thin. The invite would repeat it. */
  thinLine?: boolean;
}): string | null {
  if (input.onGreen || input.noShots) return null;
  if (input.oval) return `${input.sample ? 'Sample pattern · ' : ''}±${input.oval.carryStdYards} × ±${input.oval.lateralStdYards} yd`;
  if (input.lowConfidence || input.thinLine) return null;
  return input.invite;
}

/** Closed club card. Club, ring, one caddie line, and a strip peek. The rest waits for the swipe. */
export const CLOSED_CARD = 116;

/** Invitation on a club card that has no measured shots. */
export const SHOT_LOG_TIP = 'Log a shot after each swing, or upload a TrackMan photo';

/** Spoken name for a green dot. The yardage is the measured ground distance, or omitted. */
export function greenMarkLabel(place: 'Front' | 'Center' | 'Back', readout: string | null, unit: DistanceUnit): string {
  if (!readout || readout === '—') return place;
  return `${place}, ${readout} ${unitLabel(unit)}`;
}

/** A short card sits as one block in the fixed sheet. A full card stays at the top so nothing is clipped. */
export function cardGravity(noShots: boolean): 'center' | 'flex-start' {
  return noShots ? 'center' : 'flex-start';
}

/** Collapsed club sheet. The height does not follow the club, so scrubbing does not rescale the map. */
export function closedPlaySheet(closed: number): number {
  return Number.isFinite(closed) ? Math.max(0, closed) : 0;
}

export function holeFrame(input: { hudHeight: number; dockHeight: number; sheetClosed: number }): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const hud = Number.isFinite(input.hudHeight) ? Math.max(0, input.hudHeight) : 0;
  const sheet = Number.isFinite(input.sheetClosed) ? Math.max(0, input.sheetClosed) : 0;
  // The score bar floats over the map, so its measured height does not shrink the hole.
  void input.dockHeight;
  return {
    top: hud + PIN_CLEAR,
    right: 16,
    bottom: sheet + SCORE_CLEAR + TEE_CLEAR,
    left: 16,
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
