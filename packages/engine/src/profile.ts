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
  blended: false;
  sampleWarning: string | null;
}

export function refuseMetricConversion(from: DistanceMetric, to: DistanceMetric): never {
  throw new Error(`Refusing to convert ${from} into ${to}. Carry and total stay distinct.`);
}

/** Milestone 1 has no blend. A later explicit blend would need its own type. */
export function blendProfiles(): never {
  throw new Error('Refusing to blend simulator, range, and course. Build a profile per environment.');
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
