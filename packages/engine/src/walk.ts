import type { LatLon } from '@coopr/domain';
import { bearingDegrees, closestPointOnSegment, destinationPoint, distanceToRingYards, distanceYards, greenYardsFrom, pointInOrOnRing, ringCentroid } from './geo';

/** A finish the polygons can support. Anything else stays null. */
export type FinishLie = 'fairway' | 'rough' | 'left' | 'right' | 'green' | 'hazard';

export interface WalkPolygons {
  fairways: readonly (readonly LatLon[])[];
  greens: readonly (readonly LatLon[])[];
  bunkers: readonly (readonly LatLon[])[];
  hazards: readonly (readonly LatLon[])[];
  /** Tee-to-green line. Left and right are measured from it. */
  line: readonly LatLon[];
}

/** Standing inside this of the next tee, and closer to it than to the green, advances the hole. */
export const NEXT_TEE_YARDS = 40;

/** Default putts until the player confirms or nudges the stepper. Not added to the gross. */
export const DEFAULT_PUTTS = 2;

/** A hole this far over par can take one optional note. A bogey does not ask. */
export const BLOWUP_OVER = 3;

export type GpsPreset = 'tee' | 'approach' | 'green';

function insideAny(point: LatLon, rings: readonly (readonly LatLon[])[]): boolean {
  return rings.some((ring) => ring.length >= 3 && pointInOrOnRing(point, ring));
}

/**
 * Signed yards off the hole line. Positive is the player's right, facing the hole.
 * Null when the line cannot define a side.
 */
export function lateralYards(point: LatLon, line: readonly LatLon[]): number | null {
  if (line.length < 2) return null;
  let best = Number.POSITIVE_INFINITY;
  let signed = 0;
  let found = false;
  for (let i = 0; i < line.length - 1; i += 1) {
    const start = line[i]!;
    const end = line[i + 1]!;
    const nearest = closestPointOnSegment(point, start, end);
    const yards = distanceYards(point, nearest);
    if (yards >= best) continue;
    const along = bearingDegrees(start, end);
    const toward = bearingDegrees(nearest, point);
    best = yards;
    found = true;
    if (along == null || toward == null || yards < 1) {
      signed = 0;
      continue;
    }
    let delta = toward - along;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    signed = delta > 0 ? yards : -yards;
  }
  return found ? Math.round(signed * 10) / 10 : null;
}

/**
 * Green, then water, then bunker (as hazard), then fairway.
 * Off the fairway, a point beside the hole line is left or right.
 * A point on the line but outside the fairway is rough.
 * No polygon and no line leaves the finish blank.
 */
export function classifyFinish(point: LatLon, polygons: WalkPolygons): FinishLie | null {
  if (insideAny(point, polygons.greens)) return 'green';
  if (insideAny(point, polygons.hazards) || insideAny(point, polygons.bunkers)) return 'hazard';
  if (insideAny(point, polygons.fairways)) return 'fairway';
  const lateral = lateralYards(point, polygons.line);
  if (lateral == null) return null;
  if (Math.abs(lateral) >= 12) return lateral > 0 ? 'right' : 'left';
  return 'rough';
}

export function closeMarkedShot(
  from: LatLon,
  to: LatLon,
  polygons: WalkPolygons,
): { yards: number; lie: FinishLie | null } | null {
  const yards = distanceYards(from, to);
  if (!Number.isFinite(yards) || yards <= 0) return null;
  return { yards: Math.round(yards * 10) / 10, lie: classifyFinish(to, polygons) };
}

/** Ground yards to the nearest hazard or bunker ring. Null when none exist. Not a carry. */
export function nearestHazardYards(from: LatLon, rings: readonly (readonly LatLon[])[]): number | null {
  let best: number | null = null;
  for (const ring of rings) {
    const yards = distanceToRingYards(from, ring);
    if (yards == null) continue;
    if (best == null || yards < best) best = yards;
  }
  return best == null ? null : Math.round(best * 10) / 10;
}

export function arrivedAtNextTee(input: { player: LatLon; nextTee: LatLon | null; currentGreen: LatLon | null }): boolean {
  if (!input.nextTee) return false;
  const toTee = distanceYards(input.player, input.nextTee);
  if (toTee > NEXT_TEE_YARDS) return false;
  if (input.currentGreen && distanceYards(input.player, input.currentGreen) <= toTee) return false;
  return true;
}

/**
 * A desk position on the open hole line. Approach is 160 yards short of the green center.
 * These are ground positions for tests, not shot distances.
 */
export function gpsPreset(preset: GpsPreset, line: readonly LatLon[], greenRing: readonly LatLon[] | null): LatLon | null {
  const start = line[0];
  const end = line[line.length - 1];
  if (!start || !end) return null;
  const center = greenRing ? ringCentroid(greenRing) ?? end : end;
  if (preset === 'tee') return start;
  if (preset === 'green') return center;
  const back = bearingDegrees(center, start);
  if (back == null) return null;
  return destinationPoint(center, back, 160);
}

export interface ScoreFace {
  /** Par until a stored score exists. Null when the hole has no par and no score. */
  strokes: number | null;
  strokesConfirmed: boolean;
  putts: number;
  puttsConfirmed: boolean;
  /** Mark count. Null until a shot has been marked. Not added to putts. */
  suggestion: number | null;
  blowUp: boolean;
}

export function scoreFace(input: {
  par: number | null;
  storedStrokes: number | null;
  storedPutts: number | null;
  markCount: number;
}): ScoreFace {
  const strokesConfirmed = input.storedStrokes != null;
  const strokes = input.storedStrokes ?? input.par;
  const over = strokes != null && input.par != null ? strokes - input.par : null;
  return {
    strokes,
    strokesConfirmed,
    putts: input.storedPutts ?? DEFAULT_PUTTS,
    puttsConfirmed: input.storedPutts != null,
    suggestion: input.markCount > 0 ? input.markCount : null,
    blowUp: over != null && over >= BLOWUP_OVER,
  };
}

/** Step a shown count. Strokes stop at 1. Putts stop at 0. */
export function stepCount(shown: number, delta: number, floor: number): number {
  return Math.max(floor, shown + delta);
}
