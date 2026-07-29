// Robust, nonparametric statistics. Pure and deterministic — no clock, no randomness.
// These are the primitives the club-profile engine uses so that mishits inform risk
// but never set the stock distance.

/** Sorted ascending copy. Does not mutate input. */
export function sortedAsc(xs: readonly number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

/**
 * Quantile via Hyndman-Fan type 7 (the R / NumPy default): linear interpolation
 * between order statistics. Reproducible and library-independent.
 * @param p probability in [0,1]
 */
export function quantile(xs: readonly number[], p: number): number {
  if (xs.length === 0) throw new Error('quantile of empty sample');
  const s = sortedAsc(xs);
  const n = s.length;
  if (n === 1) return s[0]!;
  const clamped = Math.min(1, Math.max(0, p));
  const h = (n - 1) * clamped;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const frac = h - lo;
  return s[lo]! + frac * (s[hi]! - s[lo]!);
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('mean of empty sample');
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/** Interquartile range (Q3 - Q1), an outlier-robust spread. */
export function iqr(xs: readonly number[]): number {
  return quantile(xs, 0.75) - quantile(xs, 0.25);
}

/** Median absolute deviation from the median (raw, not normal-scaled). */
export function mad(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('mad of empty sample');
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Monotone piecewise-linear CDF estimate from the P20/P50/P80 anchors, with linear
 * extrapolation on the end segments clamped to [0,1]. Used to estimate the chance a
 * shot falls short of (or long of) a distance — a Phase-1 risk proxy, explicitly an
 * approximation, not a fitted distribution.
 */
export function cdfFromQuantiles(
  q: { p20: number; p50: number; p80: number },
  x: number,
): number {
  const pts: Array<[number, number]> = [
    [q.p20, 0.2],
    [q.p50, 0.5],
    [q.p80, 0.8],
  ];
  // Degenerate spread: step at the point.
  if (q.p20 === q.p80) return x < q.p50 ? 0 : 1;

  if (x <= pts[0]![0]) {
    const [x0, y0] = pts[0]!;
    const [x1, y1] = pts[1]!;
    const slope = (y1 - y0) / (x1 - x0);
    return clamp01(y0 + slope * (x - x0));
  }
  if (x >= pts[2]![0]) {
    const [x0, y0] = pts[1]!;
    const [x1, y1] = pts[2]!;
    const slope = (y1 - y0) / (x1 - x0);
    return clamp01(y1 + slope * (x - x1));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y1;
      return clamp01(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
    }
  }
  return clamp01(0.5);
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
