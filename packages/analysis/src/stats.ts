/** Small, dependency-free statistics. Every function is deterministic. */

export function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}
export function mean(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : sum(xs) / xs.length;
}
/** Sample standard deviation (n-1). null for n < 2. */
export function sd(xs: readonly number[]): number | null {
  if (xs.length < 2) return null;
  const m = sum(xs) / xs.length;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}
export function se(xs: readonly number[]): number | null {
  const s = sd(xs);
  return s === null ? null : s / Math.sqrt(xs.length);
}
/** Hyndman-Fan type 7 quantile (same definition as @coopr/engine stats.ts). null for empty input. */
export function quantile7(xs: readonly number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 1) return s[0]!;
  const h = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo]! + (h - lo) * (s[hi]! - s[lo]!);
}
export function median(xs: readonly number[]): number | null {
  return quantile7(xs, 0.5);
}
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Exact two-sided binomial sign test p-value against p0 = 0.5. */
export function signTestP(k: number, n: number): number {
  if (n === 0) return 1;
  const kk = Math.max(k, n - k);
  let tail = 0;
  for (let i = kk; i <= n; i++) tail += choose(n, i);
  return Math.min(1, (2 * tail) / 2 ** n);
}
function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export interface Ellipse {
  /** Centre: mean lateral (+right) and mean longitudinal (+long) offset, yards. */
  cx: number;
  cy: number;
  /** Semi-axes at the requested coverage, yards (a >= b). */
  a: number;
  b: number;
  /** Rotation of the major axis from the +lateral axis, degrees, in (-90, 90]. */
  angleDeg: number;
  sdLateral: number;
  sdLong: number;
  correlation: number;
}

/**
 * Covariance ("confidence") ellipse for 2-D landing offsets.
 * Under a bivariate normal model the ellipse x'S^-1x = chi2 contains P(chi2_2 <= chi2) of shots;
 * chi2 = 3.219 -> 80%, 2.279 -> 68%, 5.991 -> 95% (chi-square, 2 d.o.f.). Needs n >= 3; the gate sits above that.
 */
export function covEllipse(xs: readonly number[], ys: readonly number[], chi2: number): Ellipse | null {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = sum(xs) / n;
  const my = sum(ys) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= n - 1;
  syy /= n - 1;
  sxy /= n - 1;
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = Math.max(0, tr / 2 - disc);
  let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy) * (180 / Math.PI);
  if (angle <= -90) angle += 180;
  const denom = Math.sqrt(sxx * syy);
  return {
    cx: mx,
    cy: my,
    a: Math.sqrt(chi2 * l1),
    b: Math.sqrt(chi2 * l2),
    angleDeg: angle,
    sdLateral: Math.sqrt(sxx),
    sdLong: Math.sqrt(syy),
    correlation: denom === 0 ? 0 : sxy / denom,
  };
}

export function pct(part: number, whole: number): number | null {
  return whole === 0 ? null : (100 * part) / whole;
}
