import type { Bag, Config, Insight, RoundInput, ShotInput } from './types';
import { DEFAULT_CONFIG } from './gate';
import { ledger, blowups, scoringByHoleType, threePutts, fairways, greensInRegulation, scrambling, penaltyLeaks, backNineFade, pressureHoles, timeSplits, nemesisHoles, tagBreakTargetPressure } from './holes';
import { clubGapping, dispersion, strokesGained, type Baseline, type DefaultCarryFn } from './shots';
import { rankLosses, selectOneFix, type FixId } from './fix';

export * from './types';
export * from './gate';
export * from './stats';
export * from './holes';
export * from './shots';
export * from './fix';
export * from './cards';
export * from './integration';
export * from './share';

export interface AnalyzeInput {
  rounds: readonly RoundInput[];
  shots?: readonly ShotInput[];
  bag?: Bag | null;
  /** From club-distances (default carry for the player's flex). Display + delta only; never feeds a measured number. */
  defaultCarry?: DefaultCarryFn;
  /** Optional tour / handicap-band baseline. Absent = COOPR-relative only. */
  baseline?: Baseline | null;
  config?: Config;
  lastFix?: { id: FixId; strokesPer18: number } | null;
  /** Test baselines are flagged synthetic. They throw unless this is true, so they can never reach a user screen. */
  allowSyntheticBaseline?: boolean;
}

export function analyze(input: AnalyzeInput) {
  const cfg = input.config ?? DEFAULT_CONFIG;
  if (input.baseline?.synthetic && !input.allowSyntheticBaseline) throw new Error('Synthetic baseline refused: test data cannot reach a user.');
  const rounds = input.rounds.map((r) => tagBreakTargetPressure(r, cfg));
  const shots = input.shots ?? [];
  const L = ledger(rounds, cfg);
  const B = blowups(rounds, cfg);
  const T = threePutts(rounds, cfg);
  const P = penaltyLeaks(rounds, cfg);
  const F = fairways(rounds, cfg);
  const sg = strokesGained(shots, rounds, input.baseline ?? null, cfg);
  return {
    ledger: L, blowups: B, threePutt: T, penalties: P, fairways: F,
    scoringByHoleType: scoringByHoleType(rounds, cfg),
    gir: greensInRegulation(rounds, cfg),
    scrambling: scrambling(rounds, cfg),
    backNine: backNineFade(rounds, cfg),
    pressure: pressureHoles(rounds, cfg),
    timeSplits: timeSplits(rounds, cfg),
    nemesis: nemesisHoles(rounds, cfg),
    gapping: clubGapping(shots, input.bag?.clubs ?? null, input.defaultCarry ?? (() => null), cfg),
    dispersion: dispersion(shots, cfg),
    strokesGained: sg,
    ranking: rankLosses(L, sg),
    oneFix: selectOneFix({ ledger: L, blowups: B, threePutt: T, penalties: P, fairways: F, lastFix: input.lastFix ?? null }, cfg),
    meta: { rounds: rounds.length, shots: shots.length, sample: rounds.some((r) => r.isSample) || shots.some((s) => s.isSample) },
  };
}
export type Analysis = ReturnType<typeof analyze>;
export type { Insight };
