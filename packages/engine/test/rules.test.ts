import { describe, expect, it } from 'vitest';
import {
  blendProfiles,
  buildProfiles,
  median,
  orderedLines,
  presentHandicap,
  quantileType7,
  rankByOrganicFit,
  recommend,
  refuseMetricConversion,
  scoreRound,
  narrateScore,
  type DistanceObservation,
  type DistanceProfile,
} from '@coopr/engine';

const FIVE_IRON_TOTALS = [132.8, 80.6, 171.9, 184.7, 119.9, 184.5, 152.2, 184.4, 74.4, 183.0];

function obs(partial: Partial<DistanceObservation> & Pick<DistanceObservation, 'yards' | 'metric'>): DistanceObservation {
  return {
    clubId: partial.clubId ?? 'club',
    clubLabel: partial.clubLabel ?? 'Club',
    environment: partial.environment ?? 'simulator',
    swingMode: partial.swingMode ?? 'stock',
    metric: partial.metric,
    yards: partial.yards,
    qualityLabel: partial.qualityLabel ?? 'unknown',
    aggregation: 'shot',
    lateralMiss: partial.lateralMiss ?? 'none',
  };
}

function profile(partial: Partial<DistanceProfile> & Pick<DistanceProfile, 'metric' | 'p20' | 'p50' | 'p80'>): DistanceProfile {
  return {
    clubId: partial.clubId ?? 'club',
    clubLabel: partial.clubLabel ?? 'Club',
    environment: partial.environment ?? 'simulator',
    swingMode: partial.swingMode ?? 'stock',
    metric: partial.metric,
    sampleSize: partial.sampleSize ?? 10,
    p20: partial.p20,
    p50: partial.p50,
    p80: partial.p80,
    iqr: partial.iqr ?? partial.p80 - partial.p20,
    mad: partial.mad ?? 5,
    shortMissCount: partial.shortMissCount ?? 0,
    longMissCount: partial.longMissCount ?? 0,
    shortMissShare: partial.shortMissShare ?? 0,
    longMissShare: partial.longMissShare ?? 0,
    confidence: partial.confidence ?? 'moderate',
    longestYards: partial.longestYards ?? partial.p80,
    stockYards: partial.stockYards ?? partial.p50,
    lateralMiss: partial.lateralMiss ?? 'none',
    blended: false,
    reported: false,
    dispersionKnown: true,
    sampleWarning: partial.sampleWarning ?? null,
  };
}

describe('totals are not carry', () => {
  it('type-7 median of the founder 5-iron list is 162.05, and that list stays a total', () => {
    expect(median(FIVE_IRON_TOTALS)).toBeCloseTo(162.05, 5);
    expect(quantileType7(FIVE_IRON_TOTALS, 0.2)).toBeCloseTo(112.04, 2);
    expect(quantileType7(FIVE_IRON_TOTALS, 0.8)).toBeCloseTo(184.42, 2);
    const profiles = buildProfiles(FIVE_IRON_TOTALS.map((yards) => obs({ yards, metric: 'total', clubId: '5i', clubLabel: '5-iron' })));
    expect(profiles.find((item) => item.metric === 'carry')).toBeUndefined();
    expect(profiles[0]?.metric).toBe('total');
    expect(profiles[0]?.stockYards).toBeCloseTo(162.05, 5);
    expect(profiles[0]?.stockYards).not.toBe(profiles[0]?.longestYards);
    const seven = profile({
      clubId: '7i',
      clubLabel: '7-iron',
      metric: 'total',
      p20: 148,
      p50: 154,
      p80: 160,
      stockYards: 154,
      sampleSize: 10,
      confidence: 'moderate',
      iqr: 8,
      longestYards: 166,
    });
    const card = recommend({
      targetDistanceYards: 160,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [profiles[0]!, seven],
    });
    expect(card.clubId).toBe('7i');
    expect(card.passedCloser).toMatch(/5-iron/);
    expect(card.passedCloser).toMatch(/scatter/);
    expect(card.lines.reason).toMatch(/only 10 shots|scatter/);
  });

  it('refuses to convert a total into a carry', () => {
    expect(() => refuseMetricConversion('total', 'carry')).toThrow(/total into carry/);
  });
});

describe('stock distance and mishits', () => {
  it('keeps a mishit in the sample and drops only invalid shots', () => {
    const kept = buildProfiles([
      obs({ yards: 150, metric: 'carry' }),
      obs({ yards: 152, metric: 'carry' }),
      obs({ yards: 148, metric: 'carry' }),
      obs({ yards: 151, metric: 'carry' }),
      obs({ yards: 149, metric: 'carry' }),
      obs({ yards: 40, metric: 'carry', qualityLabel: 'mishit' }),
    ]);
    expect(kept[0]?.sampleSize).toBe(6);
    expect(kept[0]?.shortMissCount).toBeGreaterThan(0);
    expect(kept[0]?.stockYards).not.toBe(40);

    const dropped = buildProfiles([
      obs({ yards: 150, metric: 'carry' }),
      obs({ yards: 152, metric: 'carry' }),
      obs({ yards: 148, metric: 'carry' }),
      obs({ yards: 151, metric: 'carry' }),
      obs({ yards: 149, metric: 'carry' }),
      obs({ yards: 40, metric: 'carry', qualityLabel: 'invalid' }),
    ]);
    expect(dropped[0]?.sampleSize).toBe(5);
    expect(dropped[0]?.shortMissCount).toBe(0);
  });

  it('does not blend simulator and course', () => {
    const profiles = buildProfiles([
      ...[1, 2, 3, 4, 5].map((n) => obs({ yards: 140 + n, metric: 'carry', environment: 'simulator' })),
      ...[1, 2, 3, 4, 5].map((n) => obs({ yards: 150 + n, metric: 'carry', environment: 'course' })),
    ]);
    expect(profiles.map((item) => item.environment).sort()).toEqual(['course', 'simulator']);
    expect(profiles.every((item) => item.blended === false)).toBe(true);
    expect(() => blendProfiles()).toThrow(/blend/i);
  });
});

describe('caddie', () => {
  const base = {
    targetDistanceYards: 160,
    targetMetric: 'carry' as const,
    hazards: [] as const,
    intent: 'neutral' as const,
    riskPreference: 'neutral' as const,
    profiles: [
      profile({
        clubId: 'a',
        clubLabel: '7-iron',
        metric: 'carry',
        p20: 150,
        p50: 160,
        p80: 170,
        lateralMiss: 'left' as const,
      }),
    ],
  };

  it('does not aim off the miss pattern', () => {
    const left = recommend({ ...base, profiles: [{ ...base.profiles[0]!, lateralMiss: 'left' }] });
    const right = recommend({ ...base, profiles: [{ ...base.profiles[0]!, lateralMiss: 'right' }] });
    expect(left.recommendedAim).toBe(left.strategicTarget);
    expect(left.recommendedAim).toBe(right.recommendedAim);
    expect(left.strategicTarget).toBe('Center');
    expect(left.mechanicalMissPattern).not.toBe(right.mechanicalMissPattern);
    expect(left.recommendedAim).not.toMatch(/offset|aim \d+/i);
    const hazard = recommend({
      ...base,
      hazards: [{ side: 'right', kind: 'water', carryToClearYards: null }],
      profiles: [{ ...base.profiles[0]!, lateralMiss: 'left' }],
    });
    const hazardOtherMiss = recommend({
      ...base,
      hazards: [{ side: 'right', kind: 'water', carryToClearYards: null }],
      profiles: [{ ...base.profiles[0]!, lateralMiss: 'right' }],
    });
    expect(hazard.recommendedAim).toBe(hazardOtherMiss.recommendedAim);
    expect(hazard.recommendedAim).toMatch(/away from the right water/);
  });

  it('clears a front hazard with carry P20 and will not use a total', () => {
    const totalOnly = profile({
      clubId: 'total-club',
      clubLabel: '5-iron',
      metric: 'total',
      p20: 190,
      p50: 200,
      p80: 210,
      sampleSize: 10,
    });
    const shortCarry = profile({
      clubId: 'short-carry',
      clubLabel: 'Hybrid',
      metric: 'carry',
      p20: 150,
      p50: 180,
      p80: 190,
      sampleSize: 10,
    });
    const clears = profile({
      clubId: 'clears',
      clubLabel: '4-iron',
      metric: 'carry',
      p20: 175,
      p50: 186,
      p80: 195,
      sampleSize: 10,
    });
    const blocked = recommend({
      targetDistanceYards: 174,
      targetMetric: 'carry',
      hazards: [{ side: 'front', kind: 'water', carryToClearYards: 170 }],
      intent: 'play_safe',
      riskPreference: 'conservative',
      profiles: [totalOnly, shortCarry],
    });
    expect(blocked.posture).toBe('decline');
    expect(blocked.clubId).toBeNull();
    expect(blocked.lines.reason).toMatch(/not a carry|carry P20/i);
    expect(blocked.lines.keyRisk.toLowerCase()).toMatch(/water/);

    const allowed = recommend({
      targetDistanceYards: 174,
      targetMetric: 'total',
      hazards: [{ side: 'front', kind: 'water', carryToClearYards: 170 }],
      intent: 'play_safe',
      riskPreference: 'neutral',
      profiles: [totalOnly, clears],
    });
    expect(allowed.clubId).toBe('clears');
    expect(allowed.metricUsed).toBe('carry');
    expect(allowed.expectedTotal).toBeNull();
  });

  it('declines when the sample is too small and does not print a fake probability', () => {
    const thin = buildProfiles([100, 101, 102].map((yards) => obs({ yards, metric: 'carry', clubLabel: '8-iron' })));
    const card = recommend({
      targetDistanceYards: 100,
      targetMetric: 'carry',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: thin,
    });
    expect(card.posture).toBe('decline');
    expect(card.clubId).toBeNull();
    expect(card.lines.reason).toMatch(/too small|n=3/);
    expect(orderedLines(card).join('\n')).not.toMatch(/\d+(\.\d+)?%/);
    const labels = orderedLines(card).map((line) => line.split(':')[0]);
    expect(labels.slice(0, 7)).toEqual(['Distance', 'Club', 'Swing', 'Target', 'Expected', 'Risk', 'Reason']);
  });

  it('keeps the hazard line when the personality is funny', () => {
    const request = {
      targetDistanceYards: 160,
      targetMetric: 'carry' as const,
      hazards: [{ side: 'front' as const, kind: 'bunker', carryToClearYards: 150 }],
      intent: 'neutral' as const,
      riskPreference: 'neutral' as const,
      profiles: [profile({ metric: 'carry', p20: 155, p50: 160, p80: 168, sampleSize: 12, confidence: 'moderate' as const })],
    };
    const funny = recommend({ ...request, personality: 'funny_knowledgeable' });
    const direct = recommend({ ...request, personality: 'direct_analytical' });
    expect(funny.lines.keyRisk).toBe(direct.lines.keyRisk);
    expect(funny.lines.keyRisk.toLowerCase()).toMatch(/bunker/);
    expect(funny.clubId).toBe(direct.clubId);
    expect(funny.lines.reason.startsWith('The joke can wait.')).toBe(true);
    expect(funny.lines.reason).toContain(direct.lines.reason);
  });
});

describe('scoring', () => {
  it('sums hole scores without reading narrative text', () => {
    const holes = [5, 4, 9, 5, 8, 5, 5, 4, 7, 6, 4, 5, 5, 5, 6, 8, 6, 8].map((strokes, index) => ({
      hole: index + 1,
      strokes,
    }));
    const score = scoreRound(holes);
    expect(score).toMatchObject({ gross: 105, front: 52, back: 53 });
    expect(narrateScore(score, 'The caddie says you shot 72').score.gross).toBe(105);
  });

  it('never presents an estimate as an official GHIN index', () => {
    expect(presentHandicap({ value: 18, official: false })).toMatch(/not an official GHIN Handicap Index/);
    expect(presentHandicap({ value: null, official: false })).toBe('Handicap: unknown');
  });
});

describe('organic ranking', () => {
  it('is unchanged when a sponsor flag flips', () => {
    const rows = [
      { id: 'a', organicScore: 2, sponsored: false },
      { id: 'b', organicScore: 5, sponsored: false },
      { id: 'c', organicScore: 3, sponsored: true },
    ];
    const before = rankByOrganicFit(rows);
    const after = rankByOrganicFit(rows.map((row) => ({ ...row, sponsored: !row.sponsored })));
    expect(after).toEqual(before);
    expect(before).toEqual(['b', 'c', 'a']);
  });
});
