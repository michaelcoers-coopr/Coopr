import type { FounderDataset } from '@coopr/domain';
import {
  buildProfiles,
  recommend,
  replacementAdvice,
  type CaddieCard,
  type DistanceObservation,
  type DistanceProfile,
  type ReplaceAdvice,
} from '@coopr/engine';
import { importFounder } from './import-founder';
import { FOUNDER_RAW } from './founder-raw';

/** Sync clock for imported rows. The transcript's event dates stay on their own fields. */
export const IMPORT_CLOCK_MS = Date.UTC(2026, 9, 22);

export function loadFounderDataset(raw: string = FOUNDER_RAW): FounderDataset {
  return importFounder(raw, { importedAtMs: IMPORT_CLOCK_MS });
}

export function profilesFromFounder(dataset: FounderDataset): DistanceProfile[] {
  const labels = new Map(dataset.clubs.map((club) => [club.id, club.label]));
  const shots = new Map(dataset.shots.map((shot) => [shot.id, shot]));
  const observations: DistanceObservation[] = [];
  for (const measurement of dataset.measurements) {
    if (measurement.aggregation !== 'shot') continue;
    if (measurement.metric !== 'carry' && measurement.metric !== 'total') continue;
    if (measurement.valueNum == null || measurement.shotId == null) continue;
    const shot = shots.get(measurement.shotId);
    if (!shot || shot.qualityLabel === 'invalid') continue;
    const label = labels.get(shot.clubId);
    if (!label) throw new Error('shot club missing');
    observations.push({
      clubId: shot.clubId,
      clubLabel: label,
      environment: shot.environment,
      swingMode: shot.swingMode,
      metric: measurement.metric,
      yards: measurement.valueNum,
      qualityLabel: shot.qualityLabel,
      aggregation: 'shot',
      lateralMiss: 'none',
    });
  }
  const eight = dataset.clubs.find((club) => club.stableKey === '8i' && !club.historicalOnly);
  return buildProfiles(observations).map((profile) => {
    if (!eight || profile.clubId !== eight.id) return profile;
    return {
      ...profile,
      sampleWarning: 'Source notes 11 shots against a stated 10. All 11 totals are kept.',
      confidence: profile.confidence === 'insufficient' ? profile.confidence : 'limited',
    };
  });
}

function clubId(dataset: FounderDataset, key: string): string {
  const club = dataset.clubs.find((item) => item.stableKey === key && !item.historicalOnly);
  if (!club) throw new Error(key);
  return club.id;
}

function labelsFor(dataset: FounderDataset, keys: readonly string[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const key of keys) {
    const club = dataset.clubs.find((item) => item.stableKey === key && !item.historicalOnly);
    if (!club) throw new Error(key);
    labels[club.id] = club.label;
  }
  return labels;
}

export interface FounderFlows {
  profiles: DistanceProfile[];
  wedge100: CaddieCard;
  par3Carry174: CaddieCard;
  pitch41: CaddieCard;
  replace: ReplaceAdvice;
}

/** Founder verification flows. Not a public demo. */
export function founderFlows(dataset: FounderDataset = loadFounderDataset()): FounderFlows {
  const profiles = profilesFromFounder(dataset);
  const wedgeKeys = ['pw', 'aw49', 'miura48', 'w54', 'miura56', 'w58'] as const;
  const longKeys = ['5i', '2h', '3h', '4h', '3i'] as const;
  const miuraId = clubId(dataset, 'miura48');
  const usable = dataset.measurements.filter(
    (measurement) => measurement.clubId === miuraId && measurement.aggregation === 'usable_strike_average',
  );
  const usableCarry = usable.find((measurement) => measurement.metric === 'carry')?.valueNum;
  const usableTotal = usable.find((measurement) => measurement.metric === 'total')?.valueNum;

  const wedge100 = recommend({
    targetDistanceYards: 100,
    targetMetric: 'total',
    hazards: [],
    intent: 'neutral',
    riskPreference: 'conservative',
    profiles,
    candidateClubIds: wedgeKeys.map((key) => clubId(dataset, key)),
    clubLabels: labelsFor(dataset, wedgeKeys),
    unusedAggregates: [
      {
        clubLabel: 'Miura 48°',
        note: `usable-strike summary carry ${usableCarry ?? 'unknown'} and total ${usableTotal ?? 'unknown'} is unused because the strike criteria are unknown`,
      },
    ],
  });

  const par3Carry174 = recommend({
    targetDistanceYards: 174,
    targetMetric: 'carry',
    hazards: [{ side: 'front', kind: 'front of the green', carryToClearYards: 174 }],
    intent: 'play_safe',
    riskPreference: 'conservative',
    profiles,
    candidateClubIds: longKeys.map((key) => clubId(dataset, key)),
    clubLabels: labelsFor(dataset, longKeys),
  });

  const pitch41 = recommend({
    targetDistanceYards: 41,
    targetMetric: 'carry',
    hazards: [],
    intent: 'neutral',
    riskPreference: 'conservative',
    profiles,
    intendedClubId: clubId(dataset, 'w54'),
    intendedClubLabel: '54°',
    intendedSwingMode: 'pitch',
    recordOutcome: true,
  });

  const replace = replacementAdvice(
    profiles,
    dataset.clubs
      .filter((club) => !club.historicalOnly)
      .map((club) => ({ id: club.id, label: club.label, category: club.category })),
  );

  return { profiles, wedge100, par3Carry174, pitch41, replace };
}
