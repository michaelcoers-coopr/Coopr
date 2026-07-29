import type { Environment, SwingMode, ShotQuality } from './enums';

// The atomic performance record (spec section 13). Every measurement is nullable:
// unknown stays null, and nothing is ever fabricated. Mishits are kept; only a
// clear monitor misread is labeled 'invalid' (and excluded from stats).
export interface Shot {
  id: string;
  playerId: string;

  clubId: string;
  clubLabel: string;
  loftDeg: number | null;

  sessionId: string;
  sessionDate: number; // ms epoch
  shotNumber: number | null;

  environment: Environment;
  swingMode: SwingMode;

  carryYards: number | null;
  totalYards: number | null;

  offlineYards: number | null; // lateral distance offline
  side: 'left' | 'right' | 'center' | null;

  clubSpeedMph: number | null;
  ballSpeedMph: number | null;
  smashFactor: number | null;

  launchAngleDeg: number | null;
  spinRateRpm: number | null;
  spinAxisDeg: number | null;

  peakHeightYards: number | null;
  landingAngleDeg: number | null;

  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  faceToPathDeg: number | null;
  dynamicLoftDeg: number | null;

  impactHeight: number | null;
  impactOffset: number | null;

  qualityLabel: ShotQuality | null;
  qualityReason: string | null;

  source: string | null;
  sourceImage: string | null;
  notes: string | null;
}

// Convenience for constructing shots from sparse seed data without repeating nulls.
export type PartialShot = Pick<Shot, 'clubId' | 'clubLabel' | 'sessionId' | 'sessionDate' | 'environment' | 'swingMode'> &
  Partial<Omit<Shot, 'clubId' | 'clubLabel' | 'sessionId' | 'sessionDate' | 'environment' | 'swingMode'>>;

const SHOT_NULL_FIELDS: Array<keyof Shot> = [
  'loftDeg', 'shotNumber', 'carryYards', 'totalYards', 'offlineYards', 'side',
  'clubSpeedMph', 'ballSpeedMph', 'smashFactor', 'launchAngleDeg', 'spinRateRpm',
  'spinAxisDeg', 'peakHeightYards', 'landingAngleDeg', 'attackAngleDeg',
  'clubPathDeg', 'faceAngleDeg', 'faceToPathDeg', 'dynamicLoftDeg', 'impactHeight',
  'impactOffset', 'qualityLabel', 'qualityReason', 'source', 'sourceImage', 'notes',
];

// Fills every unspecified measurement with null. Never invents values.
export function makeShot(id: string, playerId: string, partial: PartialShot): Shot {
  const base = { id, playerId, ...partial } as Record<string, unknown>;
  for (const field of SHOT_NULL_FIELDS) {
    if (!(field in base)) base[field] = null;
  }
  return base as unknown as Shot;
}
