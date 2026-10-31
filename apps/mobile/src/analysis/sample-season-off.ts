import type { RoundInput, ShotInput } from '@coopr/analysis';

/** Friends and production builds. No synthetic season is bundled. */
export function sampleBundle(): { rounds: RoundInput[]; shots: ShotInput[] } | null {
  return null;
}
