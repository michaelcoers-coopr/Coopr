import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bagGaps, verdict, type FitClub, type FitProfile } from '../src/bag-fit';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

interface SampleFile {
  clubs: FitClub[];
  types_user_picked: Record<string, string>;
}

interface ProfileFile {
  A: FitProfile;
  B: FitProfile;
}

describe('bag fit engine', () => {
  const bag = JSON.parse(readFileSync(join(fixtures, 'sample_bag.json'), 'utf8')) as SampleFile;
  const profiles = JSON.parse(readFileSync(join(fixtures, 'sample_profiles.json'), 'utf8')) as ProfileFile;
  const expected = JSON.parse(readFileSync(join(fixtures, 'expected_outputs.json'), 'utf8')) as {
    gaps: ReturnType<typeof bagGaps>;
    verdicts: { A: Record<string, ReturnType<typeof verdict>>; B: Record<string, ReturnType<typeof verdict>> };
  };

  it('matches the reference gaps and both sample profiles', () => {
    const clubs = bag.clubs;
    const picked = bag.types_user_picked;
    const verdicts: { A: Record<string, ReturnType<typeof verdict>>; B: Record<string, ReturnType<typeof verdict>> } = { A: {}, B: {} };
    for (const key of ['A', 'B'] as const) {
      for (const club of clubs) {
        if (!club.in_play) continue;
        verdicts[key][club.id] = verdict(club, profiles[key], clubs, picked);
      }
    }
    expect({ gaps: bagGaps(clubs), verdicts }).toEqual(expected);
  });
});
