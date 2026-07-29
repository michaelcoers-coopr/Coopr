import type { DistanceMetric } from './enums';

// Bag Intelligence + Equipment Lab (spec sections 36-38). Deterministic, computed from
// the player's profiles, subjective feedback (kept separate from measured data), and
// any aggregate/known distances for clubs without per-shot data.

export type ClubStatus = 'keep' | 'test' | 'replace' | 'remove' | 'retest' | 'gather_data';
export type Evidence = 'measured' | 'aggregate' | 'user' | 'none';

export interface ClubReport {
  clubId: string;
  clubLabel: string;
  status: ClubStatus;
  stockYards: number | null;
  metric: DistanceMetric | null;
  confidence: number; // 0..1 (0 when no data)
  evidence: Evidence;
  reasons: string[];
}

export interface BagGap {
  // Ordered by loft: the club that should carry farther vs the next shorter club.
  longerClubId: string;
  longerLabel: string;
  shorterClubId: string;
  shorterLabel: string;
  gapYards: number; // longer.stock - shorter.stock (positive = healthy)
  kind: 'ok' | 'large_gap' | 'overlap' | 'inversion';
}

export interface BagInsight {
  code: string;
  severity: 'info' | 'watch' | 'priority';
  text: string;
  clubIds: string[];
}

export interface IdealBagItem {
  clubLabel: string;
  role: string;
  action: 'carry' | 'test_alternative' | 'drop';
  rationale: string;
}

export interface BagIntelligence {
  clubReports: ClubReport[];
  gaps: BagGap[];
  insights: BagInsight[];
  idealBag: IdealBagItem[];
  carryCount: number;
}

// A club's distance known from an aggregate/summary or user entry rather than logged
// shots — e.g. the Miura 48° usable-strike average. Legitimate data, lower confidence,
// never treated as a full shot distribution.
export interface KnownDistance {
  clubId: string;
  clubLabel: string;
  carryYards: number;
  source: 'aggregate' | 'user';
}

export interface ClubFeedbackInput {
  clubId: string;
  confidence: 'low' | 'moderate' | 'high' | null;
  note: string | null;
}
