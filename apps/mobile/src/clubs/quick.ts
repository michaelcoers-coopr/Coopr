import type { ClubType, FlexLetter, ScanClub, ScanDraft } from '../bag-scan/types';
import { primaryFlex } from './distances';

export const QUICK_TYPES: readonly { id: string; type: ClubType; number: string | null; loft: number }[] = [
  { id: 'Driver', type: 'driver', number: null, loft: 10.5 },
  { id: '3 wood', type: 'fairway wood', number: '3W', loft: 15 },
  { id: '5 wood', type: 'fairway wood', number: '5W', loft: 18 },
  { id: '4 hybrid', type: 'hybrid', number: '4H', loft: 22 },
  { id: '4 iron', type: 'iron', number: '4', loft: 21 },
  { id: '5 iron', type: 'iron', number: '5', loft: 24 },
  { id: '6 iron', type: 'iron', number: '6', loft: 27 },
  { id: '7 iron', type: 'iron', number: '7', loft: 31 },
  { id: '8 iron', type: 'iron', number: '8', loft: 35 },
  { id: '9 iron', type: 'iron', number: '9', loft: 39 },
  { id: 'PW', type: 'wedge', number: 'PW', loft: 44 },
  { id: 'GW', type: 'wedge', number: 'GW', loft: 50 },
  { id: 'SW', type: 'wedge', number: 'SW', loft: 56 },
  { id: 'LW', type: 'wedge', number: 'LW', loft: 60 },
  { id: 'Putter', type: 'putter', number: null, loft: 3 },
];

export const IRON_SET = ['4 iron', '5 iron', '6 iron', '7 iron', '8 iron', '9 iron', 'PW'] as const;

export const TYPICAL_NOTE = 'Typical loft and flex. Not measured. Leave them blank if you do not know.';

export function lastIdentity(clubs: readonly ScanClub[]): { brand: string; model: string } | null {
  for (let index = clubs.length - 1; index >= 0; index -= 1) {
    const club = clubs[index];
    if (!club) continue;
    if (club.brand && club.model) return { brand: club.brand, model: club.model };
  }
  return null;
}

export function flexForSpeed(mph: number | null): FlexLetter | null {
  if (mph == null || !Number.isFinite(mph)) return null;
  return primaryFlex(mph);
}

export function quickClub(input: {
  brand: string;
  model: string;
  typeId: string;
  useTypical: boolean;
  driverSpeed: number | null;
  now?: string;
}): ScanClub | null {
  const spec = QUICK_TYPES.find((item) => item.id === input.typeId);
  if (!spec) return null;
  const brand = input.brand.trim();
  const model = input.model.trim();
  return {
    id: `quick-${input.now ?? new Date().toISOString()}-${spec.id.replace(/\s/g, '')}`,
    slot: spec.id,
    inPlay: true,
    brand: brand || null,
    model: model || null,
    type: spec.type,
    loft: input.useTypical ? spec.loft : null,
    flex: input.useTypical ? flexForSpeed(input.driverSpeed) : null,
    ironBuild: null,
    photoUri: null,
    fitAck: null,
    fitAckOn: null,
    clubNumber: spec.number,
    identifiedBy: 'typed',
    source: 'entered',
    estimatedCarry: null,
    distanceBasis: null,
  };
}

export function ironSet(input: { brand: string; model: string; useTypical: boolean; driverSpeed: number | null; now?: string }): ScanClub[] {
  return IRON_SET.flatMap((typeId, index) => {
    const club = quickClub({ ...input, typeId, now: `${input.now ?? 'set'}-${index}` });
    return club ? [club] : [];
  });
}

export function draftFromQuick(club: Pick<ScanClub, 'brand' | 'model' | 'type' | 'loft' | 'flex' | 'clubNumber'>): Partial<ScanDraft> {
  return {
    brand: club.brand ?? '',
    model: club.model ?? '',
    type: club.type,
    loftText: club.loft == null ? '' : String(club.loft),
    flex: club.flex,
    clubNumber: club.clubNumber ?? '',
  };
}
