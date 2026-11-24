import { syntheticRangeShots, syntheticSeason } from '@coopr/analysis/fixtures/synthetic';
import type { RoundInput, ShotInput } from '@coopr/analysis';

/** Founder and local builds only. Metro swaps this file out when founder tools are off. */
export function sampleBundle(): { rounds: RoundInput[]; shots: ShotInput[] } {
  const season = syntheticSeason();
  return {
    rounds: season.map((item) => item.round),
    shots: [...season.flatMap((item) => item.shots), ...syntheticRangeShots()],
  };
}
