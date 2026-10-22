import { describe, expect, it } from 'vitest';
import {
  blendProfiles,
  blendSameMetric,
  displayToYards,
  formatDistance,
  layupDecision,
  parseSimulatorCsv,
  recommend,
  withSameMetricBlends,
  yardsToDisplay,
  type DistanceProfile,
} from '@coopr/engine';

function profile(partial: Partial<DistanceProfile> & Pick<DistanceProfile, 'metric' | 'environment' | 'stockYards'>): DistanceProfile {
  const stock = partial.stockYards;
  return {
    clubId: partial.clubId ?? '7i',
    clubLabel: partial.clubLabel ?? '7-iron',
    environment: partial.environment,
    swingMode: partial.swingMode ?? 'stock',
    metric: partial.metric,
    sampleSize: partial.sampleSize ?? 10,
    p20: partial.p20 ?? stock - 8,
    p50: partial.p50 ?? stock,
    p80: partial.p80 ?? stock + 8,
    iqr: partial.iqr ?? 10,
    mad: partial.mad ?? 4,
    shortMissCount: 0,
    longMissCount: 0,
    shortMissShare: 0,
    longMissShare: 0,
    confidence: partial.confidence ?? 'moderate',
    longestYards: partial.longestYards ?? stock + 12,
    stockYards: stock,
    lateralMiss: partial.lateralMiss ?? 'none',
    blended: false,
    reported: partial.reported ?? false,
    dispersionKnown: partial.dispersionKnown ?? true,
    sampleWarning: null,
  };
}

describe('same-metric blend', () => {
  it('weights course samples double and refuses to mix carry with total', () => {
    const blended = blendSameMetric([
      profile({ environment: 'simulator', metric: 'carry', stockYards: 140, sampleSize: 10 }),
      profile({ environment: 'course', metric: 'carry', stockYards: 150, sampleSize: 10 }),
    ]);
    expect(blended.blended).toBe(true);
    expect(blended.metric).toBe('carry');
    expect(blended.stockYards).toBeCloseTo((140 * 10 + 150 * 20) / 30, 5);
    expect(blended.sampleSize).toBe(20);
    expect(blended.sampleWarning).toMatch(/not a new measurement/);
    expect(() =>
      blendSameMetric([
        profile({ environment: 'simulator', metric: 'carry', stockYards: 140 }),
        profile({ environment: 'course', metric: 'total', stockYards: 150 }),
      ]),
    ).toThrow(/carry into total|total into carry/);
    expect(() => blendProfiles()).toThrow(/blend/i);
  });

  it('keeps confidence limited when the environment medians disagree', () => {
    const blended = blendSameMetric([
      profile({ environment: 'simulator', metric: 'total', stockYards: 140, sampleSize: 12 }),
      profile({ environment: 'course', metric: 'total', stockYards: 170, sampleSize: 12 }),
    ]);
    expect(blended.confidence).toBe('limited');
    expect(blended.sampleWarning).toMatch(/differ by 30/);
    const attached = withSameMetricBlends([
      profile({ environment: 'simulator', metric: 'carry', stockYards: 140 }),
      profile({ environment: 'range', metric: 'carry', stockYards: 142 }),
      profile({ environment: 'simulator', metric: 'total', stockYards: 150 }),
    ]);
    expect(attached.filter((item) => item.blended)).toHaveLength(1);
    expect(attached.find((item) => item.blended)?.metric).toBe('carry');
  });

  it('weights a reported average below a measured sample and does not borrow its dispersion', () => {
    const measured = profile({ environment: 'simulator', metric: 'carry', stockYards: 160, sampleSize: 10, p20: 150, p80: 170 });
    const reported = profile({
      environment: 'course',
      metric: 'carry',
      stockYards: 140,
      sampleSize: 10,
      p20: 140,
      p80: 140,
      reported: true,
      dispersionKnown: false,
    });
    const blended = blendSameMetric([measured, reported]);
    expect(blended.stockYards).toBeCloseTo((160 * 10 + 140 * 5) / 15, 5);
    expect(blended.p20).toBeCloseTo(150, 5);
    expect(blended.p80).toBeCloseTo(170, 5);
    expect(blended.reported).toBe(false);
    expect(blended.sampleWarning).toMatch(/quarter of a COOPR measurement/);
    expect(blended.sampleWarning).toMatch(/no measured dispersion/);
  });

  it('lets the club call use the blend instead of the simulator prior alone', () => {
    const plain = profile({ environment: 'simulator', metric: 'carry', stockYards: 140, clubId: '7i', clubLabel: '7-iron' });
    const course = profile({ environment: 'course', metric: 'carry', stockYards: 160, clubId: '7i', clubLabel: '7-iron' });
    const other = profile({ environment: 'simulator', metric: 'carry', stockYards: 140, clubId: '6i', clubLabel: '6-iron' });
    const blended = blendSameMetric([plain, course]);
    const card = recommend({
      targetDistanceYards: blended.stockYards,
      targetMetric: 'carry',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [plain, course, other, blended],
    });
    expect(card.clubLabel).toBe('7-iron');
    expect(card.lines.reason).toMatch(/blended median/);
    expect(card.lines.reason).toMatch(/20 combined shots/);
  });
});

describe('lay-up from dispersion', () => {
  const carry = { metric: 'carry' as const, sampleSize: 10, p20: 150, p50: 160, p80: 170 };

  it('goes when the short end clears, and lays up when the pattern is short', () => {
    expect(layupDecision({ carry, carryToClearYards: 145 }).call).toBe('go');
    expect(layupDecision({ carry, carryToClearYards: 180 }).call).toBe('lay_up');
    const straddle = layupDecision({ carry, carryToClearYards: 160 });
    expect(straddle.call).toBe('lay_up');
    expect(straddle.reason).toMatch(/not a percentage/);
  });

  it('stays unsure when the carry line or the sample is missing', () => {
    expect(layupDecision({ carry, carryToClearYards: null }).call).toBe('unsure');
    expect(layupDecision({ carry, carryToClearYards: null }).reason).toMatch(/unknown/);
    expect(layupDecision({ carry: { ...carry, sampleSize: 3 }, carryToClearYards: 140 }).call).toBe('unsure');
    expect(layupDecision({ carry: { ...carry, metric: 'total' }, carryToClearYards: 140 }).reason).toMatch(/total is not used/);
  });
});

describe('simulator CSV and display units', () => {
  it('keeps a blank carry null and converts a meter total', () => {
    const result = parseSimulatorCsv('Club,Carry [yds],Total (m),Side\n7-iron,158,150,4\n8-iron,,140,\n,100,100,0\n');
    expect(result.error).toBeNull();
    expect(result.shots).toHaveLength(2);
    expect(result.shots[0]).toMatchObject({ clubLabel: '7-iron', carry: 158, lateralMiss: 'right' });
    expect(result.shots[0]?.total).toBeCloseTo(150 / 0.9144, 5);
    expect(result.shots[1]?.carry).toBeNull();
    expect(result.shots[1]?.total).toBeCloseTo(140 / 0.9144, 5);
    expect(result.warnings.join(' ')).toMatch(/Positive Side/);
  });

  it('refuses a file with no distance column and warns when the unit is absent', () => {
    expect(parseSimulatorCsv('Club,Ball Speed\n7-iron,120\n').error).toMatch(/Carry or Total/);
    const assumed = parseSimulatorCsv('Club,Carry,Total\n7-iron,150,\n');
    expect(assumed.shots[0]).toMatchObject({ carry: 150, total: null });
    expect(assumed.warnings.join(' ')).toMatch(/stored as yards/);
  });

  it('converts display units without touching the stored yards', () => {
    expect(yardsToDisplay(100, 'm')).toBeCloseTo(91.44, 5);
    expect(displayToYards(91.44, 'm')).toBeCloseTo(100, 5);
    expect(formatDistance(160, 'yd')).toBe('160');
    expect(formatDistance(null, 'm')).toBe('—');
  });
});
