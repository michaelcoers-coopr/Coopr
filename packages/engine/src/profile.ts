import type { ConfidenceBand, DistanceMetric, EnvironmentName, ShotQualityLabel } from '@coopr/domain';
import { iqr, longest, mad, quantileType7 } from './stats';

export interface DistanceObservation {
  clubId: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  metric: DistanceMetric;
  yards: number;
  qualityLabel: ShotQualityLabel;
  aggregation: 'shot';
  lateralMiss: 'left' | 'right' | 'none';
}

export interface DistanceProfile {
  clubId: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  metric: DistanceMetric;
  sampleSize: number;
  p20: number;
  p50: number;
  p80: number;
  iqr: number;
  mad: number;
  shortMissCount: number;
  longMissCount: number;
  /** Share of this sample. A description of the shots in hand, not a predicted probability. */
  shortMissShare: number;
  longMissShare: number;
  confidence: ConfidenceBand;
  longestYards: number;
  /** Always the median. The longest shot is recorded separately and is never the stock. */
  stockYards: number;
  lateralMiss: 'left' | 'right' | 'none';
  /** True only on an explicit same-metric blend. Carry is never blended into total. */
  blended: boolean;
  sampleWarning: string | null;
}

export function refuseMetricConversion(from: DistanceMetric, to: DistanceMetric): never {
  throw new Error(`Refusing to convert ${from} into ${to}. Carry and total stay distinct.`);
}

/**
 * Silent mixing stays refused. A same-metric blend is `blendSameMetric`, and it
 * keeps carry and total apart.
 */
export function blendProfiles(): never {
  throw new Error('Refusing to blend simulator, range, and course. Build a profile per environment.');
}

/** Course updates count double. Range counts 1.5. The simulator prior counts 1. */
const ENVIRONMENT_WEIGHT: Record<EnvironmentName, number> = {
  course: 2,
  range: 1.5,
  simulator: 1,
};

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function weighted(group: readonly DistanceProfile[], weights: readonly number[], pick: (profile: DistanceProfile) => number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return group.reduce((sum, profile, index) => sum + pick(profile) * (weights[index] ?? 0), 0) / total;
}

/**
 * Blends profiles of one club, one swing, and one metric.
 * The result is labeled blended. It is not a new measurement and not a unit conversion.
 */
export function blendSameMetric(group: readonly DistanceProfile[]): DistanceProfile {
  const first = group[0];
  if (!first || group.length < 2) throw new Error('A blend needs two profiles of the same metric.');
  for (const profile of group) {
    if (profile.metric !== first.metric) refuseMetricConversion(profile.metric, first.metric);
    if (profile.clubId !== first.clubId || profile.swingMode !== first.swingMode) {
      throw new Error('A blend stays inside one club and one swing mode.');
    }
    if (profile.blended) throw new Error('Refusing to blend a profile that is already blended.');
  }
  const weights = group.map((profile) => profile.sampleSize * ENVIRONMENT_WEIGHT[profile.environment]);
  const stockYards = weighted(group, weights, (profile) => profile.stockYards);
  const stocks = group.map((profile) => profile.stockYards);
  const spread = Math.max(...stocks) - Math.min(...stocks);
  const sampleSize = group.reduce((sum, profile) => sum + profile.sampleSize, 0);
  const iqrValue = weighted(group, weights, (profile) => profile.iqr);
  let confidence = confidenceBand(sampleSize, iqrValue, stockYards);
  const parts = group
    .map((profile) => `${profile.environment} n=${profile.sampleSize} median ${roundTenth(profile.stockYards)}`)
    .join('; ');
  let sampleWarning = `Blended ${first.metric} from ${parts}. Course samples count double. This is not a new measurement.`;
  if (spread > 15) {
    confidence = 'limited';
    sampleWarning += ` The medians differ by ${roundTenth(spread)} yards, so confidence stays limited.`;
  }
  const sides = new Set(group.map((profile) => profile.lateralMiss).filter((side) => side !== 'none'));
  const lateralMiss = sides.size === 1 ? ([...sides][0] ?? 'none') : 'none';
  if (sides.size > 1) sampleWarning += ' Sources disagree on miss side, so no side is stored.';
  const dominant = [...group].sort(
    (a, b) => b.sampleSize * ENVIRONMENT_WEIGHT[b.environment] - a.sampleSize * ENVIRONMENT_WEIGHT[a.environment],
  )[0];
  return {
    clubId: first.clubId,
    clubLabel: first.clubLabel,
    environment: dominant?.environment ?? first.environment,
    swingMode: first.swingMode,
    metric: first.metric,
    sampleSize,
    p20: weighted(group, weights, (profile) => profile.p20),
    p50: weighted(group, weights, (profile) => profile.p50),
    p80: weighted(group, weights, (profile) => profile.p80),
    iqr: iqrValue,
    mad: weighted(group, weights, (profile) => profile.mad),
    shortMissCount: group.reduce((sum, profile) => sum + profile.shortMissCount, 0),
    longMissCount: group.reduce((sum, profile) => sum + profile.longMissCount, 0),
    shortMissShare: weighted(group, weights, (profile) => profile.shortMissShare),
    longMissShare: weighted(group, weights, (profile) => profile.longMissShare),
    confidence,
    longestYards: Math.max(...group.map((profile) => profile.longestYards)),
    stockYards,
    lateralMiss,
    blended: true,
    sampleWarning,
  };
}

/** Appends a same-metric blend wherever one club has two environments. Plain profiles stay. */
export function withSameMetricBlends(profiles: readonly DistanceProfile[]): DistanceProfile[] {
  const plain = profiles.filter((profile) => !profile.blended);
  const groups = new Map<string, DistanceProfile[]>();
  for (const profile of plain) {
    const key = `${profile.clubId}|${profile.swingMode}|${profile.metric}`;
    const list = groups.get(key);
    if (list) list.push(profile);
    else groups.set(key, [profile]);
  }
  const blends: DistanceProfile[] = [];
  for (const group of groups.values()) {
    const environments = new Set(group.map((profile) => profile.environment));
    if (environments.size < 2) continue;
    blends.push(blendSameMetric(group));
  }
  return [...plain, ...blends];
}

export function confidenceBand(sampleSize: number, spreadIqr: number, stockYards: number): ConfidenceBand {
  if (sampleSize < 5) return 'insufficient';
  const relative = stockYards === 0 ? Number.POSITIVE_INFINITY : spreadIqr / Math.abs(stockYards);
  if (sampleSize < 8) return 'limited';
  if (relative > 0.45) return 'limited';
  if (sampleSize >= 30 && relative <= 0.2) return 'solid';
  return 'moderate';
}

function missMargin(stockYards: number, spreadIqr: number): number {
  void stockYards;
  return Math.max(12, spreadIqr / 2);
}

function profileKey(obs: DistanceObservation): string {
  return [obs.clubId, obs.swingMode, obs.environment, obs.metric].join('|');
}

/**
 * One profile per club × swing mode × environment × metric.
 * Invalid shots are dropped. Mishits and unlabeled shots stay.
 * Aggregates are rejected so a summary cannot pose as a sample.
 */
export function buildProfiles(observations: readonly DistanceObservation[]): DistanceProfile[] {
  const groups = new Map<string, DistanceObservation[]>();
  for (const obs of observations) {
    if (obs.aggregation !== 'shot') {
      throw new Error('Refusing to build a profile from an aggregate measurement');
    }
    if (obs.qualityLabel === 'invalid') continue;
    const key = profileKey(obs);
    const list = groups.get(key);
    if (list) list.push(obs);
    else groups.set(key, [obs]);
  }

  const profiles: DistanceProfile[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const yards = group.map((obs) => obs.yards);
    const p20 = quantileType7(yards, 0.2);
    const p50 = quantileType7(yards, 0.5);
    const p80 = quantileType7(yards, 0.8);
    const spread = iqr(yards);
    const margin = missMargin(p50, spread);
    const shortMissCount = yards.filter((value) => value < p50 - margin).length;
    const longMissCount = yards.filter((value) => value > p50 + margin).length;
    const lateral = group.some((obs) => obs.lateralMiss === 'right')
      ? 'right'
      : group.some((obs) => obs.lateralMiss === 'left')
        ? 'left'
        : 'none';
    profiles.push({
      clubId: first.clubId,
      clubLabel: first.clubLabel,
      environment: first.environment,
      swingMode: first.swingMode,
      metric: first.metric,
      sampleSize: yards.length,
      p20,
      p50,
      p80,
      iqr: spread,
      mad: mad(yards),
      shortMissCount,
      longMissCount,
      shortMissShare: shortMissCount / yards.length,
      longMissShare: longMissCount / yards.length,
      confidence: confidenceBand(yards.length, spread, p50),
      longestYards: longest(yards),
      stockYards: p50,
      lateralMiss: lateral,
      blended: false,
      sampleWarning: null,
    });
  }

  profiles.sort((a, b) => profileSort(a).localeCompare(profileSort(b)));
  return profiles;
}

function profileSort(profile: DistanceProfile): string {
  return [profile.clubLabel, profile.environment, profile.swingMode, profile.metric].join('|');
}
