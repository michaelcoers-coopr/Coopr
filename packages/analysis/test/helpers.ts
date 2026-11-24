import type { HoleInput, RoundInput, ShotInput } from '../src/types';

/** HAND-BUILT TEST DATA (synthetic). */
export function hole(n: number, o: Partial<HoleInput> = {}): HoleInput {
  return { number: n, par: 4, yards: 380, strokeIndex: n, strokes: 5, putts: 2, penalties: 0, fairway: null, gir: null, firstPuttFeet: null, teeClub: null, pressure: [], bbNet: null, ...o };
}
export function round(id: string, holes: HoleInput[], o: Partial<RoundInput> = {}): RoundInput {
  return { id, playedOn: '2026-07-01', courseId: 'c1', courseName: 'Test Course', teeName: null, startPeriod: null, format: null, targetScore: null, holes, isSample: true, quality: 'user_confirmed', ...o };
}
export const eighteen = (f: (n: number) => Partial<HoleInput>): HoleInput[] => Array.from({ length: 18 }, (_, i) => hole(i + 1, f(i + 1)));
export function shot(o: Partial<ShotInput> & { id: string; club: string }): ShotInput {
  return {
    roundId: null, environment: 'range', hole: null, seq: null, startLie: null, startDistToPinYds: null, endLie: null, endDistToPinYds: null,
    penaltyStrokes: 0, carryYds: null, totalYds: null, carryQuality: 'measured', lateralYds: null, longitudinalYds: null, isSample: true, ...o,
  };
}
