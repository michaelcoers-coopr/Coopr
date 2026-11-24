import { describe, expect, it } from 'vitest';
import { GOLF_BRANDS, modelsFor, optionalModelHints } from '../src/clubs/catalog';
import { estimateCarry, primaryFlex } from '../src/clubs/distances';
import { ironSet, lastIdentity, quickClub } from '../src/clubs/quick';
import { estimatedPick, mergeStarter, starterAdvice, starterBag } from '../src/clubs/starter';
import type { ScanClub } from '../src/bag-scan/types';

describe('starter bag and fast entry', () => {
  it('builds 14 generic clubs and labels every carry estimated', () => {
    const both = starterBag({ handicap: 18, driverSpeed: 92 });
    expect(both).toHaveLength(14);
    expect(both.every((club) => club.brand == null && club.model == null && club.loft == null)).toBe(true);
    expect(both.every((club) => club.inPlay)).toBe(true);
    expect(both.find((club) => club.slot === 'Lob wedge')?.inPlay).toBe(true);
    expect(both.find((club) => club.slot === 'Putter')?.inPlay).toBe(true);
    const crowded = Array.from({ length: 12 }, (_, index) => ({ ...both[0]!, id: `owned-${index}`, slot: `Other ${index}`, source: 'entered' as const, inPlay: true }));
    const withRoom = mergeStarter(crowded, both);
    expect(withRoom.find((club) => club.slot === 'Lob wedge')?.inPlay).toBe(true);
    expect(withRoom.find((club) => club.slot === 'Putter')?.inPlay).toBe(true);
    expect(both.filter((club) => club.slot !== 'Putter').every((club) => club.estimatedCarry != null && club.distanceBasis?.includes('Regular'))).toBe(true);
    expect(both.find((club) => club.slot === 'Putter')?.estimatedCarry).toBeNull();
    const ladies = starterBag({ handicap: 12, driverSpeed: 70 });
    expect(ladies[0]?.distanceBasis).toMatch(/Ladies/);
    expect(estimateCarry({ club: '7I', handicap: null, driverSpeed: 100 }).basis).toBe('All-player average');
    expect(estimateCarry({ club: '7I', handicap: 10, driverSpeed: null }).basis).toBe('All-player average');
    expect(primaryFlex(70)).toBe('L');
    const advice = starterAdvice(both, 150);
    expect(advice).toMatch(/^Estimated\./);
    expect(advice).toMatch(/not a measured shot/);
  });

  it('keeps a scanned club and skips that starter slot', () => {
    const scanned = { ...starterBag({ handicap: null, driverSpeed: null })[4]!, id: 'real', source: 'entered' as const, brand: 'Ping', slot: '5 iron', estimatedCarry: null };
    const merged = mergeStarter([scanned], starterBag({ handicap: null, driverSpeed: null }));
    expect(merged.filter((club) => club.slot === '5 iron')).toHaveLength(1);
    expect(merged.find((club) => club.slot === '5 iron')?.brand).toBe('Ping');
    expect(merged).toHaveLength(14);
    const base = starterBag({ handicap: null, driverSpeed: null });
    const owned = base.slice(0, 8).map((club) => ({ ...club, source: 'entered' as const, brand: 'Ping' }));
    owned.push({ ...base[9]!, id: 'pw', source: 'entered' as const, slot: 'PW', clubNumber: 'PW', brand: 'Ping' });
    const filled = mergeStarter(owned, starterBag({ handicap: null, driverSpeed: null }));
    expect(filled.filter((club) => club.inPlay)).toHaveLength(14);
    expect(filled.filter((club) => club.slot === 'PW' || club.slot === 'Pitching wedge')).toHaveLength(1);
    expect(filled.find((club) => club.slot === 'PW')?.brand).toBe('Ping');
    const pick = estimatedPick(starterBag({ handicap: 20, driverSpeed: 95 }), 153);
    expect(pick?.line.startsWith('Estimated.')).toBe(true);
    expect(pick?.label).toMatch(/iron/);
    expect(pick?.line).not.toMatch(/not measured/i);
  });

  it('copies the last brand and does not invent loft until asked', () => {
    expect(GOLF_BRANDS).toEqual(['Titleist', 'Callaway', 'TaylorMade', 'Ping', 'Cobra', 'Mizuno', 'Srixon', 'Cleveland', 'Wilson', 'PXG']);
    expect(modelsFor('Titleist', 'gt').length).toBeGreaterThan(0);
    expect(modelsFor('Titleist', 'no-such').length).toBe(0);
    const prior = [{ brand: 'Ping', model: 'i530' } as ScanClub];
    expect(lastIdentity(prior)).toEqual({ brand: 'Ping', model: 'i530' });
    const blank = quickClub({ brand: 'Ping', model: 'i530', typeId: '7 iron', useTypical: false, driverSpeed: 98, now: 't' });
    expect(blank?.loft).toBeNull();
    expect(blank?.flex).toBeNull();
    const typical = quickClub({ brand: 'Ping', model: 'i530', typeId: '7 iron', useTypical: true, driverSpeed: 98, now: 't' });
    expect(typical?.loft).toBe(31);
    expect(typical?.flex).toBe('S');
    expect(ironSet({ brand: 'Ping', model: 'i530', useTypical: false, driverSpeed: null, now: 'set' })).toHaveLength(7);
  });

  it('ignores a caddie reply that is not a model list', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ line: 'Try a 7 iron' }), { status: 200 })) as typeof fetch;
    process.env.EXPO_PUBLIC_EXTRACT_URL = 'https://caddie.example';
    expect(await optionalModelHints('Ping', fetchImpl)).toEqual([]);
    delete process.env.EXPO_PUBLIC_EXTRACT_URL;
  });
});
