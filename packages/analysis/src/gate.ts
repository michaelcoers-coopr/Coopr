import type { Config, Confidence, Insight, Quality, BaselineKind } from './types';

export const DEFAULT_CONFIG: Config = {
  putAllotment: 2,
  // [limited, moderate, solid] minimum n in each insight's own unit. Proposed defaults, not facts.
  gate: {
    ledger: [54, 90, 180], // complete holes (strokes+par+putts+penalties all logged); 18 = one round
    parType: [8, 20, 45], // holes in one bucket
    blowups: [54, 90, 180],
    threePutt: [36, 72, 144], // holes with putts logged
    fairways: [30, 60, 120], // par 4/5 holes with a fairway result
    gir: [36, 72, 144],
    scrambling: [15, 30, 60], // holes where the green was missed
    penalties: [54, 90, 180],
    repeatHole: [3, 5, 8], // plays of the same hole on the same course
    backNine: [5, 8, 12], // complete 18-hole rounds
    pressure: [12, 24, 48], // pressure holes (and >= 36 non-pressure holes for the comparison)
    timeSplit: [5, 8, 12], // rounds in EACH group
    gapClubs: [3, 6, 9], // clubs that already have >= gapping[0] measured carries (a gap needs neighbours)
    gapping: [3, 10, 25], // measured carries per club (3 = learning, 10 = "Yours", matches club-distances)
    dispersion: [10, 20, 40], // shots with lateral AND longitudinal per club
    sgCategory: [25, 60, 120], // shots in an SG category
  },
  backNine: { minMeanStrokes: 1.0, minShareWorse: 0.7 },
  pressure: { bankMin: -1, bankMax: 3, minHolesRemaining: 1, zForCall: 2 },
  gaps: { bigGapMultiple: 1.5, bigGapMinYds: 15, overlapFracOfMedian: 0.4, overlapMaxYds: 3, shortMissFrac: 0.1 },
  ellipseChi2: 3.219, // 80% under bivariate normal
  aimOffset: { minYds: 3, minZ: 1.5 },
  sg: { aroundGreenYds: 30, minBucket: 15, minRoundsSelf: 5, minShotsPerCategory: 25 },
  yardageBands: { par3: [140, 175], par4: [350, 420], par5: [500, 550] },
  // Coaching weights: product choices for "what is most fixable by next round". Not measured quantities.
  fixability: { penalties: 1.0, three_putts: 0.9, blowups: 0.8, ttg_par3: 0.5, ttg_par4: 0.5, ttg_par5: 0.6, tee_trouble: 0.6, approach_short_game: 0.6 },
  confidenceWeight: { insufficient: 0, limited: 0.4, moderate: 0.7, solid: 1.0 },
};

export function confidenceFor(n: number, gate: [number, number, number]): Confidence {
  if (n >= gate[2]) return 'solid';
  if (n >= gate[1]) return 'moderate';
  if (n >= gate[0]) return 'limited';
  return 'insufficient';
}

const QUALITY_ORDER: Quality[] = ['measured', 'user_confirmed', 'derived', 'estimated', 'provisional', 'unknown'];
export function weakestQuality(qs: readonly Quality[]): Quality {
  let worst = 0;
  for (const q of qs) worst = Math.max(worst, QUALITY_ORDER.indexOf(q));
  return qs.length === 0 ? 'unknown' : QUALITY_ORDER[worst]!;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface GateArgs {
  id: string;
  title: string;
  n: number;
  nUnit: string;
  gate: [number, number, number];
  baseline: BaselineKind;
  sample: boolean;
  quality: Quality;
  /** How the invitation reads when short, e.g. "rounds with putts logged". */
  invitationUnit: { perRound?: number; text: string };
  missingInputs?: string[];
}

/** Builds a not-ready envelope when n is under the minimum. Returns null when the gate is passed. */
export function notReady<T>(a: GateArgs): Insight<T> | null {
  if (a.n >= a.gate[0]) return null;
  const short = a.gate[0] - a.n;
  const per = a.invitationUnit.perRound;
  const amount = per ? Math.ceil(short / per) : short;
  const unitText = amount === 1 ? a.invitationUnit.text.replace(/\b(rounds|plays|clubs|holes|shots|greens)\b/, (m) => m.slice(0, -1)) : a.invitationUnit.text;
  return {
    id: a.id, title: a.title, status: 'needs_more', value: null, n: a.n, nUnit: a.nUnit, nNeeded: a.gate[0],
    confidence: 'insufficient', sample: a.sample, quality: a.quality, baseline: a.baseline,
    invitation: `Needs ${amount} more ${unitText}.`,
    take: null, numbers: [], missingInputs: a.missingInputs ?? [],
  };
}

/** Not collected: the field does not exist in the data we hold, so no amount of rounds helps until it is logged. */
export function notCollected<T>(id: string, title: string, missing: string[], invitation: string, baseline: BaselineKind = 'none'): Insight<T> {
  return {
    id, title, status: 'not_collected', value: null, n: 0, nUnit: 'none', nNeeded: 0, confidence: 'insufficient',
    sample: false, quality: 'unknown', baseline, invitation, take: null, numbers: [], missingInputs: missing,
  };
}

export function ready<T>(a: GateArgs, value: T, take: string, numbers: number[], confidence: Confidence): Insight<T> {
  return {
    id: a.id, title: a.title, status: 'ready', value, n: a.n, nUnit: a.nUnit, nNeeded: a.gate[0], confidence,
    sample: a.sample, quality: a.quality, baseline: a.baseline, invitation: null, take, numbers, missingInputs: a.missingInputs ?? [],
  };
}
