import type { Shot, ClubProfile, QuantileSet, DistanceMetric, SwingMode, Environment } from '@coopr/core';
import { quantile, median, mad, iqr, clamp, clamp01, round1 } from './stats';

export interface ProfileOptions {
  /** ms epoch used only for recency. If omitted, recencyDays is null. */
  now?: number;
  /** Sessions with a known data-quality issue (e.g. the seed 8-iron count discrepancy). */
  validationRequiredSessions?: ReadonlySet<string>;
}

const MS_PER_DAY = 86_400_000;
const CONFIDENCE_N_HALF = 8; // sample size at which the size factor reaches 0.5
const RECENCY_HALFLIFE_DAYS = 180;
const DISPERSION_SCALE = 0.6; // relative IQR at which the spread factor hits ~0
const MIN_QUANTILE_SAMPLE = 3;

function quantileSet(xs: number[]): QuantileSet {
  return {
    p20: round1(quantile(xs, 0.2)),
    p50: round1(quantile(xs, 0.5)),
    p80: round1(quantile(xs, 0.8)),
  };
}

/** Meaningful-consistency band around the stock distance. */
function consistencyBand(stock: number): number {
  return Math.max(12, 0.1 * stock);
}

function confidence(n: number, relIqr: number, recencyDays: number | null): number {
  const sizeFactor = n / (n + CONFIDENCE_N_HALF); // saturating in n
  const spreadFactor = clamp01(1 - relIqr / DISPERSION_SCALE);
  const recencyFactor = recencyDays == null ? 1 : Math.pow(0.5, recencyDays / RECENCY_HALFLIFE_DAYS);
  // Size gates confidence; spread and recency modulate it. A club can never be
  // "high confidence" on tiny n, and wild dispersion always drags it down.
  return clamp01(sizeFactor * (0.4 + 0.6 * spreadFactor) * recencyFactor);
}

/**
 * Build one club profile from a set of shots that all belong to the same
 * (club, swingMode, environment). Excludes only 'invalid' shots; mishits are kept.
 * Distance stats are backed by carry when it has coverage, otherwise total — carry is
 * never fabricated from total.
 */
export function buildClubProfile(shots: Shot[], opts: ProfileOptions = {}): ClubProfile {
  if (shots.length === 0) throw new Error('buildClubProfile: no shots');
  const first = shots[0]!;
  const usable = shots.filter((s) => s.qualityLabel !== 'invalid');
  if (usable.length === 0) throw new Error('buildClubProfile: no usable shots');

  const carryVals = usable.map((s) => s.carryYards).filter((v): v is number => v != null);
  const totalVals = usable.map((s) => s.totalYards).filter((v): v is number => v != null);

  const metric: DistanceMetric =
    carryVals.length >= totalVals.length && carryVals.length > 0 ? 'carry' : totalVals.length > 0 ? 'total' : 'carry';
  const backing = metric === 'carry' ? carryVals : totalVals;
  if (backing.length === 0) throw new Error('buildClubProfile: no distance data');

  const n = backing.length;
  const stock = round1(median(backing));
  const band = consistencyBand(stock);
  const shortMissRate = backing.filter((v) => v < stock - band).length / n;
  const longMissRate = backing.filter((v) => v > stock + band).length / n;

  const hasLabels = usable.some((s) => s.qualityLabel != null);
  const labeledMishits = usable.filter((s) => s.qualityLabel === 'mishit').length;
  const mishitRate = hasLabels ? labeledMishits / usable.length : shortMissRate + longMissRate;

  const iqrYards = iqr(backing);
  const relIqr = stock > 0 ? iqrYards / stock : 1;

  // Good-strike distance: verified labels first; otherwise the P80 (marked derived).
  const strikeLabeled = usable.filter(
    (s) => s.qualityLabel === 'good_strike' || s.qualityLabel === 'representative_stock',
  );
  let goodStrikeDistanceYards: number | null;
  let goodStrikeSource: ClubProfile['goodStrikeSource'];
  if (strikeLabeled.length > 0) {
    const vals = strikeLabeled
      .map((s) => (metric === 'carry' ? s.carryYards : s.totalYards))
      .filter((v): v is number => v != null);
    goodStrikeDistanceYards = vals.length > 0 ? round1(median(vals)) : null;
    goodStrikeSource = vals.length > 0 ? 'label' : null;
  } else {
    goodStrikeDistanceYards = round1(quantile(backing, 0.8));
    goodStrikeSource = 'distance_derived';
  }

  // Lateral dispersion (awareness only). Null when there is no side data.
  const lateralShots = usable.filter((s) => s.offlineYards != null && s.side != null);
  let lateral: ClubProfile['lateral'] = null;
  if (lateralShots.length > 0) {
    const leftMag = magnitudeMean(lateralShots, 'left');
    const rightMag = magnitudeMean(lateralShots, 'right');
    let biasNote: string | null = null;
    if (leftMag != null && rightMag != null) {
      if (rightMag > leftMag * 1.3) biasNote = 'Wider right-side miss zone.';
      else if (leftMag > rightMag * 1.3) biasNote = 'Wider left-side miss zone.';
    }
    lateral = { leftYards: leftMag, rightYards: rightMag, biasNote };
  }

  const sessionDates = usable.map((s) => s.sessionDate);
  const mostRecent = Math.max(...sessionDates);
  const recencyDays = opts.now != null ? Math.floor((opts.now - mostRecent) / MS_PER_DAY) : null;

  const validationRequired =
    opts.validationRequiredSessions != null &&
    usable.some((s) => opts.validationRequiredSessions!.has(s.sessionId));

  return {
    clubId: first.clubId,
    clubLabel: first.clubLabel,
    swingMode: first.swingMode as SwingMode,
    environment: first.environment as Environment,
    metric,
    sampleSize: n,
    carry: carryVals.length >= MIN_QUANTILE_SAMPLE ? quantileSet(carryVals) : null,
    total: totalVals.length >= MIN_QUANTILE_SAMPLE ? quantileSet(totalVals) : null,
    stockDistanceYards: stock,
    goodStrikeDistanceYards,
    goodStrikeSource,
    dispersion: { madYards: round1(mad(backing)), iqrYards: round1(iqrYards) },
    lateral,
    shortMissRate: round1(shortMissRate * 100) / 100,
    longMissRate: round1(longMissRate * 100) / 100,
    mishitRate: round1(clamp(mishitRate, 0, 1) * 100) / 100,
    confidence: round1(confidence(n, relIqr, recencyDays) * 100) / 100,
    recencyDays,
    validationRequired,
  };
}

function magnitudeMean(shots: Shot[], side: 'left' | 'right'): number | null {
  const mags = shots.filter((s) => s.side === side && s.offlineYards != null).map((s) => Math.abs(s.offlineYards!));
  if (mags.length === 0) return null;
  return round1(mags.reduce((a, b) => a + b, 0) / mags.length);
}

/** Build every (club, swingMode, environment) profile present in a shot set. */
export function buildAllProfiles(shots: Shot[], opts: ProfileOptions = {}): ClubProfile[] {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    const key = `${s.clubId}|${s.swingMode}|${s.environment}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  const out: ClubProfile[] = [];
  for (const group of groups.values()) {
    const usable = group.filter((s) => s.qualityLabel !== 'invalid');
    const hasDistance = usable.some((s) => s.carryYards != null || s.totalYards != null);
    if (usable.length > 0 && hasDistance) out.push(buildClubProfile(group, opts));
  }
  // Deterministic ordering: by club label then swing mode then environment.
  return out.sort(
    (a, b) =>
      a.clubLabel.localeCompare(b.clubLabel) ||
      a.swingMode.localeCompare(b.swingMode) ||
      a.environment.localeCompare(b.environment),
  );
}
