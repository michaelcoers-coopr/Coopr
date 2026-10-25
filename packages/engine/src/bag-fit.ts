/**
 * Bag-scan fit verdict and loft-gap rules.
 * Port of fixtures/fit_engine.py. Deterministic. No network.
 * Thresholds marked in the source comments are placeholders for a fitter panel,
 * not a fitting. The card copy says so.
 */

export const FLEX = ['L', 'A', 'R', 'S', 'X'] as const;
export type FlexLetter = (typeof FLEX)[number];

/** Callaway 2025 Custom Offering Guide driver-speed bands. */
const BANDS: readonly (readonly [FlexLetter, number, number])[] = [
  ['L', 0, 75],
  ['A', 75, 85],
  ['R', 85, 95],
  ['S', 95, 105],
  ['X', 105, 999],
];

/** ±5 mph around a boundary accepts both neighbours. */
const OVERLAP_MPH = 5;

/** Suggested static loft by driver speed. The open end is stored as 99 and shown as "+". */
const LOFT_BY_SPEED: readonly (readonly [number, number, readonly [number, number]])[] = [
  [0, 85, [12, 99]],
  [85, 95, [10.5, 12]],
  [95, 105, [9, 10.5]],
  [105, 999, [8, 9]],
];

/** PLACEHOLDER: degrees outside the suggested range that still count as stretch. */
const LOFT_TOL = 1;

const SKILL_BANDS: readonly (readonly [number, number, string])[] = [
  [0, 5, '<=5'],
  [5, 12, '6-12'],
  [12, 20, '13-20'],
  [20, 99, '21+'],
];

/** PLACEHOLDER: minimum forgiveness tier wanted by handicap band. */
const NEED: Record<string, number> = { '<=5': 1, '6-12': 2, '13-20': 3, '21+': 4 };

/** Conservative tier floor from the minimum tier seen per iron category. */
const CAT_TIER: Record<string, number> = {
  'super-game-improvement': 5,
  'game-improvement': 4,
  'players-distance': 3,
  'players-cb': 2,
  blade: 1,
};

/** PLACEHOLDER: adjacent lofts at or under this are an overlap. */
const OVERLAP_LOFT = 2;

/** PLACEHOLDER: a gap larger than this multiple of the median adjacent gap is a gap. */
const GAP_MULT = 1.5;

export interface FitClub {
  id: string;
  slot: string;
  in_play: boolean;
  type: string;
  loft: number | null;
  flex: string | null;
  set?: string | null;
}

export interface FitProfile {
  handicap_index: number | null;
  handicap_quality: string | null;
  driver_speed_mph: number | null;
  speed_quality: string | null;
}

export interface FitCheck {
  status: 'pass' | 'stretch' | 'mismatch' | 'unknown';
  label: string;
  why: string;
  needs: string | null;
  basis: string | null;
}

export type FitVerdict = 'GOOD' | 'OKAY' | 'PROBABLY_NOT' | 'CANT_TELL';

export interface ClubVerdict {
  club: string;
  verdict: FitVerdict;
  checks: FitCheck[];
  needs: string[];
  sample: boolean;
}

export interface GapFlag {
  kind: 'overlap' | 'gap';
  between: [string, string];
  lofts: [number, number];
  gap: number;
}

export interface BagGaps {
  known_lofts: [number, string][];
  adjacent_gaps: number[];
  median_gap: number | null;
  flags: GapFlag[];
  unknown_loft_in_play: string[];
  benched: [string, number | null][];
}

function chk(
  status: FitCheck['status'],
  label: string,
  why: string,
  needs: string | null = null,
  basis: string | null = null,
): FitCheck {
  return { status, label, why, needs, basis };
}

/** Whole-number handicap indexes print like Python's float ("14.0"). */
function handicapText(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function gapText(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

function subtract(a: number, b: number): number {
  return Math.round((a - b) * 1000) / 1000;
}

export function skillBand(handicap: number): string {
  for (const [lo, hi, name] of SKILL_BANDS) {
    if ((lo <= handicap && handicap < hi) || (name === '<=5' && handicap <= 5)) return name;
  }
  return '21+';
}

export function expectedFlexes(mph: number): FlexLetter[] {
  const ok = new Set<FlexLetter>();
  for (const [flex, lo, hi] of BANDS) {
    if (lo - OVERLAP_MPH <= mph && mph < hi + OVERLAP_MPH) ok.add(flex);
    if (lo <= mph && mph < hi) ok.add(flex);
  }
  return FLEX.filter((flex) => ok.has(flex));
}

export function headCheck(club: FitClub, profile: FitProfile, pickedTypes: Readonly<Record<string, string>>): FitCheck {
  const setId = club.set ?? null;
  const typ = setId ? (pickedTypes[setId] ?? null) : null;
  if (club.type !== 'iron') {
    return chk('unknown', 'Head type', 'Head-type rules only exist for irons so far.');
  }
  if (!typ || CAT_TIER[typ] == null) {
    return chk('unknown', 'Head type', 'Not in the catalog. Pick the type to unlock this check.', 'pick iron type');
  }
  if (profile.handicap_index == null) {
    return chk('unknown', 'Head vs handicap', `${typ}, but no handicap yet.`, 'handicap index or 3 logged rounds');
  }
  const band = skillBand(profile.handicap_index);
  const tier = CAT_TIER[typ]!;
  const need = NEED[band]!;
  const status = tier >= need ? 'pass' : tier === need - 1 ? 'stretch' : 'mismatch';
  return chk(
    status,
    'Head vs handicap',
    `${typ} head (forgiveness floor ${tier}/5) vs handicap ${handicapText(profile.handicap_index)} (band ${band}, wants ${need}+).`,
    null,
    profile.handicap_quality,
  );
}

export function flexCheck(club: FitClub, profile: FitProfile): FitCheck {
  if (!club.flex) return chk('unknown', 'Shaft flex', 'Flex not set.', 'shaft flex (shaft band photo or type it)');
  if (profile.driver_speed_mph == null) {
    return chk(
      'unknown',
      'Shaft flex',
      `Flex ${club.flex}, but no driver speed.`,
      'driver speed from a monitor (or 5 logged driver shots)',
    );
  }
  if (!(FLEX as readonly string[]).includes(club.flex)) {
    return chk('unknown', 'Shaft flex', `Flex ${club.flex} is not a starting letter we can place.`, 'shaft flex (shaft band photo or type it)');
  }
  const expected = expectedFlexes(profile.driver_speed_mph);
  const index = FLEX.indexOf(club.flex as FlexLetter);
  const steps = Math.min(...expected.map((flex) => Math.abs(index - FLEX.indexOf(flex))));
  const status = steps === 0 ? 'pass' : steps === 1 ? 'stretch' : 'mismatch';
  return chk(
    status,
    'Shaft flex vs speed',
    `Flex ${club.flex} vs driver speed ${profile.driver_speed_mph} mph; starting flex ${expected.join('/')}; ${steps} step(s) off.`,
    null,
    profile.speed_quality,
  );
}

export function driverLoftCheck(club: FitClub, profile: FitProfile): FitCheck | null {
  if (club.type !== 'driver') return null;
  if (club.loft == null) return chk('unknown', 'Driver loft', 'Loft not set.', 'loft (stamp on the sole or hosel)');
  if (profile.driver_speed_mph == null) return chk('unknown', 'Driver loft', 'No driver speed.', 'driver speed');
  const speed = profile.driver_speed_mph;
  let range: readonly [number, number] = [12, 99];
  for (const [lo, hi, band] of LOFT_BY_SPEED) {
    if (lo <= speed && speed < hi) range = band;
  }
  const distance =
    range[0] <= club.loft && club.loft <= range[1] ? 0 : Math.min(Math.abs(club.loft - range[0]), Math.abs(club.loft - range[1]));
  const status = distance === 0 ? 'pass' : distance <= LOFT_TOL ? 'stretch' : 'mismatch';
  const high = range[1] < 99 ? String(range[1]) : '+';
  return chk(
    status,
    'Loft vs speed',
    `${club.loft}° vs suggested ${range[0]}-${high}° at ${speed} mph (adjustable sleeves change true loft).`,
    null,
    profile.speed_quality,
  );
}

export function bagCheck(club: FitClub, bag: readonly FitClub[]): FitCheck {
  if (club.loft == null) return chk('unknown', 'Loft in your bag', 'Loft not set.', 'loft');
  const lofts = bag
    .filter((item) => item.in_play && item.loft != null)
    .map((item) => [item.loft as number, item.id] as const)
    .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const gaps = lofts.slice(1).map((item, index) => subtract(item[0], lofts[index]![0]));
  const med = median(gaps);
  const ids = lofts.map((item) => item[1]);
  const idx = ids.indexOf(club.id);
  if (idx < 0) return chk('unknown', 'Loft in your bag', 'Club is not in play.');
  const near: string[] = [];
  for (const j of [idx - 1, idx + 1]) {
    const neighbour = lofts[j];
    if (!neighbour) continue;
    const gap = Math.abs(subtract(neighbour[0], club.loft));
    if (gap <= OVERLAP_LOFT) near.push(`${gapText(gap)}° from the ${gapText(neighbour[0])}° club (overlap)`);
    else if (med != null && gap > GAP_MULT * med) near.push(`${gapText(gap)}° to the ${gapText(neighbour[0])}° club (gap; median gap ${gapText(med)}°)`);
  }
  return chk(near.length ? 'stretch' : 'pass', 'Loft in your bag', near.join('; ') || 'No overlap or gap with known neighbours.');
}

export function verdict(club: FitClub, profile: FitProfile, bag: readonly FitClub[], picked: Readonly<Record<string, string>>): ClubVerdict {
  const checks: FitCheck[] = [headCheck(club, profile, picked), flexCheck(club, profile)];
  const loft = driverLoftCheck(club, profile);
  if (loft) checks.push(loft);
  checks.push(bagCheck(club, bag));
  const player = checks.filter((item) => item.label !== 'Loft in your bag');
  const known = player.filter((item) => item.status !== 'unknown');
  const firm = known.filter(
    (item) => item.status === 'mismatch' && (item.basis === 'measured' || item.basis === 'user_confirmed' || item.basis === 'sample'),
  );
  let result: FitVerdict;
  if (firm.length) result = 'PROBABLY_NOT';
  else if (known.some((item) => item.status === 'mismatch')) result = 'OKAY';
  else if (known.some((item) => item.status === 'stretch')) result = 'OKAY';
  else if (known.filter((item) => item.status === 'pass').length >= 2) result = 'GOOD';
  else result = 'CANT_TELL';
  return {
    club: club.id,
    verdict: result,
    checks,
    needs: checks.flatMap((item) => (item.needs ? [item.needs] : [])),
    sample: profile.handicap_quality === 'sample',
  };
}

export function bagGaps(bag: readonly FitClub[]): BagGaps {
  const lofts = bag
    .filter((item) => item.in_play && item.loft != null)
    .map((item) => [item.loft as number, item.slot, item.id] as const)
    .sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
  const pairs = lofts.slice(1).map((item, index) => {
    const previous = lofts[index]!;
    return { a: previous, b: item, gap: subtract(item[0], previous[0]) };
  });
  const med = median(pairs.map((item) => item.gap));
  const flags: GapFlag[] = [];
  for (const pair of pairs) {
    if (pair.gap <= OVERLAP_LOFT) {
      flags.push({ kind: 'overlap', between: [pair.a[1], pair.b[1]], lofts: [pair.a[0], pair.b[0]], gap: pair.gap });
    } else if (med != null && pair.gap > GAP_MULT * med) {
      flags.push({ kind: 'gap', between: [pair.a[1], pair.b[1]], lofts: [pair.a[0], pair.b[0]], gap: pair.gap });
    }
  }
  return {
    known_lofts: lofts.map((item) => [item[0], item[1]]),
    adjacent_gaps: pairs.map((item) => item.gap),
    median_gap: med,
    flags,
    unknown_loft_in_play: bag.filter((item) => item.in_play && item.loft == null).map((item) => item.slot),
    benched: bag.filter((item) => !item.in_play).map((item) => [item.slot, item.loft]),
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}
