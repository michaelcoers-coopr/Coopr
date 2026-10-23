import type { CaddiePersonality, LatLon } from '@coopr/domain';
import { bearingDegrees, destinationPoint, distanceYards, ellipseRing, pointInRing } from './geo';
import type { PlaysLikeResult } from './phase2';

/**
 * One standard deviation of measured carry and of measured side.
 * Fewer than five paired shots is not a pattern. A reported average is not a pattern.
 * The screen says so instead of drawing a guess.
 */
export const PATTERN_MIN_SHOTS = 5;
export const PATTERN_INVITE = 'Hit 10 shots with this club to see your pattern';
/** Yards outside the 1-std oval that still count as close to a hazard. A drawing rule, not a measurement. */
export const PATTERN_NEAR_YARDS = 8;
/** Visual lean of the oval toward the safe side. It is not added to the measured dispersion. */
export const PATTERN_LEAN_YARDS = 4;

export interface DispersionShot {
  carryYards: number;
  /** Yards right of the target line. Null when the side was not measured. */
  lateralYards: number | null;
}

export interface DispersionOval {
  sampleSize: number;
  carryStdYards: number;
  lateralStdYards: number;
  /** Positive leans right. The angle of the mean miss off the target line. */
  biasDeg: number;
  meanCarryYards: number;
  meanLateralYards: number;
}

export type PatternSafety = 'clear' | 'near' | 'hazard';

/** Sample standard deviation. Null below two finite numbers. */
export function sampleStdDev(values: readonly number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return null;
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1);
  return Math.sqrt(variance);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Oval from shots that recorded both carry and side.
 * Carry alone is not enough. A missing side stays missing.
 */
export function dispersionOval(shots: readonly DispersionShot[]): DispersionOval | null {
  const paired = shots.filter(
    (shot) => Number.isFinite(shot.carryYards) && shot.carryYards > 0 && shot.lateralYards != null && Number.isFinite(shot.lateralYards),
  );
  if (paired.length < PATTERN_MIN_SHOTS) return null;
  const carries = paired.map((shot) => shot.carryYards);
  const laterals = paired.map((shot) => shot.lateralYards!);
  const carryStd = sampleStdDev(carries);
  const lateralStd = sampleStdDev(laterals);
  if (carryStd == null || lateralStd == null || carryStd <= 0 || lateralStd <= 0) return null;
  const meanCarry = carries.reduce((sum, value) => sum + value, 0) / carries.length;
  const meanLateral = laterals.reduce((sum, value) => sum + value, 0) / laterals.length;
  const biasDeg = roundTenth((Math.atan2(meanLateral, Math.max(meanCarry, 1)) * 180) / Math.PI);
  return {
    sampleSize: paired.length,
    carryStdYards: roundTenth(carryStd),
    lateralStdYards: roundTenth(lateralStd),
    biasDeg,
    meanCarryYards: roundTenth(meanCarry),
    meanLateralYards: roundTenth(meanLateral),
  };
}

/**
 * Seeded illustration for a screenshot or a test. These are not anyone's shots.
 * A screen that draws them has to say Sample.
 */
export const SAMPLE_PATTERN: readonly DispersionShot[] = [
  { carryYards: 150, lateralYards: 4 },
  { carryYards: 152, lateralYards: 6 },
  { carryYards: 148, lateralYards: 2 },
  { carryYards: 155, lateralYards: 8 },
  { carryYards: 149, lateralYards: 3 },
  { carryYards: 153, lateralYards: 5 },
  { carryYards: 151, lateralYards: 7 },
  { carryYards: 147, lateralYards: 1 },
  { carryYards: 156, lateralYards: 9 },
  { carryYards: 150, lateralYards: 4 },
  { carryYards: 154, lateralYards: 6 },
  { carryYards: 152, lateralYards: 5 },
];

function edgesCross(ringA: readonly LatLon[], ringB: readonly LatLon[]): boolean {
  const cross = (a: LatLon, b: LatLon, c: LatLon, d: LatLon) => {
    const orient = (p: LatLon, q: LatLon, r: LatLon) => Math.sign((q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon));
    return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
  };
  for (let i = 0; i < ringA.length - 1; i += 1) {
    for (let j = 0; j < ringB.length - 1; j += 1) {
      if (cross(ringA[i]!, ringA[i + 1]!, ringB[j]!, ringB[j + 1]!)) return true;
    }
  }
  return false;
}

function hits(ellipse: readonly LatLon[], rings: readonly (readonly LatLon[])[]): boolean {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    if (ellipse.some((point) => pointInRing(point, ring))) return true;
    if (ring.some((point) => pointInRing(point, ellipse))) return true;
    if (edgesCross(ellipse, ring)) return true;
  }
  return false;
}

/** Green when the 1-std oval misses every hazard. Amber when only the 8-yard margin touches. Red when the oval itself meets a hazard. */
export function patternSafety(center: LatLon, bearingDeg: number, oval: Pick<DispersionOval, 'carryStdYards' | 'lateralStdYards' | 'biasDeg'>, hazards: readonly (readonly LatLon[])[]): PatternSafety {
  const measured = ellipseRing(center, bearingDeg, oval.carryStdYards, oval.lateralStdYards, 36, oval.biasDeg);
  if (hits(measured, hazards)) return 'hazard';
  const grown = ellipseRing(center, bearingDeg, oval.carryStdYards + PATTERN_NEAR_YARDS, oval.lateralStdYards + PATTERN_NEAR_YARDS, 36, oval.biasDeg);
  if (hits(grown, hazards)) return 'near';
  return 'clear';
}

export function patternColor(safety: PatternSafety): string {
  if (safety === 'hazard') return '#C8102E';
  if (safety === 'near') return '#E6A317';
  return '#8AC926';
}

export type RiskLean = 'long' | 'short' | 'left' | 'right';

export interface RiskCall {
  dead: RiskLean;
  lean: RiskLean;
  line: string;
}

/** The nearest hazard centroid inside `reachYards`. No hazard in reach means no line. */
export function riskCall(landing: LatLon, bearingDeg: number, hazards: readonly (readonly LatLon[])[], reachYards = 40): RiskCall | null {
  if (!Number.isFinite(bearingDeg) || !Number.isFinite(reachYards) || reachYards <= 0) return null;
  let best: { dist: number; along: number; across: number } | null = null;
  for (const ring of hazards) {
    if (ring.length === 0) continue;
    const center = {
      lat: ring.reduce((sum, point) => sum + point.lat, 0) / ring.length,
      lon: ring.reduce((sum, point) => sum + point.lon, 0) / ring.length,
    };
    const dist = distanceYards(landing, center);
    const toward = bearingDegrees(landing, center);
    if (!Number.isFinite(dist) || dist > reachYards || toward == null) continue;
    const delta = ((toward - bearingDeg) * Math.PI) / 180;
    const along = dist * Math.cos(delta);
    const across = dist * Math.sin(delta);
    if (!best || dist < best.dist) best = { dist, along, across };
  }
  if (!best) return null;
  if (Math.abs(best.along) >= Math.abs(best.across)) {
    if (best.along >= 0) return { dead: 'long', lean: 'short', line: "Miss short here, long's dead" };
    return { dead: 'short', lean: 'long', line: "Miss long here, short's dead" };
  }
  if (best.across >= 0) return { dead: 'right', lean: 'left', line: "Miss left here, right's dead" };
  return { dead: 'left', lean: 'right', line: "Miss right here, left's dead" };
}

/** Shifts the drawn oval toward the safe side. The safety test stays on the unshifted oval. */
export function leanedLanding(center: LatLon, bearingDeg: number, lean: RiskLean | null): LatLon {
  if (!lean) return center;
  if (lean === 'long') return destinationPoint(center, bearingDeg, PATTERN_LEAN_YARDS);
  if (lean === 'short') return destinationPoint(center, bearingDeg + 180, PATTERN_LEAN_YARDS);
  if (lean === 'right') return destinationPoint(center, bearingDeg + 90, PATTERN_LEAN_YARDS);
  return destinationPoint(center, bearingDeg - 90, PATTERN_LEAN_YARDS);
}

/**
 * Not a probability of the next shot.
 *
 * sampleScore = clamp(sampleSize / 30, 0, 1). Thirty shots is the existing solid floor.
 * spreadScore = clamp(1 - (iqr / |stock|) / 0.45, 0, 1). 0.45 is the existing limited cutoff.
 * conditionScore = known conditions / 3. Wind, elevation, and temperature each count once.
 *
 * percent = round(100 * (0.5 * sampleScore + 0.3 * spreadScore + 0.2 * conditionScore)).
 *
 * Null when there is no measured dispersion. A reported average does not get a percent.
 */
export const CONFIDENCE_SOLID_SHOTS = 30;
export const CONFIDENCE_SPREAD_LIMIT = 0.45;
export const CONFIDENCE_LOW = 50;

export function confidencePercent(input: {
  sampleSize: number;
  iqr: number;
  stockYards: number;
  dispersionKnown: boolean;
  windKnown: boolean;
  elevationKnown: boolean;
  temperatureKnown: boolean;
}): number | null {
  if (!input.dispersionKnown) return null;
  if (!Number.isFinite(input.sampleSize) || input.sampleSize < 1) return null;
  if (!Number.isFinite(input.iqr) || input.iqr < 0) return null;
  if (!Number.isFinite(input.stockYards) || input.stockYards === 0) return null;
  const sampleScore = Math.max(0, Math.min(1, input.sampleSize / CONFIDENCE_SOLID_SHOTS));
  const relative = input.iqr / Math.abs(input.stockYards);
  const spreadScore = Math.max(0, Math.min(1, 1 - relative / CONFIDENCE_SPREAD_LIMIT));
  const known = Number(input.windKnown) + Number(input.elevationKnown) + Number(input.temperatureKnown);
  const conditionScore = known / 3;
  return Math.round(100 * (0.5 * sampleScore + 0.3 * spreadScore + 0.2 * conditionScore));
}

export function confidenceLabel(club: string, percent: number | null): string {
  if (percent == null) return club;
  return `${club} · ${percent}%`;
}

/** A missing component is `?`. Nothing is written as a guessed sign. */
export function componentChip(name: 'Wind' | 'Elev' | 'Temp', yards: number | null): string {
  if (yards == null || !Number.isFinite(yards)) return `${name} ?`;
  const rounded = roundTenth(yards);
  const body = rounded > 0 ? `+${rounded}` : `${rounded}`;
  return `${name} ${body}`;
}

export function playsLikeChips(result: PlaysLikeResult): { wind: string; elevation: string; temperature: string } {
  return {
    wind: componentChip('Wind', result.wind?.yards ?? null),
    elevation: componentChip('Elev', result.elevation?.yards ?? null),
    temperature: componentChip('Temp', result.temperature?.yards ?? null),
  };
}

function clubNick(label: string): string {
  const iron = label.match(/(\d+)\s*-?\s*iron/i);
  if (iron) return iron[1]!;
  return label.split('·')[0]?.trim() || label;
}

/**
 * One sentence from the factors that are actually known.
 * Wind is mentioned only when its plays-like term exists. A thin sample says so.
 */
export function caddieLine(input: {
  personality: CaddiePersonality;
  clubLabel: string | null;
  /** Plays-like wind term. Positive is a headwind. Null when the wind was not read. */
  windYards: number | null;
  stockYards: number | null;
  targetYards: number | null;
  lowConfidence: boolean;
}): string | null {
  if (!input.clubLabel) return null;
  const nick = clubNick(input.clubLabel);
  const help = input.windYards != null && input.windYards <= -1;
  const hurt = input.windYards != null && input.windYards >= 1;
  let gap: 'plenty' | 'short' | 'number' | null = null;
  if (input.stockYards != null && input.targetYards != null && Number.isFinite(input.stockYards) && Number.isFinite(input.targetYards)) {
    const delta = input.stockYards - input.targetYards;
    gap = delta >= 5 ? 'plenty' : delta <= -5 ? 'short' : 'number';
  }
  if (!help && !hurt && gap == null && !input.lowConfidence) return null;
  const thin = input.lowConfidence;
  if (input.personality === 'direct_analytical') {
    const bits = [
      help ? 'Tailwind.' : hurt ? 'Headwind.' : null,
      gap === 'plenty' ? `${input.clubLabel} covers the number.` : gap === 'short' ? `${input.clubLabel} is short of the number.` : gap === 'number' ? `${input.clubLabel} is on the number.` : null,
      thin ? 'The sample is thin.' : null,
    ].filter(Boolean);
    return bits.join(' ');
  }
  if (input.personality === 'quiet_minimalist') {
    const bits = [help ? 'Helping wind.' : hurt ? 'Into the wind.' : null, gap === 'plenty' ? `${nick} is enough.` : gap === 'short' ? `${nick} may come up short.` : null, thin ? 'Thin sample.' : null].filter(Boolean);
    return bits.join(' ');
  }
  if (input.personality === 'encouraging_coach') {
    if (help && gap === 'plenty') return thin ? `Wind's with you. ${nick} is enough. The sample is still thin.` : `Wind's with you. ${nick} is enough. Trust it.`;
    if (hurt && gap === 'short') return `Into the wind, and ${nick} may come up short. Take enough club.`;
    if (thin) return 'The sample is thin. Treat the number softly.';
    if (help) return `Wind's with you. Commit to ${nick}.`;
    if (hurt) return `Into the wind. Take enough club.`;
    if (gap === 'plenty') return `${nick} is enough. Trust it.`;
    if (gap === 'short') return `${nick} may come up short.`;
    return `${nick} is on the number.`;
  }
  if (input.personality === 'classic_tour') {
    if (help && gap === 'plenty') return `The wind helps. ${nick} is the play.`;
    if (hurt) return `The wind is in your face. Respect it.`;
    if (thin) return 'The sample is thin. Play the number you have.';
    if (gap === 'plenty') return `${nick} is plenty.`;
    if (gap === 'short') return `${nick} is short of the number.`;
    return help ? `The wind helps. ${nick} is the play.` : `${nick} is the play.`;
  }
  if (help && gap === 'plenty') return thin ? `Wind's helping, ${nick}'s plenty. The sample is thin.` : `Wind's helping, ${nick}'s plenty. Don't be a hero.`;
  if (hurt && gap === 'short') return `Wind's in your face, and ${nick} may not get there.`;
  if (thin && !help && !hurt && gap == null) return 'The sample is thin. Treat the number softly.';
  if (help) return `Wind's helping. Don't be a hero.`;
  if (hurt) return `Wind's in your face. Take enough club.`;
  if (gap === 'plenty') return `${nick}'s plenty. Don't be a hero.`;
  if (gap === 'short') return `${nick} may not get there.`;
  if (thin) return 'The sample is thin. Treat the number softly.';
  return `${nick} is on the number.`;
}

export interface ThruHole {
  par: number | null;
  strokes: number | null;
  kept: boolean;
}

/** Kept scores only. An empty round has pips and no to-par number. */
export function thruScore(holes: readonly ThruHole[]): { label: string | null; pips: ('under' | 'even' | 'over' | 'open')[] } {
  const pips = Array.from({ length: 18 }, (_, index) => {
    const hole = holes[index];
    if (!hole?.kept || hole.strokes == null || hole.par == null) return 'open' as const;
    const diff = hole.strokes - hole.par;
    if (diff < 0) return 'under' as const;
    if (diff > 0) return 'over' as const;
    return 'even' as const;
  });
  const kept = holes.filter((hole) => hole.kept && hole.strokes != null && hole.par != null);
  if (kept.length === 0) return { label: null, pips };
  const diff = kept.reduce((sum, hole) => sum + (hole.strokes! - hole.par!), 0);
  const versus = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff);
  return { label: `${versus} thru ${kept.length}`, pips };
}

export function roundProgress(roundsKept: number): { filled: number; total: 3; handicap: string; gross: string } {
  const filled = Number.isFinite(roundsKept) ? Math.max(0, Math.min(3, Math.floor(roundsKept))) : 0;
  return {
    filled,
    total: 3,
    handicap: 'Play 3 rounds to see your handicap trend',
    gross: 'Play 3 rounds to see your gross',
  };
}

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Moves a later label off an earlier one. The yardage itself is unchanged. */
export function nudgeLabels<T extends LabelBox>(items: readonly T[], gap = 8, width?: number): T[] {
  const placed = items.map((item) => ({ ...item }));
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const next = placed[i]!;
      const prev = placed[j]!;
      const overlapX = Math.min(next.x + next.w, prev.x + prev.w) - Math.max(next.x, prev.x);
      const overlapY = Math.min(next.y + next.h, prev.y + prev.h) - Math.max(next.y, prev.y);
      if (overlapX > 0 && overlapY > 0) {
        const shifted = next.x + overlapX + gap;
        if (width == null || shifted + next.w <= width) next.x = shifted;
        else next.y -= next.h + gap;
      }
    }
  }
  return placed;
}

/** A curve between two real points. The bow is a drawing of the aim, not a measured flight and not a yardage. */
export function flightArc(start: LatLon, end: LatLon): LatLon[] {
  const dist = distanceYards(start, end);
  if (!Number.isFinite(dist) || dist <= 1) return [];
  const bearing = bearingDegrees(start, end);
  if (bearing == null) return [];
  const bow = Math.min(18, dist * 0.08);
  const steps = 12;
  const points: LatLon[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const along = dist * t;
    const across = Math.sin(Math.PI * t) * bow;
    points.push(destinationPoint(destinationPoint(start, bearing, along), bearing + 90, across));
  }
  return points;
}

export function feelFor(event: 'club' | 'mark' | 'hole' | 'score'): 'pulse' | 'celebrate' | 'tick' | 'hole' {
  if (event === 'club') return 'pulse';
  if (event === 'mark') return 'celebrate';
  if (event === 'hole') return 'hole';
  return 'tick';
}
