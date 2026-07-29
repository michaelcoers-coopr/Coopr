import { describe, it, expect } from 'vitest';
import {
  seedShots,
  VALIDATION_REQUIRED_SESSIONS,
  makeShot,
  type Shot,
} from '@coopr/core';
import { buildAllProfiles, buildClubProfile } from '../src/club-profile';

const profiles = buildAllProfiles(seedShots, {
  validationRequiredSessions: VALIDATION_REQUIRED_SESSIONS,
});
const byClub = (id: string) => profiles.find((p) => p.clubId === id)!;

describe('seed 5-iron — the validation gate', () => {
  const p = byClub('c-5i');

  it('does NOT report a ~185 stock carry', () => {
    expect(p.stockDistanceYards).toBeLessThan(175);
    expect(p.stockDistanceYards).toBeGreaterThan(150);
    expect(p.stockDistanceYards).toBeCloseTo(162, 0);
  });

  it('expresses severe short-miss variability', () => {
    expect(p.total).not.toBeNull();
    const spread = p.total!.p80 - p.total!.p20;
    expect(spread).toBeGreaterThan(60); // ~72 yd P20-P80
    expect(p.shortMissRate).toBeGreaterThanOrEqual(0.3);
    expect(p.total!.p20).toBeLessThan(120);
    expect(p.total!.p80).toBeGreaterThan(180);
  });

  it('is total-backed with carry left null (never fabricated)', () => {
    expect(p.metric).toBe('total');
    expect(p.carry).toBeNull();
  });
});

describe('seed profiles — reliability contrasts', () => {
  it('AW is tighter and more confident than the 5i', () => {
    const aw = byClub('c-aw');
    const five = byClub('c-5i');
    expect(aw.dispersion.iqrYards).toBeLessThan(five.dispersion.iqrYards);
    expect(aw.confidence).toBeGreaterThan(five.confidence);
  });

  it('driver stock is the conservative ~186 carry, not 220', () => {
    const d = byClub('c-driver');
    expect(d.metric).toBe('carry');
    expect(d.stockDistanceYards).toBeGreaterThan(180);
    expect(d.stockDistanceYards).toBeLessThan(200);
  });

  it('flags the 8-iron session for validation', () => {
    expect(byClub('c-8i').validationRequired).toBe(true);
    expect(byClub('c-7i').validationRequired).toBe(false);
  });

  it('surfaces the 8i/9i inverted gap rather than smoothing it', () => {
    // Data quality anomaly: 9i median exceeds 8i median. The engine must not hide it.
    expect(byClub('c-9i').stockDistanceYards).toBeGreaterThan(byClub('c-8i').stockDistanceYards);
  });
});

describe('robustness invariant', () => {
  it('adding a short mishit never raises the stock distance', () => {
    const fiveShots = seedShots.filter((s) => s.clubId === 'c-5i');
    const before = buildClubProfile(fiveShots).stockDistanceYards;
    const mishit: Shot = makeShot('extra-chunk', 'seed-user-001', {
      clubId: 'c-5i',
      clubLabel: '5i',
      sessionId: 'sess-founding-irons',
      sessionDate: fiveShots[0]!.sessionDate,
      environment: 'simulator',
      swingMode: 'stock',
      totalYards: 28, // a chunk
    });
    const after = buildClubProfile([...fiveShots, mishit]).stockDistanceYards;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('excludes only invalid shots, keeps mishits', () => {
    const fiveShots = seedShots.filter((s) => s.clubId === 'c-5i');
    const invalid: Shot = makeShot('bad-read', 'seed-user-001', {
      clubId: 'c-5i',
      clubLabel: '5i',
      sessionId: 'sess-founding-irons',
      sessionDate: fiveShots[0]!.sessionDate,
      environment: 'simulator',
      swingMode: 'stock',
      totalYards: 9999,
      qualityLabel: 'invalid',
    });
    const withInvalid = buildClubProfile([...fiveShots, invalid]);
    expect(withInvalid.sampleSize).toBe(fiveShots.length); // invalid dropped
  });
});
