/**
 * COOPR Analysis engine: input schema + result envelope.
 *
 * Rules inherited from COOPR DATA_MODEL: unknown is null (never 0 as a placeholder),
 * carry and total are never blended, a GPS distance-to-center is not a shot.
 * Distances are yards, putts are counts, putt distances are feet.
 */

export type Quality = 'measured' | 'user_confirmed' | 'estimated' | 'derived' | 'provisional' | 'unknown';
export type Confidence = 'insufficient' | 'limited' | 'moderate' | 'solid';
export type Environment = 'course' | 'range' | 'simulator';
export type Lie = 'tee' | 'fairway' | 'rough' | 'sand' | 'green' | 'fringe' | 'recovery' | 'other';
export type FairwayResult = 'hit' | 'left' | 'right' | 'short' | 'long';
export type PressureTag = 'break_target' | 'game_on_the_line' | 'closing_hole';

export interface HoleInput {
  number: number;
  par: number | null;
  yards: number | null;
  strokeIndex: number | null;
  /** null = not played or no score entered. A pickup with no number is null, not 0. */
  strokes: number | null;
  putts: number | null;
  penalties: number | null;
  /** null on par 3s and whenever the player did not log it. */
  fairway: FairwayResult | null;
  gir: boolean | null;
  firstPuttFeet: number | null;
  teeClub: string | null;
  /** Set by the capture layer or by tagBreakTargetPressure(). Empty = not a pressure hole. */
  pressure: PressureTag[];
  /** Fictitious Birdie Bucks won (+) or lost (-) on this hole. Points, never money. null = no game. */
  bbNet: number | null;
}

export interface RoundInput {
  id: string;
  /** YYYY-MM-DD, the date from the source (not a sync clock). */
  playedOn: string;
  courseId: string | null;
  courseName: string;
  teeName: string | null;
  startPeriod: 'am' | 'pm' | null;
  format: 'solo' | 'game' | 'tournament' | null;
  /** Player's own goal for the round (e.g. 90). null = not set; break-target pressure is then off. */
  targetScore: number | null;
  holes: HoleInput[];
  /** True for demo / synthetic / fixture data. Any insight touching it carries the SAMPLE label. */
  isSample: boolean;
  quality: Quality;
}

export interface ShotInput {
  id: string;
  roundId: string | null;
  environment: Environment;
  hole: number | null;
  /** 1-based order within the hole. */
  seq: number | null;
  club: string;
  startLie: Lie | null;
  startDistToPinYds: number | null;
  endLie: Lie | 'holed' | null;
  endDistToPinYds: number | null;
  /** Penalty strokes added by this shot (OB = 1 plus the re-hit counts as its own shot). */
  penaltyStrokes: number;
  /** Carry only. Total is never converted into carry. */
  carryYds: number | null;
  totalYds: number | null;
  carryQuality: Quality;
  /** Landing offset from the target line. + = right of target. null = not measured. */
  lateralYds: number | null;
  /** Landing offset along the line vs the intended carry. + = long. null = not measured. */
  longitudinalYds: number | null;
  isSample: boolean;
}

export interface Bag {
  /** Club ids in any order, <= 14 for an in-play bag. */
  clubs: string[];
}

export type InsightStatus = 'ready' | 'needs_more' | 'not_collected';
export type BaselineKind = 'par_allotment' | 'own_average' | 'handicap_band' | 'tour' | 'none';

/**
 * Envelope every insight returns. A number is only ever in `value` when status === 'ready'.
 * When it is not ready the UI shows `invitation`, never a placeholder figure.
 */
export interface Insight<T> {
  id: string;
  title: string;
  status: InsightStatus;
  value: T | null;
  /** How many units of evidence we hold, and which unit (holes, rounds, shots...). */
  n: number;
  nUnit: string;
  /** Minimum n before this insight shows. */
  nNeeded: number;
  confidence: Confidence;
  /** Show the red SAMPLE chip. True if any contributing row is sample/synthetic. */
  sample: boolean;
  /** Weakest data quality among contributing inputs. */
  quality: Quality;
  baseline: BaselineKind;
  /** Shown when not ready: what to log / how many more rounds. */
  invitation: string | null;
  /** Plain, irreverent, honest. null unless ready. Every number inside is in `numbers`. */
  take: string | null;
  /** Location-free version of `take` for share cards (no course names). Falls back to `take` when the take has no location. */
  shareTake?: string;
  /** Whitelist of numbers the take/card may print (grounding guard). */
  numbers: number[];
  /** Fields COOPR does not collect (yet) that this insight needs. */
  missingInputs: string[];
}

export interface Config {
  /** Strokes allotted to putting on a par: the "2-putt par" convention. A stated rule, not a statistic. */
  putAllotment: number;
  gate: Record<string, [limited: number, moderate: number, solid: number]>;
  backNine: { minMeanStrokes: number; minShareWorse: number };
  pressure: { bankMin: number; bankMax: number; minHolesRemaining: number; zForCall: number };
  gaps: { bigGapMultiple: number; bigGapMinYds: number; overlapFracOfMedian: number; overlapMaxYds: number; shortMissFrac: number };
  ellipseChi2: number;
  aimOffset: { minYds: number; minZ: number };
  sg: { aroundGreenYds: number; minBucket: number; minRoundsSelf: number; minShotsPerCategory: number };
  yardageBands: Record<'par3' | 'par4' | 'par5', number[]>;
  fixability: Record<string, number>;
  confidenceWeight: Record<Confidence, number>;
}

/** Output of the "where you lose strokes" ledger. */
export interface LedgerItem {
  id: 'penalties' | 'putting' | 'ttg_par3' | 'ttg_par4' | 'ttg_par5' | 'ttg_fw_miss' | 'ttg_miss_green' | 'ttg_gir';
  label: string;
  /** Signed strokes per 18 holes. + = lost vs the stated allotment, - = gained. */
  strokesPer18: number;
  holes: number;
}
