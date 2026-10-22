export type DistanceUnit = 'yd' | 'm';

const METERS_PER_YARD = 0.9144;

/** Display only. Stored distances stay in yards. */
export function yardsToDisplay(yards: number, unit: DistanceUnit): number {
  if (unit === 'yd') return yards;
  return yards * METERS_PER_YARD;
}

/** A typed meters value becomes yards for storage. This is a unit change, not a carry/total conversion. */
export function displayToYards(value: number, unit: DistanceUnit): number {
  if (unit === 'yd') return value;
  return value / METERS_PER_YARD;
}

export function formatDistance(yards: number | null, unit: DistanceUnit): string {
  if (yards == null || !Number.isFinite(yards)) return '—';
  const shown = yardsToDisplay(yards, unit);
  if (unit === 'yd') return String(Math.round(shown));
  return (Math.round(shown * 10) / 10).toFixed(1);
}

export function unitLabel(unit: DistanceUnit): string {
  return unit === 'yd' ? 'yards' : 'meters';
}
