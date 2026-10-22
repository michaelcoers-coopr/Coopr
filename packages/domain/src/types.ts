export const SCHEMA_VERSION = 1 as const;

export const DATA_QUALITIES = [
  'measured',
  'user_confirmed',
  'estimated',
  'derived',
  'provisional',
  'unknown',
] as const;
export type DataQuality = (typeof DATA_QUALITIES)[number];

export const ENVIRONMENTS = ['simulator', 'range', 'course'] as const;
export type EnvironmentName = (typeof ENVIRONMENTS)[number];

export const DISTANCE_METRICS = ['carry', 'total'] as const;
export type DistanceMetric = (typeof DISTANCE_METRICS)[number];

export const PERSONALITIES = [
  'classic_tour',
  'funny_knowledgeable',
  'direct_analytical',
  'encouraging_coach',
  'quiet_minimalist',
] as const;
export type CaddiePersonality = (typeof PERSONALITIES)[number];

export const DEFAULT_PERSONALITY: CaddiePersonality = 'funny_knowledgeable';

export const PERSONALITY_LABELS: Record<CaddiePersonality, string> = {
  classic_tour: 'Classic Tour',
  funny_knowledgeable: 'Funny but Knowledgeable',
  direct_analytical: 'Direct & Analytical',
  encouraging_coach: 'Encouraging Coach',
  quiet_minimalist: 'Quiet Minimalist',
};

export const BAG_KINDS = ['owned', 'in_play', 'testing', 'historical'] as const;
export type BagKind = (typeof BAG_KINDS)[number];

export const IN_PLAY_CLUB_LIMIT = 14;

export const CONFIDENCE_BANDS = ['insufficient', 'limited', 'moderate', 'solid'] as const;
export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export type ClubCategory = 'driver' | 'wood' | 'hybrid' | 'utility' | 'iron' | 'wedge' | 'putter';

export type ShotQualityLabel = 'representative_stock' | 'good_strike' | 'mishit' | 'invalid' | 'unknown';

export type MeasurementAggregation = 'shot' | 'session_average' | 'usable_strike_average' | 'best' | 'stated';

export interface SyncStamp {
  createdAtMs: number;
  updatedAtMs: number;
  deletedAtMs: number | null;
}

export interface UserRecord extends SyncStamp {
  id: string;
  displayName: string;
  /** Private audiences are refused by the public-demo path. */
  audience: 'private' | 'public_demo';
  nameSource: string;
}

export interface PlayerProfile extends SyncStamp {
  id: string;
  userId: string;
  dominantHand: 'right' | 'left' | null;
  dominantHandQuality: DataQuality;
  /** Date only. The source did not give a clock time. */
  dominantHandConfirmedOn: string | null;
  handicapValue: number | null;
  /** Always false unless a verified GHIN index was supplied. An estimate is never official. */
  handicapOfficial: boolean;
  handicapQuality: DataQuality;
}

export interface CaddieProfile extends SyncStamp {
  id: string;
  userId: string;
  /** Empty until the golfer names the caddie. The platform name is not a person. */
  name: string;
  personality: CaddiePersonality;
}

export interface DataSource extends SyncStamp {
  id: string;
  userId: string;
  kind: string;
  ref: string;
  capturedOn: string | null;
  quality: DataQuality;
  note: string | null;
}

export interface RawRecord extends SyncStamp {
  id: string;
  userId: string;
  sourceId: string;
  label: string;
  body: string;
}

export interface Club extends SyncStamp {
  id: string;
  userId: string;
  stableKey: string;
  label: string;
  category: ClubCategory;
  loftDeg: number | null;
  bounceDeg: number | null;
  brand: string | null;
  model: string | null;
  flex: string | null;
  shaftModel: string | null;
  shaftMaterial: string | null;
  ownership: 'owned' | 'not_owned' | 'unverified';
  historicalOnly: boolean;
  rawText: string;
}

export interface Bag extends SyncStamp {
  id: string;
  userId: string;
  name: string;
  kind: BagKind;
}

export interface BagMembership extends SyncStamp {
  id: string;
  userId: string;
  bagId: string;
  clubId: string;
}

export interface SimulatorSession extends SyncStamp {
  id: string;
  userId: string;
  environment: EnvironmentName;
  label: string;
  validationRequired: boolean;
  validationNote: string | null;
}

export interface Shot extends SyncStamp {
  id: string;
  userId: string;
  clubId: string;
  sessionId: string | null;
  environment: EnvironmentName;
  swingMode: string;
  shotNumber: number | null;
  qualityLabel: ShotQualityLabel;
  /** True only for measured shot rows. Club-use and GPS rows are not shots. */
  calibrationEligible: boolean;
  sourceId: string;
  rawText: string;
  note: string | null;
}

export interface ShotMeasurement extends SyncStamp {
  id: string;
  userId: string;
  shotId: string | null;
  clubId: string;
  sessionId: string | null;
  metric: string;
  valueNum: number | null;
  valueText: string | null;
  unit: string | null;
  quality: DataQuality;
  aggregation: MeasurementAggregation;
  sourceId: string;
  /** Structural refusal: a measurement is never stored as a conversion of another metric. */
  convertedFromMetric: null;
}

export interface Round extends SyncStamp {
  id: string;
  userId: string;
  courseName: string;
  location: string | null;
  playedOn: string;
  teeName: string | null;
  yardage: number | null;
  par: number | null;
  courseRating: number | null;
  slope: number | null;
  ratingQuality: DataQuality;
  statedGross: number | null;
  statedFront: number | null;
  statedBack: number | null;
  statedPlus: number | null;
  displayedNet: number | null;
  displayedNetQuality: DataQuality;
  sourceId: string;
}

export interface RatingCandidate extends SyncStamp {
  id: string;
  userId: string;
  roundId: string;
  courseRating: number;
  slope: number;
  quality: DataQuality;
  selected: boolean;
}

export interface HoleScore extends SyncStamp {
  id: string;
  userId: string;
  roundId: string;
  holeNumber: number;
  par: number | null;
  strokes: number;
  putts: number | null;
  penalties: number | null;
}

export interface GpsObservation extends SyncStamp {
  id: string;
  userId: string;
  roundId: string | null;
  holeNumber: number;
  sequence: number;
  kind: 'to_center' | 'app_tee_estimate';
  distanceYards: number;
  isShot: false;
  quality: DataQuality;
  sourceId: string;
}

export interface ClubUseObservation extends SyncStamp {
  id: string;
  userId: string;
  roundId: string | null;
  holeNumber: number;
  distanceYards: number;
  clubId: string;
  swingModeText: string;
  outcome: string | null;
  calibrationEligible: false;
  quality: DataQuality;
  sourceId: string;
  rawText: string;
}

export interface Calibration extends SyncStamp {
  id: string;
  userId: string;
  scope: string;
  status: 'suspected' | 'verified';
  deltaLow: number | null;
  deltaHigh: number | null;
  confidence: 'low' | 'moderate' | 'high';
  applyAutomatically: boolean;
  hypothesis: string;
  sourceId: string;
}

export interface ClubNote extends SyncStamp {
  id: string;
  userId: string;
  clubId: string;
  body: string;
  quality: DataQuality;
  sourceId: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payloadJson: string;
  createdAtMs: number;
}

export interface Discrepancy {
  code: string;
  detail: string;
}

export interface FounderDataset {
  schemaVersion: typeof SCHEMA_VERSION;
  user: UserRecord;
  player: PlayerProfile;
  caddie: CaddieProfile;
  sources: DataSource[];
  rawRecords: RawRecord[];
  clubs: Club[];
  bags: Bag[];
  memberships: BagMembership[];
  sessions: SimulatorSession[];
  shots: Shot[];
  measurements: ShotMeasurement[];
  round: Round;
  ratingCandidates: RatingCandidate[];
  holeScores: HoleScore[];
  gpsObservations: GpsObservation[];
  clubUses: ClubUseObservation[];
  calibration: Calibration;
  clubNotes: ClubNote[];
  audit: AuditEvent[];
  discrepancies: Discrepancy[];
}

export interface PublicDemo {
  audience: 'public_demo';
  displayName: string;
  clubs: readonly [];
  shots: readonly [];
  measurements: readonly [];
  note: string;
}
