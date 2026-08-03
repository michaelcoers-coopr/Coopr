import type { ClubType } from './types/enums';

// Handicap-based quick start. A new user picks a band and gets a standard bag with
// AVERAGE carry distances for that skill level — clearly ESTIMATES, not measured data,
// so real advice works out of the box and improves the moment they log real shots.

export interface HandicapBand {
  key: string;
  label: string;
  hint: string;
}

export const HANDICAP_BANDS: HandicapBand[] = [
  { key: 'scratch', label: 'Scratch (0–5)', hint: 'You flush it. Mostly.' },
  { key: 'low', label: 'Low (6–12)', hint: 'Solid player, occasional fireworks.' },
  { key: 'mid', label: 'Mid (13–20)', hint: 'The heart of golf. Streaky.' },
  { key: 'high', label: 'High (21–30)', hint: 'Fun first, scoring second.' },
  { key: 'beginner', label: 'Beginner (30+)', hint: 'Every hole is an adventure.' },
];

export interface StdClub {
  label: string;
  type: ClubType;
  loftDeg?: number;
}

// A relatable standard set (not everyone's exact bag, but everyone recognizes it).
export const STANDARD_BAG: StdClub[] = [
  { label: 'Driver', type: 'driver' },
  { label: '3W', type: 'wood' },
  { label: '5W', type: 'wood' },
  { label: '4H', type: 'hybrid' },
  { label: '5i', type: 'iron' },
  { label: '6i', type: 'iron' },
  { label: '7i', type: 'iron' },
  { label: '8i', type: 'iron' },
  { label: '9i', type: 'iron' },
  { label: 'PW', type: 'iron', loftDeg: 45 },
  { label: 'GW', type: 'wedge', loftDeg: 50 },
  { label: 'SW', type: 'wedge', loftDeg: 54 },
  { label: 'LW', type: 'wedge', loftDeg: 58 },
  { label: 'Putter', type: 'putter' },
];

// Average CARRY yards per band per club. Ballpark, honest-to-life figures.
export const AVG_CARRY: Record<string, Record<string, number>> = {
  scratch: { Driver: 260, '3W': 235, '5W': 220, '4H': 205, '5i': 195, '6i': 183, '7i': 170, '8i': 158, '9i': 145, PW: 132, GW: 118, SW: 100, LW: 80 },
  low: { Driver: 240, '3W': 218, '5W': 205, '4H': 190, '5i': 180, '6i': 168, '7i': 156, '8i': 144, '9i': 132, PW: 120, GW: 106, SW: 90, LW: 72 },
  mid: { Driver: 220, '3W': 200, '5W': 188, '4H': 175, '5i': 165, '6i': 154, '7i': 143, '8i': 132, '9i': 120, PW: 108, GW: 95, SW: 80, LW: 64 },
  high: { Driver: 200, '3W': 182, '5W': 170, '4H': 158, '5i': 148, '6i': 138, '7i': 128, '8i': 118, '9i': 107, PW: 96, GW: 84, SW: 70, LW: 56 },
  beginner: { Driver: 175, '3W': 160, '5W': 150, '4H': 140, '5i': 130, '6i': 121, '7i': 112, '8i': 103, '9i': 93, PW: 83, GW: 72, SW: 60, LW: 48 },
};

// Spread + short-miss frequency per band — higher handicap, wider and shorter misses.
export const BAND_DISPERSION: Record<string, { relSpread: number; shortMissRate: number }> = {
  scratch: { relSpread: 0.05, shortMissRate: 0.08 },
  low: { relSpread: 0.07, shortMissRate: 0.12 },
  mid: { relSpread: 0.1, shortMissRate: 0.18 },
  high: { relSpread: 0.14, shortMissRate: 0.25 },
  beginner: { relSpread: 0.18, shortMissRate: 0.32 },
};
