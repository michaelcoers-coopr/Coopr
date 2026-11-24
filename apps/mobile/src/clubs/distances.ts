/**
 * Estimated carry by shaft flex.
 * The club-distances package is not in this repo. These tables stand in for it.
 * L is the ladies flex band (driver speed under 75 mph), the same bands the fitter uses.
 * Every yard is an estimate. A measured shot replaces it. Nothing here is a stock yardage from a launch monitor.
 */

export type FlexBand = 'L' | 'A' | 'R' | 'S' | 'X';

export interface CarryEstimate {
  yards: number | null;
  /** Shown next to the number. */
  basis: string;
  estimated: true;
}

const BANDS: readonly (readonly [FlexBand, number, number])[] = [
  ['L', 0, 75],
  ['A', 75, 85],
  ['R', 85, 95],
  ['S', 95, 105],
  ['X', 105, 999],
];

/** Average carry yards for a full swing. Putter stays null. */
const CARRY: Record<FlexBand | 'all', Record<string, number>> = {
  L: { DR: 180, '3W': 165, '5W': 155, '4H': 150, '5I': 140, '6I': 130, '7I': 120, '8I': 110, '9I': 100, PW: 90, GW: 80, SW: 70, LW: 58 },
  A: { DR: 200, '3W': 182, '5W': 170, '4H': 165, '5I': 155, '6I': 145, '7I': 135, '8I': 125, '9I': 115, PW: 105, GW: 95, SW: 80, LW: 65 },
  R: { DR: 220, '3W': 200, '5W': 185, '4H': 178, '5I': 168, '6I': 158, '7I': 148, '8I': 138, '9I': 128, PW: 118, GW: 105, SW: 90, LW: 75 },
  S: { DR: 240, '3W': 218, '5W': 202, '4H': 192, '5I': 182, '6I': 172, '7I': 162, '8I': 152, '9I': 142, PW: 130, GW: 118, SW: 100, LW: 85 },
  X: { DR: 260, '3W': 236, '5W': 218, '4H': 208, '5I': 198, '6I': 188, '7I': 176, '8I': 166, '9I': 156, PW: 142, GW: 128, SW: 108, LW: 92 },
  all: { DR: 210, '3W': 190, '5W': 176, '4H': 170, '5I': 160, '6I': 150, '7I': 140, '8I': 130, '9I': 120, PW: 110, GW: 98, SW: 84, LW: 68 },
};

const BASIS: Record<FlexBand | 'all', string> = {
  L: 'Ladies flex average, driver speed under 75 mph',
  A: 'Senior flex average',
  R: 'Regular flex average',
  S: 'Stiff flex average',
  X: 'Extra-stiff flex average',
  all: 'All-player average',
};

export function primaryFlex(mph: number): FlexBand | null {
  if (!Number.isFinite(mph)) return null;
  for (const [flex, lo, hi] of BANDS) {
    if (lo <= mph && mph < hi) return flex;
  }
  return null;
}

function handicapScale(handicap: number): number {
  if (handicap <= 5) return 1.04;
  if (handicap <= 12) return 1;
  if (handicap <= 20) return 0.96;
  return 0.92;
}

export function estimateCarry(input: { club: string; handicap: number | null; driverSpeed: number | null }): CarryEstimate {
  const key = input.club.toUpperCase();
  if (key === 'PT' || key === 'PUTTER') return { yards: null, basis: 'No estimated carry for a putter', estimated: true };
  const speed = input.driverSpeed;
  const handicap = input.handicap;
  const both = speed != null && Number.isFinite(speed) && handicap != null && Number.isFinite(handicap);
  const flex = both ? primaryFlex(speed!) : null;
  const table = flex ?? 'all';
  const raw = CARRY[table][key];
  if (raw == null) return { yards: null, basis: BASIS.all, estimated: true };
  const yards = both && flex ? Math.round(raw * handicapScale(handicap!)) : raw;
  const basis = both && flex ? `${BASIS[flex]}, adjusted for handicap ${handicap}` : BASIS.all;
  return { yards, basis, estimated: true };
}

export interface EstimateClub {
  id: string;
  label: string;
  code: string;
  yards: number | null;
}

/** Closest estimated carry to the yardage in hand. The sentence always says it is estimated. */
export function estimatedAdvice(input: { clubs: readonly EstimateClub[]; targetYards: number | null; basis: string | null }): string | null {
  const playable = input.clubs.filter((club) => club.yards != null && Number.isFinite(club.yards));
  if (playable.length === 0) return null;
  const basis = input.basis ?? 'All-player average';
  const target = input.targetYards;
  if (target == null || !Number.isFinite(target)) {
    const driver = playable.find((club) => club.code === 'DR') ?? playable[0]!;
    return `Estimated. ${driver.label} carries about ${driver.yards}. ${basis}, not a measured shot.`;
  }
  const ranked = [...playable].sort((a, b) => Math.abs(a.yards! - target) - Math.abs(b.yards! - target) || a.label.localeCompare(b.label));
  const pick = ranked[0]!;
  const gap = Math.round(pick.yards! - target);
  const relation = gap === 0 ? 'is about dead on' : gap > 0 ? `is about ${gap} long` : `is about ${Math.abs(gap)} short`;
  return `Estimated. ${pick.label} ${relation} of ${Math.round(target)}. ${basis}, not a measured shot.`;
}
