import { describe, it, expect } from 'vitest';
import { quantile, median, iqr, mad, cdfFromQuantiles } from '../src/stats';

describe('quantile (Hyndman-Fan type 7)', () => {
  const xs = [74.4, 80.6, 119.9, 132.8, 152.2, 171.9, 183.0, 184.4, 184.5, 184.7];

  it('matches known type-7 values', () => {
    expect(quantile(xs, 0.5)).toBeCloseTo(162.05, 2);
    expect(quantile(xs, 0.2)).toBeCloseTo(112.04, 2);
    expect(quantile(xs, 0.8)).toBeCloseTo(184.42, 2);
  });

  it('median agrees with quantile 0.5', () => {
    expect(median(xs)).toBeCloseTo(quantile(xs, 0.5), 10);
  });

  it('handles single-element and clamps p', () => {
    expect(quantile([42], 0.9)).toBe(42);
    expect(quantile(xs, -1)).toBe(Math.min(...xs));
    expect(quantile(xs, 2)).toBe(Math.max(...xs));
  });

  it('iqr and mad are non-negative', () => {
    expect(iqr(xs)).toBeGreaterThan(0);
    expect(mad(xs)).toBeGreaterThan(0);
  });
});

describe('cdfFromQuantiles', () => {
  const q = { p20: 140, p50: 155, p80: 168 };

  it('is monotonic non-decreasing', () => {
    let prev = -1;
    for (let x = 100; x <= 210; x += 2) {
      const c = cdfFromQuantiles(q, x);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      prev = c;
    }
  });

  it('passes through the anchor probabilities', () => {
    expect(cdfFromQuantiles(q, 140)).toBeCloseTo(0.2, 6);
    expect(cdfFromQuantiles(q, 155)).toBeCloseTo(0.5, 6);
    expect(cdfFromQuantiles(q, 168)).toBeCloseTo(0.8, 6);
  });
});
