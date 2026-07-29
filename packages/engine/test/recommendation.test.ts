import { describe, it, expect } from 'vitest';
import type { ClubProfile, RecommendationInput, Conditions } from '@coopr/core';
import { recommend } from '../src/recommendation';
import { playsLikeDistance } from '../src/conditions';

function profile(over: Partial<ClubProfile> & Pick<ClubProfile, 'clubId' | 'clubLabel' | 'stockDistanceYards'>): ClubProfile {
  return {
    swingMode: 'stock',
    environment: 'simulator',
    metric: 'total',
    sampleSize: 12,
    carry: null,
    total: null,
    goodStrikeDistanceYards: null,
    goodStrikeSource: null,
    dispersion: { madYards: 8, iqrYards: 14 },
    lateral: null,
    shortMissRate: 0.15,
    longMissRate: 0.1,
    mishitRate: 0.2,
    confidence: 0.6,
    recencyDays: null,
    validationRequired: false,
    ...over,
  };
}

// A 7i that reaches 158 on stock but has a short-miss tail into a 150-yd front hazard.
const sevenIron = profile({
  clubId: 'c-7i',
  clubLabel: '7i',
  stockDistanceYards: 155,
  total: { p20: 140, p50: 155, p80: 168 },
  shortMissRate: 0.3,
});
// A 6i that clears the hazard comfortably.
const sixIron = profile({
  clubId: 'c-6i',
  clubLabel: '6i',
  stockDistanceYards: 165,
  total: { p20: 152, p50: 165, p80: 178 },
  shortMissRate: 0.15,
});

const calmFairway: Conditions = { lie: 'fairway', wind: null, elevationDeltaYards: null, temperatureF: null };

function input(over: Partial<RecommendationInput>): RecommendationInput {
  return {
    targetDistanceYards: 158,
    targetMetric: 'total',
    conditions: calmFairway,
    hazards: [],
    intent: 'attack_pin',
    riskPreference: 'neutral',
    profiles: [sevenIron, sixIron],
    ...over,
  };
}

describe('the golden rule — lowest expected score, not maximum distance', () => {
  it('with a front hazard, picks the safer longer club that clears it', () => {
    const rec = recommend(input({ hazards: [{ side: 'front', kind: 'water', distanceYards: 150 }] }));
    expect(rec.clubLabel).toBe('6i');
    expect(rec.shortRisk === 'low' || rec.shortRisk === 'moderate').toBe(true);
  });

  it('with no hazard, picks the on-distance club', () => {
    const rec = recommend(input({ hazards: [] }));
    expect(rec.clubLabel).toBe('7i');
  });
});

describe('aiming philosophy — three separate fields', () => {
  it('recommendedAim always equals strategicTarget, even with a mechanical miss pattern', () => {
    const biased = profile({
      clubId: 'c-6i',
      clubLabel: '6i',
      stockDistanceYards: 158,
      total: { p20: 146, p50: 158, p80: 170 },
      lateral: { leftYards: 8, rightYards: 20, biasNote: 'Wider right-side miss zone.' },
    });
    const rec = recommend(input({ profiles: [biased] }));
    expect(rec.mechanicalMissPattern).toBe('Wider right-side miss zone.');
    expect(rec.recommendedAim).toBe(rec.strategicTarget);
    // The aim is a target, never an "aim N yards left" compensation string.
    expect(rec.recommendedAim.toLowerCase()).not.toContain('aim');
  });
});

describe('determinism', () => {
  it('same input yields byte-identical output', () => {
    const i = input({ hazards: [{ side: 'front', kind: 'bunker', distanceYards: 150 }] });
    expect(JSON.stringify(recommend(i))).toBe(JSON.stringify(recommend(i)));
  });
});

describe('metric mismatch is surfaced, not hidden', () => {
  it('flags when a carry target is answered from total-backed data', () => {
    const rec = recommend(input({ targetMetric: 'carry' }));
    expect(rec.metricMismatch).toBe(true);
    expect(rec.reasons.some((r) => r.code === 'metric_mismatch')).toBe(true);
  });
});

describe('conditions plays-like is monotonic', () => {
  it('headwind never shortens, tailwind never lengthens', () => {
    const base = playsLikeDistance(150, calmFairway).playsLikeYards;
    const head = playsLikeDistance(150, { ...calmFairway, wind: { speedMph: 10, direction: 'head' } }).playsLikeYards;
    const tail = playsLikeDistance(150, { ...calmFairway, wind: { speedMph: 10, direction: 'tail' } }).playsLikeYards;
    expect(head).toBeGreaterThan(base);
    expect(tail).toBeLessThan(base);
  });

  it('cold air plays longer than warm', () => {
    const cold = playsLikeDistance(150, { ...calmFairway, temperatureF: 40 }).playsLikeYards;
    const warm = playsLikeDistance(150, { ...calmFairway, temperatureF: 90 }).playsLikeYards;
    expect(cold).toBeGreaterThan(warm);
  });
});
