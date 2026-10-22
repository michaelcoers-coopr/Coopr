/**
 * Hyndman–Fan type 7 quantile: h = (n − 1) · p, linear interpolation between
 * order statistics. This is the published definition used by R and NumPy.
 * Reimplemented here from that definition. It is not a port of the v1 function.
 */
export function quantileType7(values: readonly number[], p: number): number {
  if (values.length === 0) throw new Error('quantile of an empty sample');
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const only = sorted[0];
  if (n === 1) {
    if (only === undefined) throw new Error('quantile of an empty sample');
    return only;
  }
  const probability = Math.min(1, Math.max(0, p));
  const h = (n - 1) * probability;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const lower = sorted[lo];
  const upper = sorted[hi];
  if (lower === undefined || upper === undefined) throw new Error('quantile index');
  return lower + (h - lo) * (upper - lower);
}

export function median(values: readonly number[]): number {
  return quantileType7(values, 0.5);
}

export function iqr(values: readonly number[]): number {
  return quantileType7(values, 0.75) - quantileType7(values, 0.25);
}

/** Median absolute deviation from the median. Not scaled to a normal sigma. */
export function mad(values: readonly number[]): number {
  if (values.length === 0) throw new Error('mad of an empty sample');
  const mid = median(values);
  return median(values.map((value) => Math.abs(value - mid)));
}

export function longest(values: readonly number[]): number {
  if (values.length === 0) throw new Error('longest of an empty sample');
  return values.reduce((max, value) => (value > max ? value : max), values[0]!);
}
