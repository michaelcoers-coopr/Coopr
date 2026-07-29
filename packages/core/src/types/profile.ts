import type { Environment, SwingMode, DistanceMetric } from './enums';

export interface QuantileSet {
  p20: number;
  p50: number; // stock = median
  p80: number;
}

// Derived by the club-profile engine, keyed by (club, swingMode, environment).
// Never authoritative — always reproducible from shots. `metric` records whether
// the distance stats are backed by carry or total (seed irons are total-backed).
export interface ClubProfile {
  clubId: string;
  clubLabel: string;
  swingMode: SwingMode;
  environment: Environment;

  metric: DistanceMetric; // which metric backs stockDistanceYards / dispersion
  sampleSize: number; // usable shots (excludes 'invalid')

  carry: QuantileSet | null; // null when carry is unknown
  total: QuantileSet | null;

  stockDistanceYards: number; // median of the backing metric
  goodStrikeDistanceYards: number | null;
  goodStrikeSource: 'label' | 'distance_derived' | null;

  dispersion: { madYards: number; iqrYards: number };
  lateral: {
    leftYards: number | null;
    rightYards: number | null;
    biasNote: string | null; // descriptive awareness only, never an aim offset
  } | null;

  shortMissRate: number; // 0..1
  longMissRate: number; // 0..1
  mishitRate: number; // 0..1

  confidence: number; // 0..1
  recencyDays: number | null;
  validationRequired: boolean;
}
