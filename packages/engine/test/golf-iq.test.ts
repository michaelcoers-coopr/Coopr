import { describe, it, expect } from 'vitest';
import { seedShots, seedClubs, VALIDATION_REQUIRED_SESSIONS } from '@coopr/core';
import { buildAllProfiles } from '../src/club-profile';
import { assessGolfIq } from '../src/golf-iq';

const profiles = buildAllProfiles(seedShots, { validationRequiredSessions: VALIDATION_REQUIRED_SESSIONS });
const assessment = assessGolfIq(profiles, seedClubs);

describe('Golf IQ assessment', () => {
  it('produces a bounded overall score and grade', () => {
    expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(100);
    expect(typeof assessment.grade).toBe('string');
    expect(assessment.components).toHaveLength(5);
    for (const c of assessment.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it('detects the 8i/9i gapping inversion instead of smoothing it', () => {
    const inversion = assessment.gapAnomalies.find(
      (a) => a.kind === 'inversion' && a.longerClubId === 'c-8i' && a.shorterClubId === 'c-9i',
    );
    expect(inversion).toBeDefined();
    expect(inversion!.gapYards).toBeGreaterThan(0); // 9i actually carries farther
  });

  it('ranks practice priorities by scoring leak', () => {
    expect(assessment.practicePriorities.length).toBeGreaterThan(0);
    // Sorted descending by leak.
    for (let i = 1; i < assessment.practicePriorities.length; i++) {
      expect(assessment.practicePriorities[i - 1]!.leakScore).toBeGreaterThanOrEqual(
        assessment.practicePriorities[i]!.leakScore,
      );
    }
    // The 5i or 6i (severe short-miss) should surface as a top leak.
    const topIds = assessment.practicePriorities.map((p) => p.clubId);
    expect(topIds.includes('c-5i') || topIds.includes('c-6i')).toBe(true);
  });

  it('reports honest baseline coverage', () => {
    expect(assessment.coverage).toHaveLength(4);
    expect(assessment.baselineCompleteness).toBeGreaterThan(0);
    expect(assessment.baselineCompleteness).toBeLessThanOrEqual(1);
    // No woods/hybrid shots in the seed → that category is not adequate.
    const wh = assessment.coverage.find((c) => c.category === 'woods_hybrids')!;
    expect(wh.adequate).toBe(false);
  });

  it('surfaces a priority insight first and leads with a disclaimer set', () => {
    expect(assessment.insights.length).toBeGreaterThan(0);
    expect(assessment.insights[0]!.severity).toBe('priority');
    expect(assessment.disclaimers.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const again = assessGolfIq(buildAllProfiles(seedShots, { validationRequiredSessions: VALIDATION_REQUIRED_SESSIONS }), seedClubs);
    expect(JSON.stringify(again)).toBe(JSON.stringify(assessment));
  });
});
