// Seed User 001 — "Mike", the founding golfer. This is the first validation case
// for the engines. Rules enforced here:
//   - Iron/AW distance lists (spec sections 14-19) are CARRY distance (founder
//     confirmed). totalYards stays null; total is never fabricated from carry. These
//     are simulator carries and read ~10 yд short of outdoor — that gap lives in the
//     unverified calibration band and is never auto-applied.
//   - Every genuine shot is kept. Short mishits are NOT dropped and NOT labeled
//     'invalid' — only a clear monitor misread would be 'invalid'.
//   - Where the spec gives only aggregates (Miura 48, driver 10-shot average), we
//     store the aggregate as reference and do NOT invent per-shot rows.
//   - The 8-iron session carries a count discrepancy → validationRequired.

import type { Club, CalibrationProfile } from '../types/equipment';
import type { Shot, PartialShot } from '../types/shot';
import { makeShot } from '../types/shot';

export const SEED_PLAYER_ID = 'seed-user-001';
export const SEED_BAG_ID = 'seed-bag-001';

// Fixed founding-session timestamp (2025-01-15T00:00:00Z). A literal constant so the
// seed is deterministic and the pure package never reads a clock.
export const FOUNDING_SESSION_DATE = 1736899200000;

export const SEED_PROFILE = {
  id: SEED_PLAYER_ID,
  name: 'Mike',
  handicap: 35, // historical; mutable, not permanent
  notes:
    'Recreational golfer. Adequate clubhead speed; strike consistency is the larger ' +
    'limiter. Significant front-to-back variation on poor strikes. Attributes evolve.',
};

// ---- Bag ---------------------------------------------------------------------

function club(
  id: string,
  type: Club['type'],
  label: string,
  extra: Partial<Club> = {},
): Club {
  return {
    id,
    bagId: SEED_BAG_ID,
    type,
    label,
    manufacturer: null,
    model: null,
    loftDeg: null,
    shaftFlex: 'stiff', // every current club is reported stiff flex
    shaftModel: null,
    shaftMaterial: null,
    bounceDeg: null,
    inBag: true,
    ...extra,
  };
}

export const seedClubs: Club[] = [
  club('c-driver', 'driver', 'Driver', { manufacturer: 'Callaway', model: 'XR' }),
  club('c-2h', 'hybrid', '2H', { manufacturer: 'Cleveland', model: 'Launcher 2H' }),
  club('c-3h', 'hybrid', '3H', { manufacturer: 'Cleveland', model: 'Launcher 3H' }),
  club('c-4h', 'hybrid', '4H', { manufacturer: 'Cleveland', model: 'Launcher 4H' }),
  club('c-3u', 'utility', '3 Utility', { manufacturer: 'PXG', model: '3 Iron/Utility' }),
  club('c-5i', 'iron', '5i', { manufacturer: 'Callaway', model: 'Steelhead XR' }),
  club('c-6i', 'iron', '6i', { manufacturer: 'Callaway', model: 'Steelhead XR' }),
  club('c-7i', 'iron', '7i', { manufacturer: 'Callaway', model: 'Steelhead XR' }),
  club('c-8i', 'iron', '8i', { manufacturer: 'Callaway', model: 'Steelhead XR' }),
  club('c-9i', 'iron', '9i', { manufacturer: 'Callaway', model: 'Steelhead XR' }),
  club('c-pw', 'iron', 'PW', { manufacturer: 'Callaway', model: 'Steelhead XR', loftDeg: 44 }),
  club('c-aw', 'iron', 'AW', { manufacturer: 'Callaway', model: 'Steelhead XR', loftDeg: 49 }),
  club('c-w48', 'wedge', '48°', { manufacturer: 'Miura', loftDeg: 48, shaftMaterial: 'steel' }),
  club('c-w54', 'wedge', '54°', { manufacturer: 'Callaway', model: 'Mack Daddy 3', loftDeg: 54, bounceDeg: 10 }),
  club('c-w56', 'wedge', '56°', { manufacturer: 'Miura', loftDeg: 56, shaftMaterial: 'steel' }),
  club('c-w58', 'wedge', '58°', { manufacturer: 'Callaway', model: 'Mack Daddy 3', loftDeg: 58, bounceDeg: 9 }),
  club('c-putter', 'putter', 'Putter'),
];

// Subjective feedback, stored separately from measured data (spec section 11).
export const seedClubFeedback = [
  { id: 'f-2h', clubId: 'c-2h', confidence: 'low' as const, note: 'poor strike quality', createdAt: FOUNDING_SESSION_DATE },
  { id: 'f-3h', clubId: 'c-3h', confidence: 'moderate' as const, note: null, createdAt: FOUNDING_SESSION_DATE },
  { id: 'f-4h', clubId: 'c-4h', confidence: 'high' as const, note: 'highest hybrid confidence; better than 3H', createdAt: FOUNDING_SESSION_DATE },
];

// ---- Shots -------------------------------------------------------------------

let shotCounter = 0;
function buildShots(
  clubId: string,
  clubLabel: string,
  sessionId: string,
  rows: Partial<Shot>[],
): Shot[] {
  return rows.map((row, i) => {
    const partial: PartialShot = {
      clubId,
      clubLabel,
      sessionId,
      sessionDate: FOUNDING_SESSION_DATE,
      environment: 'simulator',
      swingMode: 'stock',
      shotNumber: i + 1,
      ...row,
    };
    return makeShot(`s-${clubId}-${++shotCounter}`, SEED_PLAYER_ID, partial);
  });
}

// Irons/AW: CARRY distance only (founder confirmed). totalYards stays null.
const carryOnly = (c: number): Partial<Shot> => ({ carryYards: c });

const iron5 = buildShots('c-5i', '5i', 'sess-founding-irons',
  [132.8, 80.6, 171.9, 184.7, 119.9, 184.5, 152.2, 184.4, 74.4, 183.0].map(carryOnly));

const iron6 = buildShots('c-6i', '6i', 'sess-founding-irons',
  [157.6, 166.4, 174.8, 46.8, 133.5, 143.0, 64.8, 39.9, 33.2, 161.3, 143.5, 161.1, 112.6].map(carryOnly));

const iron7 = buildShots('c-7i', '7i', 'sess-founding-irons',
  [104.9, 150.8, 158.3, 149.6, 132.8, 154.4, 123.0, 162.5, 169.0, 162.8, 167.9].map(carryOnly));

// 8-iron session has a count discrepancy → validationRequired (see SEED_SESSIONS).
const iron8 = buildShots('c-8i', '8i', 'sess-founding-8i',
  [147.4, 144.6, 129.8, 119.0, 141.5, 137.5, 143.5, 112.8, 139.0, 140.4, 149.4].map(carryOnly));

const iron9 = buildShots('c-9i', '9i', 'sess-founding-irons',
  [141.7, 119.0, 149.0, 144.0, 125.5, 148.9, 118.8, 155.9, 165.1, 152.4].map(carryOnly));

const awShots = buildShots('c-aw', 'AW', 'sess-founding-irons',
  [85.9, 110.5, 108.5, 111.9, 108.2, 96.6, 109.2, 118.9, 113.6, 109.6].map(carryOnly));

// Miura 56°: carry / total pairs are given.
const w56Pairs: Array<[number, number]> = [
  [86.7, 90.9], [88.6, 91.0], [91.3, 92.5], [88.8, 90.4], [84.7, 87.0], [93.1, 94.4],
];
const w56Shots = buildShots('c-w56', '56°', 'sess-founding-wedges',
  w56Pairs.map(([c, t]) => ({ carryYards: c, totalYards: t })));

// Driver: individual shots 3-10 are given (shots 1-2 exist only in the 10-shot
// average, so they are NOT fabricated here). Unknown fields stay null.
const driverShots = buildShots('c-driver', 'Driver', 'sess-founding-driver', [
  { carryYards: 137.7, totalYards: 140.6, clubSpeedMph: 95.6, ballSpeedMph: 112.0, smashFactor: 1.17, spinRateRpm: 8210, attackAngleDeg: -2.0, qualityLabel: 'mishit', qualityReason: 'near-top: 1.17 smash, 8210 rpm' },
  { carryYards: 218.6, totalYards: 228.9, ballSpeedMph: 138.8, spinRateRpm: 3710 },
  { carryYards: 220.8, totalYards: 252.8, ballSpeedMph: 141.6, spinRateRpm: 2590 },
  { carryYards: 186.7, totalYards: 202.9, ballSpeedMph: 127.7, spinRateRpm: 3230 },
  { carryYards: 217.6, totalYards: 249.7, clubSpeedMph: 94.0, ballSpeedMph: 139.6, smashFactor: 1.49, spinRateRpm: 2530, attackAngleDeg: -0.4 },
  { carryYards: 185.6, totalYards: 196.7, clubSpeedMph: 92.3, ballSpeedMph: 123.3, smashFactor: 1.34, spinRateRpm: 4100, attackAngleDeg: -0.5 },
  { carryYards: 185.9, totalYards: 223.6, clubSpeedMph: 96.1, ballSpeedMph: 141.9, smashFactor: 1.48, spinRateRpm: 2200, attackAngleDeg: 1.2 },
  { carryYards: 176.1, totalYards: 192.7, clubSpeedMph: 94.6, ballSpeedMph: 135.0, smashFactor: 1.43, spinRateRpm: 2590, attackAngleDeg: 3.2 },
]);

export const seedShots: Shot[] = [
  ...iron5, ...iron6, ...iron7, ...iron8, ...iron9, ...awShots, ...w56Shots, ...driverShots,
];

export const SEED_SESSIONS = [
  { id: 'sess-founding-irons', date: FOUNDING_SESSION_DATE, environment: 'simulator', validationRequired: false },
  { id: 'sess-founding-8i', date: FOUNDING_SESSION_DATE, environment: 'simulator', validationRequired: true },
  { id: 'sess-founding-wedges', date: FOUNDING_SESSION_DATE, environment: 'simulator', validationRequired: false },
  { id: 'sess-founding-driver', date: FOUNDING_SESSION_DATE, environment: 'simulator', validationRequired: false },
] as const;

export const VALIDATION_REQUIRED_SESSIONS = new Set(
  SEED_SESSIONS.filter((s) => s.validationRequired).map((s) => s.id),
);

// ---- Aggregate references (no per-shot rows exist for these) ------------------

// Miura 48° (spec section 20): overlap with AW 49° flagged for bag optimization.
export const MIURA_48_AGGREGATE = {
  clubId: 'c-w48',
  rawAverageCarry: 95.6,
  rawAverageTotal: 102.2,
  usableStrikeAverageCarry: 105.5,
  usableStrikeAverageTotal: 112.1,
  bestRetainedCarry: 114.5,
  bestRetainedTotal: 118.9,
};

// Driver 10-shot averages (spec section 22). Reference only; the profile is computed
// from the 8 individual shots above. 220 is NOT the stock carry.
export const DRIVER_10_SHOT_AGGREGATE = {
  clubId: 'c-driver',
  averageCarry: 180.4,
  averageTotal: 202.9,
  clubSpeedMph: 94.2,
  ballSpeedMph: 133.2,
  smashFactor: 1.4,
  spinRateRpm: 3355,
  launchAngleDeg: 11.7,
  approxCarryDispersionYards: 27,
  approxTotalDispersionYards: 31,
  conservativeSimCarryRange: [185, 190] as const,
  goodStrikeCarryRange: [219, 221] as const,
};

// Suspected simulator bias (spec section 23). Never auto-applied (invariant 5).
export const seedCalibration: CalibrationProfile = {
  id: 'cal-seed-sim',
  playerId: SEED_PLAYER_ID,
  scope: 'all',
  clubId: null,
  status: 'suspected',
  deltaMinYards: 10,
  deltaMaxYards: 15,
  confidence: 'low',
  applyAutomatically: false,
  note: 'Facility may have measured 10-15 yd short. Unverified. Display-only band; never fed to the engine.',
};
