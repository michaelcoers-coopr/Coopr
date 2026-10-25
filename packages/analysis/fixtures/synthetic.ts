/**
 * SYNTHETIC TEST DATA. Not a real player, not real shots, not a claim about any real course.
 * Generated from a seeded model ("Sample Sam") so the engine has realistic-shaped inputs.
 * Every row has isSample: true, so every insight built from it carries the SAMPLE label.
 *
 * Designed-in quirks (so tests can confirm the engine can SEE them, not that they are true of anyone):
 *   - holes 4 and 11 eat balls (high penalty probability)
 *   - tee misses lean right
 *   - a weak lag putter (3-putts)
 *   - a slightly worse back nine
 *   - 7-iron lands right of target, a PW-to-SW hole in the bag, HY and 5I carry almost the same
 */
import type { HoleInput, RoundInput, ShotInput, Lie, FairwayResult } from '../src/types';

export function rng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = (mu = 0, sdv = 1) => mu + sdv * Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, n };
}

export const COURSE = {
  id: 'synthetic-pines',
  name: 'Synthetic Pines (test course)',
  pars: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5],
  yards: [372, 405, 168, 521, 388, 350, 152, 415, 505, 380, 412, 176, 530, 365, 398, 160, 345, 515],
  si: [7, 1, 15, 3, 9, 13, 17, 5, 11, 8, 2, 16, 4, 10, 6, 18, 14, 12],
};

export const CARRY: Record<string, number> = { DR: 214, '3W': 188, HY: 172, '5I': 169, '6I': 156, '7I': 145, '8I': 134, '9I': 122, PW: 109, SW: 78 };
const BIAS: Record<string, number> = { DR: 5, '7I': 6 };
const SDLAT: Record<string, number> = { DR: 17, '3W': 14, HY: 12, '5I': 11, '6I': 10, '7I': 9, '8I': 8, '9I': 7, PW: 6, SW: 5 };

function clubFor(d: number): string {
  if (d >= 185) return '3W';
  if (d >= 168) return 'HY';
  if (d >= 160) return '5I';
  if (d >= 148) return '6I';
  if (d >= 138) return '7I';
  if (d >= 126) return '8I';
  if (d >= 115) return '9I';
  if (d >= 95) return 'PW';
  return 'SW';
}

export interface SimRound {
  round: RoundInput;
  shots: ShotInput[];
}

export function simulateRound(index: number, opts: { playedOn: string; period: 'am' | 'pm'; format: 'solo' | 'game'; target: number | null; weekend: boolean }): SimRound {
  const { u, n } = rng(1000 + index * 7919);
  const roundId = `synth-r${index + 1}`;
  const shots: ShotInput[] = [];
  const holes: HoleInput[] = [];
  for (let h = 0; h < 18; h++) {
    const par = COURSE.pars[h]!;
    const yards = COURSE.yards[h]!;
    const back = h >= 9 ? 0.85 : 1;
    const penBase = h === 3 || h === 10 ? 0.45 : 0.05;
    const pen = penBase * (opts.weekend ? 0.7 : 1.3);
    let lie: Lie = 'tee';
    let d = yards;
    let seq = 0;
    let fairway: FairwayResult | null = null;
    let teeClub: string | null = null;
    const mk = (club: string, endLie: ShotInput['endLie'], endD: number | null, penaltyStrokes: number, carry: number | null, lat: number | null, lon: number | null): void => {
      seq += 1;
      shots.push({
        id: `${roundId}-h${h + 1}-s${seq}`, roundId, environment: 'course', hole: h + 1, seq, club,
        startLie: lie, startDistToPinYds: Math.round(d * 10) / 10, endLie, endDistToPinYds: endD === null ? null : Math.round(endD * 10) / 10,
        penaltyStrokes, carryYds: carry, totalYds: null, carryQuality: carry === null ? 'unknown' : 'estimated',
        lateralYds: lat, longitudinalYds: lon, isSample: true,
      });
    };
    let guard = 0;
    while (guard++ < 30) {
      if (lie === 'green') {
        const ft = Math.max(1, d * 3);
        const pHole = 1 / (1 + (ft / 7) ** 1.6);
        if (u() < pHole) { mk('PT', 'holed', 0, 0, null, null, null); break; }
        const leave = Math.max(0.3, d * (u() < 0.1 ? 0.3 : 0.04 + 0.09 * u()) + Math.abs(n(0, 0.2)));
        mk('PT', 'green', leave, 0, null, null, null);
        d = leave;
        continue;
      }
      if (lie === 'tee' && par >= 4) {
        const club = 'DR';
        teeClub = club;
        const carry = n(CARRY.DR!, 14);
        const lat = n(BIAS.DR!, SDLAT.DR!);
        const lon = n(0, 10);
        if (u() < pen) {
          const dropD = Math.max(40, d - carry * 0.7);
          mk(club, 'rough', dropD, 1, carry, lat + (lat > 0 ? 30 : -30), lon);
          lie = 'rough'; d = dropD;
          fairway = lat > 0 ? 'right' : 'left';
          continue;
        }
        const total = carry + 18 + n(0, 5);
        const endD = Math.max(30, d - total);
        const inFw = Math.abs(lat) < 15;
        const el: Lie = inFw ? 'fairway' : 'rough';
        fairway = inFw ? 'hit' : lat > 0 ? 'right' : 'left';
        mk(club, el, endD, 0, carry, lat, lon);
        lie = el; d = endD;
        continue;
      }
      const club = lie === 'tee' ? clubFor(d) : clubFor(d);
      if (d <= 30) {
        const endD = Math.min(18, Math.max(0.8, Math.exp(n(Math.log(3.2), 0.55))));
        const onGreen = u() < 0.86;
        const nd = Math.round((onGreen ? endD : 4 + 8 * u()) * 10) / 10;
        mk('SW', onGreen ? 'green' : 'rough', nd, 0, null, null, null);
        lie = onGreen ? 'green' : 'rough'; d = nd;
        continue;
      }
      if (d > 192) {
        const carry = n(CARRY['3W']!, 12);
        const endD = Math.max(45, d - carry - 8);
        const penA = u() < 0.03;
        mk('3W', penA ? 'rough' : u() < 0.7 ? 'fairway' : 'rough', endD, penA ? 1 : 0, carry, n(0, 14), n(0, 9));
        lie = shots[shots.length - 1]!.endLie as Lie; d = endD;
        continue;
      }
      const lieMult = lie === 'fairway' || lie === 'tee' ? 1 : lie === 'rough' ? 0.75 : 0.6;
      const pGreen = Math.min(0.7, Math.max(0.12, (0.62 - (d - 100) * 0.0025) * lieMult * back));
      const lat = n(BIAS[club] ?? 0, SDLAT[club] ?? 8);
      const lon = n(0, 8);
      if (u() < pGreen) {
        const endD = Math.min(30, Math.max(2, Math.exp(n(Math.log(0.07 * d + 5), 0.5))));
        mk(club, 'green', endD, 0, n(CARRY[club] ?? 100, 6), lat, lon);
        lie = 'green'; d = endD;
      } else {
        const endD = 4 + 22 * u();
        const sand = u() < 0.25;
        mk(club, sand ? 'sand' : 'rough', endD, 0, n(CARRY[club] ?? 100, 6), lat, lon);
        lie = sand ? 'sand' : 'rough'; d = endD;
      }
    }
    const hs = shots.filter((s) => s.hole === h + 1);
    const penalties = hs.reduce((a, s) => a + s.penaltyStrokes, 0);
    const strokes = hs.length + penalties;
    const putts = hs.filter((s) => s.startLie === 'green').length;
    const firstPutt = hs.find((s) => s.startLie === 'green');
    const firstGreen = hs.findIndex((s) => s.startLie === 'green');
    let used = 0;
    for (let i = 0; i < firstGreen; i++) used += 1 + hs[i]!.penaltyStrokes;
    holes.push({
      number: h + 1, par, yards, strokeIndex: COURSE.si[h]!, strokes, putts, penalties,
      fairway: par >= 4 ? fairway : null, gir: firstGreen >= 0 ? used <= par - 2 : false,
      firstPuttFeet: firstPutt ? Math.round(firstPutt.startDistToPinYds! * 3) : null, teeClub: par >= 4 ? teeClub : null,
      pressure: [], bbNet: opts.format === 'game' ? Math.round(n(0, 6)) : null,
    });
  }
  const round: RoundInput = {
    id: roundId, playedOn: opts.playedOn, courseId: COURSE.id, courseName: COURSE.name, teeName: 'Blue (synthetic)', startPeriod: opts.period,
    format: opts.format, targetScore: opts.target, holes, isSample: true, quality: 'user_confirmed',
  };
  return { round, shots };
}

/** Twelve synthetic rounds: alternating Saturday/Tuesday, am/pm, game/solo, several with a "break 90" target. */
export function syntheticSeason(): SimRound[] {
  const dates = ['2026-06-02', '2026-06-06', '2026-06-09', '2026-06-13', '2026-06-16', '2026-06-20', '2026-06-23', '2026-06-27', '2026-06-30', '2026-07-04', '2026-07-07', '2026-07-11'];
  return dates.map((d, i) => simulateRound(i, { playedOn: d, period: i % 4 < 2 ? 'am' : 'pm', format: i % 2 === 0 ? 'solo' : 'game', target: i % 3 === 0 ? null : 85, weekend: i % 2 === 1 }));
}

/** Range / monitor shots for gapping and dispersion. Synthetic. Counts per club chosen to exercise the gates. */
export function syntheticRangeShots(): ShotInput[] {
  const counts: Record<string, number> = { DR: 30, '3W': 14, HY: 12, '5I': 11, '6I': 10, '7I': 22, '8I': 10, '9I': 9, PW: 12, SW: 6 };
  const { n } = rng(424242);
  const out: ShotInput[] = [];
  for (const [club, cnt] of Object.entries(counts)) {
    for (let i = 0; i < cnt; i++) {
      out.push({
        id: `synth-range-${club}-${i}`, roundId: null, environment: 'range', hole: null, seq: null, club,
        startLie: null, startDistToPinYds: null, endLie: null, endDistToPinYds: null, penaltyStrokes: 0,
        carryYds: Math.round(n(CARRY[club]!, club === 'DR' ? 13 : 6) * 10) / 10, totalYds: null, carryQuality: 'measured',
        lateralYds: Math.round(n(BIAS[club] ?? 0, SDLAT[club]!) * 10) / 10, longitudinalYds: Math.round(n(0, club === 'DR' ? 12 : 7) * 10) / 10, isSample: true,
      });
    }
  }
  return out;
}

/** A thin player: two rounds, strokes only. Everything should say "needs more", nothing should show a number. */
export function thinPlayer(): RoundInput[] {
  const season = syntheticSeason();
  return season.slice(0, 2).map(({ round }) => ({
    ...round, id: round.id.replace('synth', 'thin'),
    holes: round.holes.map((h) => ({ ...h, putts: null, penalties: null, fairway: null, gir: null, firstPuttFeet: null, teeClub: null, bbNet: null })),
  }));
}
