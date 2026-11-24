import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bagGaps, flexApplies, flexCheck, verdict, type FitClub, type FitProfile } from '../src/bag-fit';

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

  it('withholds flex from woods, hybrids, wedges, and putters', () => {
    const profile: FitProfile = { handicap_index: 24, handicap_quality: 'sample', driver_speed_mph: 78, speed_quality: 'sample' };
    for (const type of ['fairway wood', 'hybrid', 'wedge', 'putter']) {
      expect(flexApplies(type)).toBe(false);
      const check = flexCheck({ id: type, slot: type, in_play: true, type, loft: 20, flex: 'S' }, profile);
      expect(check.status).toBe('unknown');
      expect(check.why).toContain('no fit rule');
      const result = verdict({ id: type, slot: type, in_play: true, type, loft: 20, flex: 'S' }, profile, [], {});
      expect(result.verdict).toBe('CANT_TELL');
    }
    expect(flexApplies('iron')).toBe(true);
    expect(flexApplies('driver')).toBe(true);
    const iron = flexCheck({ id: '7', slot: '7', in_play: true, type: 'iron', loft: 30, flex: 'S' }, profile);
    expect(iron.status).toBe('mismatch');
    expect(iron.why).toContain('2 step(s) off');
    const wild = flexCheck(
      { id: '7', slot: '7', in_play: true, type: 'iron', loft: 30, flex: 'S' },
      { ...profile, driver_speed_mph: Number.POSITIVE_INFINITY },
    );
    expect(wild.status).toBe('unknown');
    expect(wild.why).not.toMatch(/Infinity/);
  });
});
