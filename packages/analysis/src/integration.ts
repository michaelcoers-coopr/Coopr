/**
 * Hand-offs to the other COOPR modules. Pure data mapping, no UI.
 *  - club fitter (bag gap): measured carries + dispersion, never defaults
 *  - club-distances: player shots in, "Default / Learning / Yours" state out
 *  - foursome: cosmetic crew badges and a "why you hustled" breakdown (Birdie Bucks are points, never money)
 */
import type { Config, Insight, RoundInput, ShotInput } from './types';
import { DEFAULT_CONFIG, notReady } from './gate';
import type { GapValue, DispersionValue } from './shots';
import { backNineFade, blowups, completeHoles, fullRounds, ledger, numFmt, penaltyLeaks, pressureHoles, tagBreakTargetPressure } from './holes';
import { mean, round2, sum } from './stats';

// ───────────────────────────── Club fitter ─────────────────────────────

export type FitterCategory = 'wedges' | 'fairway_hybrid' | 'irons' | 'driver';
export interface FitterGapInput {
  /** Measured only. Clubs that only have a default are NOT here (the fitter spec: defaults never feed gap analysis as if measured). */
  measured: { clubId: string; environment: string; shots: number; carryP20: number; carryP50: number; carryP80: number; label: 'Learning' | 'Yours'; dispersionWidthYds: number | null; aimOffsetYds: number | null }[];
  gaps: { longer: string; shorter: string; gapYds: number; flag: 'big' | 'overlap' | 'ok'; category: FitterCategory; /** Carry to aim a new club at: midpoint of a big gap. null unless flag is 'big'. */ targetCarryYds: number | null }[];
  unmeasured: { clubId: string; shots: number }[];
  dataQuality: 'measured';
  sample: boolean;
  /** The fitter must not receive commission data; this is a reminder, enforced by shape: there is no price or brand here. */
  brandNeutral: true;
}
const WEDGES = new Set(['PW', 'GW', 'AW', 'SW', 'LW']);
const WOODS = new Set(['DR', '3W', '5W', '7W', 'HY']);
export function categoryForGap(longer: string, shorter: string): FitterCategory {
  if (WEDGES.has(longer) || WEDGES.has(shorter)) return 'wedges';
  if (longer === 'DR') return 'driver';
  if (WOODS.has(longer) || WOODS.has(shorter)) return 'fairway_hybrid';
  return 'irons';
}
export function toFitterBagGap(gap: Insight<GapValue>, disp: Insight<DispersionValue> | null): FitterGapInput | null {
  if (gap.status !== 'ready' || !gap.value) return null;
  const dmap = new Map((disp?.value?.clubs ?? []).map((c) => [c.club, c]));
  const clubs = gap.value.clubs;
  return {
    measured: clubs.map((c) => ({
      clubId: c.club, environment: c.environment, shots: c.n, carryP20: c.p20!, carryP50: c.p50!, carryP80: c.p80!, label: c.label === 'Yours' ? 'Yours' : 'Learning',
      dispersionWidthYds: dmap.get(c.club)?.widthYds ?? null, aimOffsetYds: dmap.get(c.club)?.aimOffsetYds ?? null,
    })),
    gaps: gap.value.gaps.map((g) => {
      const lo = clubs.find((c) => c.club === g.shorter)!.p50!;
      return { ...g, category: categoryForGap(g.longer, g.shorter), targetCarryYds: g.flag === 'big' ? Math.round(lo + g.gapYds / 2) : null };
    }),
    unmeasured: gap.value.unmeasured.map((u) => ({ clubId: u.club, shots: u.n })),
    dataQuality: 'measured', sample: gap.sample, brandNeutral: true,
  };
}

// ───────────────────────────── Club-distances (default -> measured) ─────────────────────────────

/** Maps analysis shots to the club-distances engine's PlayerShot[] for one club. Carry and total stay separate; null stays null. */
export function toPlayerShots(shots: readonly ShotInput[], club: string): { carry: number | null; total: number | null }[] {
  return shots.filter((s) => s.club === club && (s.carryYds !== null || s.totalYds !== null)).map((s) => ({ carry: s.carryYds, total: s.totalYds }));
}

// ───────────────────────────── Foursome ─────────────────────────────

export interface CrewMember {
  playerId: string;
  displayName: string;
  /** Stats leave the device only if the player opted in per stat. Opted-out players never appear in any badge. */
  sharesStats: boolean;
  rounds: RoundInput[];
}
export interface CrewBadge {
  id: 'closer' | 'clean_card' | 'ice' | 'no_doubles';
  label: string;
  /** Cosmetic only: no prize, no BB, no ranking effect. Winners (ties shared). */
  winners: { playerId: string; value: number; basisN: number }[];
  /** How the value reads. */
  unit: string;
}
export const CREW_BADGE_DISCLOSURE = 'Cosmetic badges for bragging rights. No prize, no Birdie Bucks, no effect on Hustler of the Week.';

/** Score-to-par per hole, holes 16-18 minus holes 1-15, per round. Negative = finishes better than starts. */
export function closerDelta(rounds: readonly RoundInput[], cfg: Config = DEFAULT_CONFIG): Insight<{ meanDelta: number; rounds: number }> {
  const full = fullRounds(rounds);
  const gate = cfg.gate.backNine!;
  const args = { id: 'closer', title: 'Closer', n: full.length, nUnit: 'complete rounds', gate, baseline: 'own_average' as const, sample: full.some((r) => r.isSample), quality: 'user_confirmed' as const, invitationUnit: { text: 'complete 18-hole rounds' } };
  const nr = notReady<{ meanDelta: number; rounds: number }>(args);
  if (nr) return nr;
  const d = full.map((r) => mean(r.holes.slice(15).map((h) => h.strokes! - h.par!))! - mean(r.holes.slice(0, 15).map((h) => h.strokes! - h.par!))!);
  const { numbers } = numFmt();
  return { id: 'closer', title: 'Closer', status: 'ready', value: { meanDelta: round2(mean(d)!), rounds: full.length }, n: full.length, nUnit: 'complete rounds', nNeeded: gate[0], confidence: 'limited', sample: args.sample, quality: 'user_confirmed', baseline: 'own_average', invitation: null, take: null, numbers, missingInputs: [] };
}

export function crewBadges(members: readonly CrewMember[], cfg: Config = DEFAULT_CONFIG): CrewBadge[] {
  const opted = members.filter((m) => m.sharesStats);
  const winnersOf = (rows: { playerId: string; value: number; basisN: number }[], better: 'low' | 'high') => {
    if (rows.length === 0) return [];
    const best = better === 'low' ? Math.min(...rows.map((r) => r.value)) : Math.max(...rows.map((r) => r.value));
    return rows.filter((r) => r.value === best);
  };
  const out: CrewBadge[] = [];
  const closer = opted.map((m) => ({ m, i: closerDelta(m.rounds, cfg) })).filter((x) => x.i.status === 'ready' && x.i.value!.meanDelta < 0)
    .map((x) => ({ playerId: x.m.playerId, value: x.i.value!.meanDelta, basisN: x.i.n }));
  const clean = opted.map((m) => ({ m, i: penaltyLeaks(m.rounds, cfg) })).filter((x) => x.i.status === 'ready')
    .map((x) => ({ playerId: x.m.playerId, value: x.i.value!.perRound, basisN: x.i.n }));
  const ice = opted.map((m) => ({ m, i: pressureHoles(m.rounds.map((r) => tagBreakTargetPressure(r, cfg)), cfg) })).filter((x) => x.i.status === 'ready' && x.i.value!.verdict === 'pressure_player')
    .map((x) => ({ playerId: x.m.playerId, value: x.i.value!.meanDelta, basisN: x.i.n }));
  const nod = opted.map((m) => ({ m, i: blowups(m.rounds, cfg) })).filter((x) => x.i.status === 'ready')
    .map((x) => ({ playerId: x.m.playerId, value: x.i.value!.per18, basisN: x.i.n }));
  const push = (id: CrewBadge['id'], label: string, unit: string, rows: typeof closer, better: 'low' | 'high') => {
    const w = winnersOf(rows, better);
    if (w.length) out.push({ id, label, winners: w, unit });
  };
  // A badge needs at least two eligible players, otherwise "best of one" is meaningless.
  if (closer.length >= 2) push('closer', 'Closer', 'strokes per hole, last 3 vs first 15', closer, 'low');
  if (clean.length >= 2) push('clean_card', 'Clean Card', 'penalties per round', clean, 'low');
  if (ice.length >= 2) push('ice', 'Ice', 'strokes per pressure hole vs own normal', ice, 'low');
  if (nod.length >= 2) push('no_doubles', 'No Doubles', 'double-bogeys-or-worse per 18', nod, 'low');
  return out;
}

export interface HustlerExplainer {
  holesWithBB: number;
  bbNetTotal: number;
  byPar: { par3: number; par4: number; par5: number };
  onPressureHoles: number;
  biggestSwing: { holeNumber: number; bb: number } | null;
  take: string;
  numbers: number[];
  disclosure: string;
  sample: boolean;
}
export const BB_DISCLOSURE = 'Birdie Bucks are game points with no real-world value. They can\'t be bought, sold or redeemed.';
/** "Why you hustled": where this player's Birdie Bucks came from. Does NOT decide Hustler of the Week (that is BB net, in foursome). */
export function hustlerExplainer(rounds: readonly RoundInput[], minHoles = 9): HustlerExplainer | null {
  const hs = rounds.flatMap((r) => r.holes.filter((h) => h.bbNet !== null && h.par !== null).map((h) => ({ r, h })));
  if (hs.length < minHoles) return null;
  const by = { par3: 0, par4: 0, par5: 0 };
  let press = 0;
  let big: { holeNumber: number; bb: number } | null = null;
  for (const { h } of hs) {
    const k = h.par! <= 3 ? 'par3' : h.par === 4 ? 'par4' : 'par5';
    by[k] += h.bbNet!;
    if (h.pressure.length > 0) press += h.bbNet!;
    if (!big || Math.abs(h.bbNet!) > Math.abs(big.bb)) big = { holeNumber: h.number, bb: h.bbNet! };
  }
  const total = sum(hs.map((x) => x.h.bbNet!));
  const { numbers, f } = numFmt();
  const best = (Object.entries(by) as [string, number][]).sort((a, b) => b[1] - a[1])[0]!;
  const bestLabel = best[0].replace('par', 'par ') + 's';
  const take = total > 0 && best[1] > 0
    ? `Your ${f(total, 0)} BB came mostly from ${bestLabel} (${f(best[1], 0)} BB). That's where you hustle.`
    : total <= 0 ? `You're ${f(Math.abs(total), 0)} BB down. Your best category is ${bestLabel} at ${f(best[1], 0)} BB: lean on it.` : `You're up ${f(total, 0)} BB with no standout hole type.`;
  return { holesWithBB: hs.length, bbNetTotal: total, byPar: by, onPressureHoles: press, biggestSwing: big, take, numbers, disclosure: BB_DISCLOSURE, sample: hs.some((x) => x.r.isSample) };
}

export { completeHoles, ledger };
