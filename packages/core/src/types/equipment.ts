import type { ClubType } from './enums';

// Physical club in a bag. Shaft/spec fields are nullable and NEVER invented.
export interface Club {
  id: string;
  bagId: string;
  type: ClubType;
  label: string; // "7i", "Driver", "54°"
  manufacturer: string | null;
  model: string | null;
  loftDeg: number | null;
  shaftFlex: string | null;
  shaftModel: string | null;
  shaftMaterial: string | null;
  bounceDeg: number | null;
  inBag: boolean;
}

// Subjective feedback, stored separately from measured data (spec section 11).
export interface ClubFeedback {
  id: string;
  clubId: string;
  confidence: 'low' | 'moderate' | 'high' | null;
  note: string | null;
  createdAt: number;
}

// Simulator <-> outdoor calibration. The suspected 10-15 yd bias lives here and is
// never auto-applied (invariant 5). status is 'suspected' until verified by data.
export interface CalibrationProfile {
  id: string;
  playerId: string;
  scope: 'all' | 'category' | 'club';
  clubId: string | null;
  status: 'suspected' | 'verified';
  deltaMinYards: number | null;
  deltaMaxYards: number | null;
  confidence: 'low' | 'moderate' | 'high';
  applyAutomatically: boolean; // default false
  note: string | null;
}

// Current-market product (spec section 39). Online-sourced, timestamped, flagged
// stale when old. Specs are never fabricated.
export interface EquipmentProduct {
  id: string;
  manufacturer: string;
  model: string;
  modelYear: number | null;
  type: ClubType;
  loftOptions: number[] | null;
  adjustability: string | null;
  headProfile: string | null;
  forgivenessProfile: string | null;
  launchProfile: string | null;
  spinProfile: string | null;
  shaftOptions: string[] | null;
  msrp: number | null;
  currentPrice: number | null;
  usedPriceRange: { minUsd: number; maxUsd: number } | null;
  sourceUrls: string[];
  lastVerifiedAt: number | null;
}
