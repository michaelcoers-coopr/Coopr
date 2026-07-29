import { describe, it, expect } from 'vitest';
import {
  seedShots, seedClubs, seedClubFeedback, MIURA_48_AGGREGATE, VALIDATION_REQUIRED_SESSIONS,
} from '@coopr/core';
import { buildAllProfiles } from '../src/club-profile';
import { analyzeBag } from '../src/bag-intelligence';

const profiles = buildAllProfiles(seedShots, { validationRequiredSessions: VALIDATION_REQUIRED_SESSIONS });
const bag = analyzeBag({
  profiles,
  clubs: seedClubs,
  knownDistances: [
    { clubId: 'c-w48', clubLabel: '48°', carryYards: MIURA_48_AGGREGATE.usableStrikeAverageCarry, source: 'aggregate' },
  ],
  feedback: seedClubFeedback.map((f) => ({ clubId: f.clubId, confidence: f.confidence, note: f.note })),
});

const report = (id: string) => bag.clubReports.find((r) => r.clubId === id)!;

describe('Bag Intelligence — seed validation', () => {
  it('flags the 5-iron poor floor as a test candidate', () => {
    expect(report('c-5i').status).toBe('test');
    expect(report('c-5i').reasons[0]).toMatch(/floor|forgiving/i);
    expect(bag.insights.some((i) => i.code === 'poor_floor' && i.clubIds.includes('c-5i'))).toBe(true);
  });

  it('detects the AW 49°/Miura 48° overlap and marks the aggregate-only 48° for removal', () => {
    const overlap = bag.gaps.find(
      (g) => g.kind === 'overlap' &&
        ((g.longerClubId === 'c-aw' && g.shorterClubId === 'c-w48') ||
         (g.longerClubId === 'c-w48' && g.shorterClubId === 'c-aw')),
    );
    expect(overlap).toBeDefined();
    expect(report('c-w48').status).toBe('remove');
  });

  it('surfaces the 8i/9i inversion', () => {
    const inv = bag.gaps.find((g) => g.kind === 'inversion' && g.longerClubId === 'c-8i' && g.shorterClubId === 'c-9i');
    expect(inv).toBeDefined();
    expect(bag.insights.some((i) => i.code === 'inversion')).toBe(true);
  });

  it('surfaces the hybrid subjective edge (4H highest by feel)', () => {
    const fb = bag.insights.find((i) => i.code === 'feedback_spread' && i.clubIds.includes('c-4h'));
    expect(fb).toBeDefined();
  });

  it('reports no measured data for the hybrids', () => {
    expect(report('c-2h').status).toBe('gather_data');
    expect(report('c-4h').evidence).toBe('none');
  });

  it('produces an ideal-bag summary with a carry count', () => {
    expect(bag.idealBag.length).toBeGreaterThan(0);
    expect(bag.carryCount).toBeGreaterThan(0);
    expect(bag.carryCount).toBeLessThanOrEqual(bag.idealBag.length);
  });

  it('is deterministic', () => {
    const again = analyzeBag({
      profiles,
      clubs: seedClubs,
      knownDistances: [{ clubId: 'c-w48', clubLabel: '48°', carryYards: MIURA_48_AGGREGATE.usableStrikeAverageCarry, source: 'aggregate' }],
      feedback: seedClubFeedback.map((f) => ({ clubId: f.clubId, confidence: f.confidence, note: f.note })),
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(bag));
  });
});
