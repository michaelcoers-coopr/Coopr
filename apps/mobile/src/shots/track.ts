/** Real shot distances. Estimated starter yards stay until enough clean shots exist. */

export const MIN_MEASURED_SHOTS = 5;
export const SHOT_YARD_MIN = 20;
export const SHOT_YARD_MAX = 400;

export interface MeasuredShot {
  clubId: string;
  yards: number;
}

/** Yards between two GPS points. */
export function yardsBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const meters = 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(meters * 1.0936133);
}

/** Drops a shot that is far from the shots already kept, or outside a real golf range. */
export function keepShot(yards: number, kept: readonly number[]): boolean {
  if (!Number.isFinite(yards) || yards < SHOT_YARD_MIN || yards > SHOT_YARD_MAX) return false;
  if (kept.length < 3) return true;
  const sorted = [...kept].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] ?? yards;
  return yards >= median * 0.55 && yards <= median * 1.7;
}

export function measuredAverage(yards: readonly number[]): { yards: number; count: number } | null {
  const kept: number[] = [];
  for (const value of yards) {
    if (keepShot(value, kept)) kept.push(value);
  }
  if (kept.length < MIN_MEASURED_SHOTS) return null;
  const total = kept.reduce((sum, value) => sum + value, 0);
  return { yards: Math.round(total / kept.length), count: kept.length };
}

export function measuredLine(label: string, average: { yards: number; count: number }): string {
  return `${label} carries ${average.yards}, from ${average.count} shots.`;
}

export function shouldSpeak(muted: boolean): boolean {
  return muted !== true;
}

/** Spoken yardage stays a normal sentence size. The number is not a display headline. */
export const ANSWER_FONT = 16;
