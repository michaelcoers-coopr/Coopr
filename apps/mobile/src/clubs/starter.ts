import type { ClubType, ScanClub } from '../bag-scan/types';
import { estimateCarry, estimatedAdvice, type EstimateClub } from './distances';

export interface StarterSlot {
  id: string;
  slot: string;
  type: ClubType;
  code: string;
  clubNumber: string | null;
}

/** A standard 14-club set. No brand and no model. */
export const STARTER_SLOTS: readonly StarterSlot[] = [
  { id: 'starter-driver', slot: 'Driver', type: 'driver', code: 'DR', clubNumber: null },
  { id: 'starter-3w', slot: '3 wood', type: 'fairway wood', code: '3W', clubNumber: '3W' },
  { id: 'starter-5w', slot: '5 wood', type: 'fairway wood', code: '5W', clubNumber: '5W' },
  { id: 'starter-4h', slot: '4 hybrid', type: 'hybrid', code: '4H', clubNumber: '4H' },
  { id: 'starter-5i', slot: '5 iron', type: 'iron', code: '5I', clubNumber: '5' },
  { id: 'starter-6i', slot: '6 iron', type: 'iron', code: '6I', clubNumber: '6' },
  { id: 'starter-7i', slot: '7 iron', type: 'iron', code: '7I', clubNumber: '7' },
  { id: 'starter-8i', slot: '8 iron', type: 'iron', code: '8I', clubNumber: '8' },
  { id: 'starter-9i', slot: '9 iron', type: 'iron', code: '9I', clubNumber: '9' },
  { id: 'starter-pw', slot: 'Pitching wedge', type: 'wedge', code: 'PW', clubNumber: 'PW' },
  { id: 'starter-gw', slot: 'Gap wedge', type: 'wedge', code: 'GW', clubNumber: 'GW' },
  { id: 'starter-sw', slot: 'Sand wedge', type: 'wedge', code: 'SW', clubNumber: 'SW' },
  { id: 'starter-lw', slot: 'Lob wedge', type: 'wedge', code: 'LW', clubNumber: 'LW' },
  { id: 'starter-putter', slot: 'Putter', type: 'putter', code: 'PT', clubNumber: null },
];

export function starterBag(input: { handicap: number | null; driverSpeed: number | null }): ScanClub[] {
  return STARTER_SLOTS.map((slot) => {
    const estimate = estimateCarry({ club: slot.code, handicap: input.handicap, driverSpeed: input.driverSpeed });
    return {
      id: slot.id,
      slot: slot.slot,
      inPlay: true,
      brand: null,
      model: null,
      type: slot.type,
      loft: null,
      flex: null,
      ironBuild: null,
      photoUri: null,
      fitAck: null,
      fitAckOn: null,
      clubNumber: slot.clubNumber,
      identifiedBy: 'typed',
      source: 'starter',
      estimatedCarry: estimate.yards,
      distanceBasis: estimate.basis,
    };
  });
}

/** Scanned or typed clubs stay. A starter club is skipped when that slot is already taken. */
export function mergeStarter(existing: readonly ScanClub[], starter: readonly ScanClub[]): ScanClub[] {
  const kept = existing.filter((club) => club.source !== 'starter');
  const taken = new Set(kept.map((club) => club.slot.toUpperCase()));
  const add = starter.filter((club) => !taken.has(club.slot.toUpperCase()));
  return [...kept, ...add];
}

export function starterAdvice(clubs: readonly ScanClub[], targetYards: number | null): string | null {
  const rows: EstimateClub[] = [];
  let basis: string | null = null;
  for (const club of clubs) {
    if (club.estimatedCarry == null) continue;
    if (club.source !== 'starter' && club.estimatedCarry == null) continue;
    const slot = STARTER_SLOTS.find((item) => item.id === club.id || item.slot === club.slot);
    rows.push({ id: club.id, label: club.slot, code: slot?.code ?? club.slot, yards: club.estimatedCarry });
    basis = basis ?? club.distanceBasis ?? null;
  }
  return estimatedAdvice({ clubs: rows, targetYards, basis });
}
