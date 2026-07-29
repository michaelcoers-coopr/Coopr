import type {
  DistanceMetric,
  Lie,
  WindDirection,
  StrategicIntent,
  RiskPreference,
  RiskLevel,
  SwingMode,
  HazardSide,
  HazardKind,
} from './enums';
import type { ClubProfile, QuantileSet } from './profile';

export interface Wind {
  speedMph: number;
  direction: WindDirection;
}

export interface Conditions {
  lie: Lie;
  wind: Wind | null;
  elevationDeltaYards: number | null; // positive = uphill (plays longer)
  temperatureF: number | null;
}

export interface Hazard {
  side: HazardSide;
  kind: HazardKind;
  distanceYards: number | null; // carry distance to the hazard, when known
}

export interface RecommendationInput {
  targetDistanceYards: number;
  targetMetric: DistanceMetric;
  conditions: Conditions;
  hazards: Hazard[];
  intent: StrategicIntent;
  riskPreference: RiskPreference;
  profiles: ClubProfile[]; // candidate clubs (one per club/mode considered)
}

export interface Reason {
  code: string;
  text: string;
}

export interface Recommendation {
  clubId: string;
  clubLabel: string;
  swingMode: SwingMode;

  // Three separate fields, never collapsed (invariant 3).
  strategicTarget: string;
  recommendedAim: string; // equals strategicTarget unless geometry overrides
  mechanicalMissPattern: string | null; // awareness only

  playsLikeDistanceYards: number;
  expectedCarryYards: QuantileSet | null;
  expectedTotalYards: QuantileSet | null;

  shortRisk: RiskLevel;
  longRisk: RiskLevel;
  leftRisk: RiskLevel;
  rightRisk: RiskLevel;
  missZoneWarning: string | null;

  confidence: number; // 0..1
  metricMismatch: boolean; // target metric != club's backing metric
  reasons: Reason[];
}
