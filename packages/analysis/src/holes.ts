/**
 * Hole-level (scorecard) insights. These need only what the app already stores in `hole_scores`
 * (strokes, putts, penalties, par) plus optional fairway / GIR flags. No GPS, no baseline dataset.
 */
import type { Config, Confidence, Insight, LedgerItem, Quality, RoundInput, HoleInput, PressureTag } from './types';
import { confidenceFor, notReady, notCollected, ready, weakestQuality, plural } from './gate';
import { mean, se, sd, sum, round1, round2, signTestP } from './stats';

export interface HoleRef {
  round: RoundInput;
  hole: HoleInput;
}
export interface CompleteHole extends HoleRef {
  par: number;
  strokes: number;
  putts: number;
  penalties: number;
}

/** Numbers helper: formats and whitelists every figure that appears in a take. */
export function numFmt() {
  const numbers: number[] = [];
  const f = (x: number, d = 1): string => {
    const r = Number(x.toFixed(d));
    numbers.push(r);
    return String(r);
  };
  return { numbers, f };
}

export function allHoles(rounds: readonly RoundInput[]): HoleRef[] {
  return rounds.flatMap((round) => round.holes.map((hole) => ({ round, hole })));
}
export function completeHoles(rounds: readonly RoundInput[]): CompleteHole[] {
  const out: CompleteHole[] = [];
  for (const { round, hole } of allHoles(rounds)) {
    if (hole.par === null || hole.strokes === null || hole.putts === null || hole.penalties === null) continue;
    if (hole.par < 3) continue;
    out.push({ round, hole, par: hole.par, strokes: hole.strokes, putts: hole.putts, penalties: hole.penalties });
  }
  return out;
}
export function isSample(rounds: readonly RoundInput[]): boolean {
  return rounds.some((r) => r.isSample);
}
export function qualityOf(rounds: readonly RoundInput[]): Quality {
  return weakestQuality(rounds.map((r) => r.quality));
}
/** A round with 18 holes, each with par and strokes. */
export function fullRounds(rounds: readonly RoundInput[]): RoundInput[] {
  return rounds.filter((r) => r.holes.length === 18 && r.holes.every((h) => h.par !== null && h.strokes !== null));
}
export function toPar(h: { par: number | null; strokes: number | null }): number | null {
  return h.par === null || h.strokes === null ? null : h.strokes - h.par;
}
const parBucket = (par: number): 'par3' | 'par4' | 'par5' => (par <= 3 ? 'par3' : par === 4 ? 'par4' : 'par5');

// ───────────────────────────── Loss ledger ─────────────────────────────

export interface LedgerSums {
  penalties: number;
  putting: number;
  ttg_par3: number;
  ttg_par4: number;
  ttg_par5: number;
  /** Tee-to-green split by what happened (needs GIR and fairway logged on every hole). */
  ttg_fw_miss: number;
  ttg_miss_green: number;
  ttg_gir: number;
  ttgTotal: number;
  outcomeCounts: { fw_miss: number; miss_green: number; gir: number };
  /** True when every hole in the sample has GIR (and a fairway result on par 4/5), so the outcome split is exact. */
  hasOutcomeFlags: boolean;
  holes: number;
  totalOverPar: number;
  holeCounts: { par3: number; par4: number; par5: number };
}

/**
 * Exact decomposition of (strokes - par) on each complete hole:
 *   strokes - par = penalties + putting + tee_to_green
 *   putting       = putts - putAllotment            (only when putts >= 1; a holed-out hole has putting = 0)
 *   tee_to_green  = strokes - penalties - putting - par
 * The allotment (par = 2 putts + (par-2) strokes to the green) is a stated rule, not a statistical baseline.
 * Buckets always sum to strokes - par; a test enforces it.
 */
export function ledgerSums(holes: readonly CompleteHole[], cfg: Config): LedgerSums {
  const s: LedgerSums = { penalties: 0, putting: 0, ttg_par3: 0, ttg_par4: 0, ttg_par5: 0, ttg_fw_miss: 0, ttg_miss_green: 0, ttg_gir: 0, ttgTotal: 0, outcomeCounts: { fw_miss: 0, miss_green: 0, gir: 0 }, hasOutcomeFlags: holes.length > 0 && holes.every((x) => x.hole.gir !== null && (x.par < 4 || x.hole.fairway !== null)), holes: holes.length, totalOverPar: 0, holeCounts: { par3: 0, par4: 0, par5: 0 } };
  for (const h of holes) {
    const putting = h.putts >= 1 ? h.putts - cfg.putAllotment : 0;
    const ttg = h.strokes - h.penalties - putting - h.par;
    const b = parBucket(h.par);
    s.penalties += h.penalties;
    s.putting += putting;
    s[`ttg_${b}` as 'ttg_par3'] += ttg;
    s.ttgTotal += ttg;
    if (s.hasOutcomeFlags) {
      const k = h.hole.gir === true ? 'gir' : h.par >= 4 && h.hole.fairway !== 'hit' ? 'fw_miss' : 'miss_green';
      s[`ttg_${k}` as 'ttg_gir'] += ttg;
      s.outcomeCounts[k] += 1;
    }
    s.holeCounts[b] += 1;
    s.totalOverPar += h.strokes - h.par;
  }
  return s;
}

const LEDGER_LABELS: Record<LedgerItem['id'], string> = {
  penalties: 'Penalty strokes',
  putting: 'Putting (vs a 2-putt par)',
  ttg_par3: 'Par 3: tee to green',
  ttg_par4: 'Par 4: tee to green',
  ttg_par5: 'Par 5: tee to green',
  ttg_fw_miss: 'Missed green after missing the fairway',
  ttg_miss_green: 'Missed green from the fairway (or a par 3)',
  ttg_gir: 'Holes where you hit the green',
};

export interface LedgerValue {
  items: LedgerItem[]; // ranked, biggest loss first (gains last)
  totalOverParPer18: number;
  holes: number;
  holesSkipped: number;
  method: 'par_allotment';
  /** 'by_outcome' when GIR + fairway are logged on every hole; otherwise 'by_par_type'. Buckets add to total over par either way. */
  split: 'by_outcome' | 'by_par_type';
}

export function ledger(rounds: readonly RoundInput[], cfg: Config): Insight<LedgerValue> {
  const ch = completeHoles(rounds);
  const total = allHoles(rounds).length;
  const gate = cfg.gate.ledger!;
  const args = {
    id: 'loss_ledger', title: 'Where you lose strokes', n: ch.length, nUnit: 'holes', gate, baseline: 'par_allotment' as const,
    sample: isSample(rounds), quality: qualityOf(rounds),
    invitationUnit: {
      perRound: 18,
      text: ch.length < total ? 'rounds with strokes, putts and penalties logged on every hole' : 'rounds',
    },
    missingInputs: ch.length < total ? ['putts and/or penalties on some holes'] : [],
  };
  const nr = notReady<LedgerValue>(args);
  if (nr) return nr;
  const s = ledgerSums(ch, cfg);
  const per18 = (x: number) => (x / s.holes) * 18;
  const parts: { id: LedgerItem['id']; v: number; holes: number }[] = [
    { id: 'penalties', v: s.penalties, holes: s.holes },
    { id: 'putting', v: s.putting, holes: s.holes },
    ...(s.hasOutcomeFlags
      ? [
          { id: 'ttg_fw_miss' as const, v: s.ttg_fw_miss, holes: s.outcomeCounts.fw_miss },
          { id: 'ttg_miss_green' as const, v: s.ttg_miss_green, holes: s.outcomeCounts.miss_green },
          { id: 'ttg_gir' as const, v: s.ttg_gir, holes: s.outcomeCounts.gir },
        ]
      : [
          { id: 'ttg_par3' as const, v: s.ttg_par3, holes: s.holeCounts.par3 },
          { id: 'ttg_par4' as const, v: s.ttg_par4, holes: s.holeCounts.par4 },
          { id: 'ttg_par5' as const, v: s.ttg_par5, holes: s.holeCounts.par5 },
        ]),
  ];
  // Per-18 is normalised on ALL holes so the buckets add up to the round, not on the bucket's own holes.
  const items: LedgerItem[] = parts
    .map((p) => ({ id: p.id, label: LEDGER_LABELS[p.id], strokesPer18: round2(per18(p.v)), holes: p.holes }))
    .sort((a, b) => b.strokesPer18 - a.strokesPer18 || a.id.localeCompare(b.id));
  const { numbers, f } = numFmt();
  const top = items[0]!;
  const take =
    top.strokesPer18 > 0
      ? `Biggest leak: ${top.label} at ${f(top.strokesPer18)} strokes a round against par's own allowance. That's where your next shot comes from, not your driver ego.`
      : `Nothing is leaking against par's allowance right now. Either you're playing well or your scorecard is lying. Keep logging.`;
  return ready(args, { items, totalOverParPer18: round2(per18(s.totalOverPar)), holes: s.holes, holesSkipped: total - ch.length, method: 'par_allotment', split: s.hasOutcomeFlags ? 'by_outcome' : 'by_par_type' }, take, numbers, confidenceFor(ch.length, gate));
}

// ───────────────────────────── Blow-ups ─────────────────────────────

export interface BlowupValue {
  holesDoublePlus: number;
  holes: number;
  per18: number;
  /** Strokes you would save per 18 if every double-or-worse had been a bogey. */
  bogeyCapSavingPer18: number;
}
export function blowups(rounds: readonly RoundInput[], cfg: Config): Insight<BlowupValue> {
  const ch = completeHoles(rounds);
  const gate = cfg.gate.blowups!;
  const args = { id: 'blowups', title: 'Blow-up holes', n: ch.length, nUnit: 'holes', gate, baseline: 'par_allotment' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { perRound: 18, text: 'rounds with a score on every hole' } };
  const nr = notReady<BlowupValue>(args);
  if (nr) return nr;
  const big = ch.filter((h) => h.strokes - h.par >= 2);
  const saving = sum(big.map((h) => h.strokes - h.par - 1));
  const per18 = (big.length / ch.length) * 18;
  const savePer18 = (saving / ch.length) * 18;
  const { numbers, f } = numFmt();
  const take =
    big.length === 0
      ? `No double bogeys or worse in this stretch. That's the Daly-proof way to play.`
      : `You make a double or worse ${f(per18)} times a round. Cap every one at bogey and you save ${f(savePer18)} strokes. Bogey is a fine score. Take the medicine, get back in play.`;
  return ready(args, { holesDoublePlus: big.length, holes: ch.length, per18: round2(per18), bogeyCapSavingPer18: round2(savePer18) }, take, numbers, confidenceFor(ch.length, gate));
}

// ───────────────────────────── Scoring by hole type ─────────────────────────────

export interface TypeBucket {
  key: string;
  label: string;
  group: 'par' | 'yardage' | 'difficulty';
  holes: number;
  avgToPar: number | null;
  doublePlusRate: number | null;
  birdieOrBetterRate: number | null;
  confidence: 'insufficient' | 'limited' | 'moderate' | 'solid';
  /** Set when the bucket is below the gate: the invitation, never a number. */
  invitation: string | null;
}
export interface ParTypeValue {
  buckets: TypeBucket[];
  best: string | null;
  worst: string | null;
}

function yardLabel(par: 3 | 4 | 5, band: number, edges: number[]): string {
  const lo = edges[0]!;
  const hi = edges[1]!;
  return band === 0 ? `Par ${par} under` : band === 1 ? `Par ${par} ${lo}-${hi}` : `Par ${par} over`;
}

export function scoringByHoleType(rounds: readonly RoundInput[], cfg: Config): Insight<ParTypeValue> {
  const gate = cfg.gate.parType!;
  const scored = allHoles(rounds).filter((r) => r.hole.par !== null && r.hole.strokes !== null && r.hole.par >= 3);
  const defs: { key: string; label: string; group: TypeBucket['group']; test: (r: HoleRef) => boolean }[] = [];
  for (const p of [3, 4, 5] as const) defs.push({ key: `par${p}`, label: `Par ${p}`, group: 'par', test: (r) => (p === 5 ? r.hole.par! >= 5 : r.hole.par === p) });
  for (const p of [3, 4, 5] as const) {
    const edges = cfg.yardageBands[`par${p}` as 'par3'];
    for (let b = 0; b < 3; b++) {
      defs.push({
        key: `par${p}_y${b}`, label: yardLabel(p, b, edges), group: 'yardage',
        test: (r) => {
          const par = r.hole.par!;
          if ((p === 5 ? par < 5 : par !== p) || r.hole.yards === null) return false;
          const y = r.hole.yards;
          return b === 0 ? y < edges[0]! : b === 1 ? y >= edges[0]! && y <= edges[1]! : y > edges[1]!;
        },
      });
    }
  }
  for (const [k, lo, hi, label] of [['si_hard', 1, 6, 'Hardest 6 (SI 1-6)'], ['si_mid', 7, 12, 'Middle 6 (SI 7-12)'], ['si_easy', 13, 18, 'Easiest 6 (SI 13-18)']] as const) {
    defs.push({ key: k, label, group: 'difficulty', test: (r) => r.hole.strokeIndex !== null && r.hole.strokeIndex >= lo && r.hole.strokeIndex <= hi });
  }
  const buckets: TypeBucket[] = defs.map((d) => {
    const hs = scored.filter(d.test);
    const n = hs.length;
    const conf = confidenceFor(n, gate);
    if (conf === 'insufficient') {
      return { key: d.key, label: d.label, group: d.group, holes: n, avgToPar: null, doublePlusRate: null, birdieOrBetterRate: null, confidence: conf, invitation: n === 0 ? `No ${d.label} holes logged yet.` : `Needs ${gate[0] - n} more ${d.label} holes.` };
    }
    const stp = hs.map((r) => r.hole.strokes! - r.hole.par!);
    return {
      key: d.key, label: d.label, group: d.group, holes: n, avgToPar: round2(mean(stp)!),
      doublePlusRate: round2(stp.filter((x) => x >= 2).length / n), birdieOrBetterRate: round2(stp.filter((x) => x <= -1).length / n),
      confidence: conf, invitation: null,
    };
  });
  const parBuckets = buckets.filter((b) => b.group === 'par');
  const args = { id: 'scoring_by_hole_type', title: 'Scoring by hole type', n: scored.length, nUnit: 'holes', gate, baseline: 'own_average' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { text: 'holes with a score' } };
  const nr = notReady<ParTypeValue>(args);
  if (nr || parBuckets.every((b) => b.avgToPar === null)) {
    return nr ?? { ...notReady<ParTypeValue>({ ...args, n: 0 })!, n: scored.length };
  }
  const rankable = buckets.filter((b) => b.avgToPar !== null && b.confidence !== 'limited' || (b.group === 'par' && b.avgToPar !== null));
  const worst = [...rankable].sort((a, b) => b.avgToPar! - a.avgToPar! || a.key.localeCompare(b.key))[0]!;
  const best = [...rankable].sort((a, b) => a.avgToPar! - b.avgToPar! || a.key.localeCompare(b.key))[0]!;
  const { numbers, f } = numFmt();
  for (const m of `${worst.label} ${best.label}`.match(/\d+/g) ?? []) numbers.push(Number(m)); // thresholds printed in bucket labels
  const take = worst.key === best.key
    ? `One bucket so far: ${worst.label} at ${f(worst.avgToPar!, 2)} over par a hole.`
    : `Worst spot: ${worst.label} at ${f(worst.avgToPar!, 2)} over par a hole. Best: ${best.label} at ${f(best.avgToPar!, 2)}. Play the first like it hates you and the second like you own it.`;
  const order: Confidence[] = ['insufficient', 'limited', 'moderate', 'solid'];
  // The headline names two buckets, so it is only as confident as the weaker of the two.
  const conf = order[Math.min(order.indexOf(worst.confidence), order.indexOf(best.confidence))]!;
  return ready(args, { buckets, best: best.key, worst: worst.key }, take, numbers, conf);
}

// ───────────────────────────── Putting ─────────────────────────────

export interface ThreePuttValue {
  holes: number;
  threePlus: number;
  per18: number;
  onePuttRate: number;
  twoPuttRate: number;
  threePlusRate: number;
  /** Strokes per 18 lost to putts beyond two (gross, ignores 1-putt gains). */
  excessPer18: number;
  byFirstPuttFeet: { bucket: string; holes: number; threePlusRate: number | null }[] | null;
}
export function threePutts(rounds: readonly RoundInput[], cfg: Config): Insight<ThreePuttValue> {
  const hs = allHoles(rounds).filter((r) => r.hole.putts !== null && r.hole.putts >= 1);
  const gate = cfg.gate.threePutt!;
  const args = { id: 'three_putt', title: '3-putt rate', n: hs.length, nUnit: 'holes', gate, baseline: 'par_allotment' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { perRound: 18, text: 'rounds with putts logged' }, missingInputs: hs.length === 0 ? ['putts per hole'] : [] };
  const nr = notReady<ThreePuttValue>(args);
  if (nr) return nr;
  const p = hs.map((r) => r.hole.putts!);
  const three = p.filter((x) => x >= 3).length;
  const excess = sum(p.map((x) => Math.max(0, x - cfg.putAllotment)));
  const withFeet = hs.filter((r) => r.hole.firstPuttFeet !== null);
  let byFeet: ThreePuttValue['byFirstPuttFeet'] = null;
  if (withFeet.length >= gate[0]) {
    const bands: [string, number, number][] = [['under 10 ft', 0, 10], ['10-25 ft', 10, 25], ['over 25 ft', 25, Infinity]];
    byFeet = bands.map(([bucket, lo, hi]) => {
      const g = withFeet.filter((r) => r.hole.firstPuttFeet! >= lo && r.hole.firstPuttFeet! < hi);
      return { bucket, holes: g.length, threePlusRate: g.length >= 8 ? round2(g.filter((r) => r.hole.putts! >= 3).length / g.length) : null };
    });
  }
  const { numbers, f } = numFmt();
  const per18 = (three / hs.length) * 18;
  const take =
    three === 0
      ? `Zero 3-putts in this stretch. Either you can lag or you're not logging the ugly ones.`
      : `${f(per18)} three-putts a round, costing ${f((excess / hs.length) * 18)} strokes. Those are pure giveaways. The fix is the first putt: get it inside three feet, forget about holing it.`;
  return ready(args, {
    holes: hs.length, threePlus: three, per18: round2(per18),
    onePuttRate: round2(p.filter((x) => x === 1).length / hs.length), twoPuttRate: round2(p.filter((x) => x === 2).length / hs.length), threePlusRate: round2(three / hs.length),
    excessPer18: round2((excess / hs.length) * 18), byFirstPuttFeet: byFeet,
  }, take, numbers, confidenceFor(hs.length, gate));
}

// ───────────────────────────── Fairways, GIR, scrambling ─────────────────────────────

export interface FairwayValue {
  attempts: number;
  hit: number;
  hitRate: number;
  missLeft: number;
  missRight: number;
  missShort: number;
  missLong: number;
  /** Share of misses that went to the dominant side; null if fewer than 8 misses or no clear side. */
  dominantMiss: { side: 'left' | 'right'; share: number } | null;
}
export function fairways(rounds: readonly RoundInput[], cfg: Config): Insight<FairwayValue> {
  const gate = cfg.gate.fairways!;
  const hs = allHoles(rounds).filter((r) => r.hole.par !== null && r.hole.par >= 4 && r.hole.fairway !== null);
  if (hs.length === 0) return notCollected('fairways', 'Fairways and miss pattern', ['fairway result per tee shot'], 'Tap fairway hit / left / right after your tee shot and this fills in.');
  const args = { id: 'fairways', title: 'Fairways and miss pattern', n: hs.length, nUnit: 'tee shots', gate, baseline: 'none' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { text: 'par 4 and 5 tee shots with a fairway result' } };
  const nr = notReady<FairwayValue>(args);
  if (nr) return nr;
  const c = (k: string) => hs.filter((r) => r.hole.fairway === k).length;
  const hit = c('hit'), l = c('left'), rr = c('right'), s = c('short'), lg = c('long');
  const misses = hs.length - hit;
  const lr = l + rr;
  let dom: FairwayValue['dominantMiss'] = null;
  if (misses >= 8 && lr > 0) {
    const side = rr >= l ? 'right' : 'left';
    const share = Math.max(rr, l) / lr;
    // Two-sided sign test on left-vs-right: only call a side if it is not coin-flip noise.
    if (share >= 0.65 && signTestP(Math.max(rr, l), lr) < 0.1) dom = { side, share: round2(share) };
  }
  const { numbers, f } = numFmt();
  const take = dom
    ? `You hit ${f((100 * hit) / hs.length, 0)}% of fairways and ${f(dom.share * 100, 0)}% of the side misses go ${dom.side}. Aim a couple of paces ${dom.side === 'right' ? 'left' : 'right'} of the center and let your miss become the fairway.`
    : `You hit ${f((100 * hit) / hs.length, 0)}% of fairways and your misses don't favor a side, so aiming isn't your fix. Dispersion width is.`;
  return ready(args, { attempts: hs.length, hit, hitRate: round2(hit / hs.length), missLeft: l, missRight: rr, missShort: s, missLong: lg, dominantMiss: dom }, take, numbers, confidenceFor(hs.length, gate));
}

export interface GirValue {
  holes: number;
  girRate: number;
  girCount: number;
  puttsPerGir: number | null;
}
export function greensInRegulation(rounds: readonly RoundInput[], cfg: Config): Insight<GirValue> {
  const gate = cfg.gate.gir!;
  const hs = allHoles(rounds).filter((r) => r.hole.gir !== null);
  if (hs.length === 0) return notCollected('gir', 'Greens in regulation', ['gir per hole'], 'Tap GIR yes / no on each hole (or we derive it once shots are tracked).');
  const args = { id: 'gir', title: 'Greens in regulation', n: hs.length, nUnit: 'holes', gate, baseline: 'none' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { perRound: 18, text: 'rounds with GIR logged' } };
  const nr = notReady<GirValue>(args);
  if (nr) return nr;
  const g = hs.filter((r) => r.hole.gir === true);
  const pg = g.filter((r) => r.hole.putts !== null).map((r) => r.hole.putts!);
  const { numbers, f } = numFmt();
  const take = `You hit ${f((100 * g.length) / hs.length, 0)}% of greens in regulation (par minus two strokes, any part of the ball on the green). Every green you hit is a hole where a 2-putt is par.`;
  return ready(args, { holes: hs.length, girRate: round2(g.length / hs.length), girCount: g.length, puttsPerGir: pg.length >= 10 ? round2(mean(pg)!) : null }, take, numbers, confidenceFor(hs.length, gate));
}

export interface ScramblingValue {
  missedGreens: number;
  parOrBetter: number;
  bogeyOrBetter: number;
  scramblingRate: number;
  bogeyOrBetterRate: number;
}
/** Scrambling (PGA Tour definition): par or better on a hole where the green was missed in regulation. */
export function scrambling(rounds: readonly RoundInput[], cfg: Config): Insight<ScramblingValue> {
  const gate = cfg.gate.scrambling!;
  const flagged = allHoles(rounds).filter((r) => r.hole.gir !== null);
  if (flagged.length === 0) return notCollected('scrambling', 'Scrambling (up-and-down proxy)', ['gir per hole'], 'Log GIR and this appears. True up-and-down needs shot tracking: it is not derivable from the scorecard.');
  const hs = flagged.filter((r) => r.hole.gir === false && r.hole.par !== null && r.hole.strokes !== null);
  const args = { id: 'scrambling', title: 'Scrambling (up-and-down proxy)', n: hs.length, nUnit: 'missed greens', gate, baseline: 'none' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { text: 'missed greens with a score (they pile up fast)' } };
  const nr = notReady<ScramblingValue>(args);
  if (nr) return nr;
  const par = hs.filter((r) => r.hole.strokes! <= r.hole.par!).length;
  const bog = hs.filter((r) => r.hole.strokes! <= r.hole.par! + 1).length;
  const { numbers, f } = numFmt();
  const take = `You save par on ${f((100 * par) / hs.length, 0)}% of the holes where you miss the green, and bogey-or-better on ${f((100 * bog) / hs.length, 0)}%. Missing the green isn't the crime. Turning it into a double is. Aim for the fat part of the green and take the 2-putt bogey off the table.`;
  return ready(args, { missedGreens: hs.length, parOrBetter: par, bogeyOrBetter: bog, scramblingRate: round2(par / hs.length), bogeyOrBetterRate: round2(bog / hs.length) }, take, numbers, confidenceFor(hs.length, gate));
}

// ───────────────────────────── Penalties ─────────────────────────────

export interface PenaltyValue {
  perRound: number;
  perRoundBasis: number;
  byParType: { par3: number; par4: number; par5: number };
  repeatHoles: { courseName: string; hole: number; plays: number; playsWithPenalty: number; penalties: number }[];
}
export function penaltyLeaks(rounds: readonly RoundInput[], cfg: Config): Insight<PenaltyValue> {
  const ch = completeHoles(rounds);
  const gate = cfg.gate.penalties!;
  const args = { id: 'penalty_leaks', title: 'Penalty-stroke leaks', n: ch.length, nUnit: 'holes', gate, baseline: 'none' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { perRound: 18, text: 'rounds with penalties logged (zero counts, but we need you to confirm it)' }, missingInputs: ['penalties per hole'] };
  const nr = notReady<PenaltyValue>(args);
  if (nr) return nr;
  const total = sum(ch.map((h) => h.penalties));
  const rds = ch.length / 18;
  const by = { par3: 0, par4: 0, par5: 0 };
  for (const h of ch) by[parBucket(h.par)] += h.penalties;
  const key = (h: CompleteHole) => `${h.round.courseId ?? h.round.courseName}#${h.hole.number}`;
  const groups = new Map<string, CompleteHole[]>();
  for (const h of ch) groups.set(key(h), [...(groups.get(key(h)) ?? []), h]);
  const repeat = [...groups.values()]
    .map((g) => ({ courseName: g[0]!.round.courseName, hole: g[0]!.hole.number, plays: g.length, playsWithPenalty: g.filter((h) => h.penalties > 0).length, penalties: sum(g.map((h) => h.penalties)) }))
    .filter((g) => g.plays >= cfg.gate.repeatHole![0] && g.playsWithPenalty >= 2)
    .sort((a, b) => b.penalties - a.penalties || a.hole - b.hole);
  const { numbers, f } = numFmt();
  const per = total / rds;
  let take: string;
  if (total === 0) take = `No penalty strokes logged. Clean. Keep that conservative tee-shot attitude.`;
  else {
    take = `${f(per)} penalty strokes a round. Those cost zero skill and all your pride.`;
    if (repeat[0]) take += ` Hole ${f(repeat[0].hole, 0)} at ${repeat[0].courseName} has bitten you in ${f(repeat[0].playsWithPenalty, 0)} of ${f(repeat[0].plays, 0)} rounds. Leave the driver in the bag there.`;
  }
  const out = ready(args, { perRound: round2(per), perRoundBasis: round2(rds), byParType: by, repeatHoles: repeat }, take, numbers, confidenceFor(ch.length, gate));
  if (repeat[0]) out.shareTake = take.replace(` at ${repeat[0].courseName}`, '');
  return out;
}

// ───────────────────────────── Back-nine fade ─────────────────────────────

export interface FadeValue {
  rounds: number;
  /** Mean (back-nine to-par minus front-nine to-par), strokes. + = worse on the back. */
  meanBackMinusFront: number;
  roundsWorseOnBack: number;
  signTestP: number;
  verdict: 'fade' | 'strong_finish' | 'no_meaningful_difference';
  /** Where the difference comes from, strokes per round (back minus front). Null if putts/penalties not logged on those rounds. */
  drivers: { penalties: number; putting: number; teeToGreen: number } | null;
}
export function backNineFade(rounds: readonly RoundInput[], cfg: Config): Insight<FadeValue> {
  const full = fullRounds(rounds);
  const gate = cfg.gate.backNine!;
  const args = { id: 'back_nine_fade', title: 'Back-nine fade', n: full.length, nUnit: 'complete 18-hole rounds', gate, baseline: 'own_average' as const, sample: isSample(full), quality: qualityOf(full), invitationUnit: { text: 'complete 18-hole rounds' } };
  const nr = notReady<FadeValue>(args);
  if (nr) return nr;
  const diffs = full.map((r) => {
    const f9 = sum(r.holes.slice(0, 9).map((h) => h.strokes! - h.par!));
    const b9 = sum(r.holes.slice(9).map((h) => h.strokes! - h.par!));
    return b9 - f9;
  });
  const m = mean(diffs)!;
  const worse = diffs.filter((d) => d > 0).length;
  const better = diffs.filter((d) => d < 0).length;
  let verdict: FadeValue['verdict'] = 'no_meaningful_difference';
  if (m >= cfg.backNine.minMeanStrokes && worse / diffs.length >= cfg.backNine.minShareWorse) verdict = 'fade';
  else if (m <= -cfg.backNine.minMeanStrokes && better / diffs.length >= cfg.backNine.minShareWorse) verdict = 'strong_finish';
  let drivers: FadeValue['drivers'] = null;
  const rich = full.filter((r) => r.holes.every((h) => h.putts !== null && h.penalties !== null));
  if (rich.length === full.length) {
    const half = (r: RoundInput, a: number, b: number) => ledgerSums(r.holes.slice(a, b).map((h) => ({ round: r, hole: h, par: h.par!, strokes: h.strokes!, putts: h.putts!, penalties: h.penalties! })), cfg);
    const d = (k: 'penalties' | 'putting' | 'ttg') => mean(rich.map((r) => {
      const fr = half(r, 0, 9), bk = half(r, 9, 18);
      return k === 'ttg' ? bk.ttgTotal - fr.ttgTotal : bk[k] - fr[k];
    }))!;
    drivers = { penalties: round2(d('penalties')), putting: round2(d('putting')), teeToGreen: round2(d('ttg')) };
  }
  const { numbers, f } = numFmt();
  let take: string;
  if (verdict === 'fade') {
    take = `Your back nine runs ${f(m)} strokes worse than your front, and it's worse in ${f(worse, 0)} of ${f(full.length, 0)} rounds. That's a pattern, not bad luck.`;
    if (drivers) {
      const top = (Object.entries(drivers) as [string, number][]).sort((a, b) => b[1] - a[1])[0]!;
      const name = top[0] === 'teeToGreen' ? 'ball-striking from tee to green' : top[0];
      take += ` Most of it is ${name} (${f(top[1])} strokes a round). Eat something at the turn, hit five warm-up wedges on 10 tee, and note what falls apart.`;
    } else take += ` Log putts and penalties and we'll tell you what falls apart. Meanwhile: eat at the turn.`;
  } else if (verdict === 'strong_finish') take = `You finish ${f(-m)} strokes better on the back nine, in ${f(better, 0)} of ${f(full.length, 0)} rounds. Slow starter. Warm up properly and steal those strokes early.`;
  else take = `No meaningful fade: front to back differs by ${f(m)} strokes and it isn't consistent. Your legs aren't the problem.`;
  return ready(args, { rounds: full.length, meanBackMinusFront: round2(m), roundsWorseOnBack: worse, signTestP: round2(signTestP(worse, diffs.length)), verdict, drivers }, take, numbers, confidenceFor(full.length, gate));
}

// ───────────────────────────── Pressure holes ─────────────────────────────

/**
 * Break-target pressure: from hole 2 on, a hole is a pressure hole if the target is still live but not safe.
 *   bank = target - strokesSoFar - sum(par of holes still to play, including this one)
 * bank >= 0: you can afford `bank` strokes over par from here. bank < 0: you now need better than par.
 * Pressure when bankMin <= bank <= bankMax (proposed defaults -1..3, config). Tags are added in place on a copy.
 */
export function tagBreakTargetPressure(round: RoundInput, cfg: Config): RoundInput {
  if (round.targetScore === null) return round;
  let soFar = 0;
  const holes = round.holes.map((h, i) => {
    const parRem = sum(round.holes.slice(i).map((x) => x.par ?? 4));
    const bank = round.targetScore! - soFar - parRem;
    const tags: PressureTag[] = [...h.pressure];
    if (i >= 1 && bank >= cfg.pressure.bankMin && bank <= cfg.pressure.bankMax && !tags.includes('break_target')) tags.push('break_target');
    soFar += h.strokes ?? (h.par ?? 4) + 1; // an unscored hole is assumed bogey for pace only; it never enters any stat
    return { ...h, pressure: tags };
  });
  return { ...round, holes };
}

export interface PressureValue {
  pressureHoles: number;
  otherHoles: number;
  /** Mean (score to par on a pressure hole minus the player's own average for that par type on non-pressure holes). + = worse under pressure. */
  meanDelta: number;
  stdError: number;
  verdict: 'pressure_tax' | 'pressure_player' | 'no_detectable_effect';
}
export function pressureHoles(rounds: readonly RoundInput[], cfg: Config): Insight<PressureValue> {
  const gate = cfg.gate.pressure!;
  const scored = allHoles(rounds).filter((r) => r.hole.par !== null && r.hole.strokes !== null && r.hole.par >= 3);
  const press = scored.filter((r) => r.hole.pressure.length > 0);
  const rest = scored.filter((r) => r.hole.pressure.length === 0);
  if (!rounds.some((r) => r.holes.some((h) => h.pressure.length > 0)) && rounds.every((r) => r.targetScore === null && r.format !== 'game')) {
    return notCollected('pressure', 'Pressure holes', ['target score or game stakes per round'], 'Set a target score (like "break 90") or play a Foursome game and COOPR will find your pressure holes.');
  }
  const args = { id: 'pressure', title: 'Pressure holes', n: press.length, nUnit: 'pressure holes', gate, baseline: 'own_average' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { text: 'pressure holes (a target round or a game round has several)' } };
  const nr = notReady<PressureValue>(args);
  if (nr) return nr;
  if (rest.length < 36) return { ...notReady<PressureValue>({ ...args, n: 0, gate: [1, 1, 1] })!, n: press.length, nNeeded: gate[0], invitation: `Needs ${36 - rest.length} more regular holes to compare against.` };
  const avgByPar: Record<string, number> = {};
  for (const k of ['par3', 'par4', 'par5']) {
    const g = rest.filter((r) => parBucket(r.hole.par!) === k).map((r) => r.hole.strokes! - r.hole.par!);
    if (g.length >= 5) avgByPar[k] = mean(g)!;
  }
  const deltas = press.filter((r) => avgByPar[parBucket(r.hole.par!)] !== undefined).map((r) => r.hole.strokes! - r.hole.par! - avgByPar[parBucket(r.hole.par!)]!);
  if (deltas.length < gate[0]) return notReady<PressureValue>({ ...args, n: deltas.length })!;
  const m = mean(deltas)!;
  const s = se(deltas)!;
  const verdict: PressureValue['verdict'] = m > 0 && m >= cfg.pressure.zForCall * s ? 'pressure_tax' : m < 0 && -m >= cfg.pressure.zForCall * s ? 'pressure_player' : 'no_detectable_effect';
  const { numbers, f } = numFmt();
  const take =
    verdict === 'pressure_tax'
      ? `When it matters you give ${f(m, 2)} strokes back per hole versus your normal. Same swing, tighter grip. Pick the boring target and commit to it before you walk to the ball.`
      : verdict === 'pressure_player'
        ? `You play pressure holes ${f(-m, 2)} strokes better than your normal. Nerves are fuel for you. Say yes to the side games.`
        : `No detectable pressure effect: ${f(m, 2)} strokes a hole, inside the noise at this sample. Don't blame nerves yet.`;
  return ready(args, { pressureHoles: deltas.length, otherHoles: rest.length, meanDelta: round2(m), stdError: round2(s), verdict }, take, numbers, confidenceFor(deltas.length, gate));
}

// ───────────────────────────── "Your Tuesday vs your Saturday" ─────────────────────────────

export interface SplitValue {
  splits: { id: string; labelA: string; labelB: string; nA: number; nB: number; meanA: number; meanB: number; diff: number; stdError: number; detectable: boolean }[];
  biggest: string | null;
}
function dow(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}
export function timeSplits(rounds: readonly RoundInput[], cfg: Config): Insight<SplitValue> {
  const full = fullRounds(rounds);
  const gate = cfg.gate.timeSplit!;
  const score = (r: RoundInput) => sum(r.holes.map((h) => h.strokes! - h.par!));
  const defs: { id: string; a: string; b: string; ta: (r: RoundInput) => boolean; tb: (r: RoundInput) => boolean }[] = [
    { id: 'weekend_weekday', a: 'Weekend', b: 'Weekday', ta: (r) => [0, 6].includes(dow(r.playedOn)), tb: (r) => ![0, 6].includes(dow(r.playedOn)) },
    { id: 'am_pm', a: 'Morning', b: 'Afternoon', ta: (r) => r.startPeriod === 'am', tb: (r) => r.startPeriod === 'pm' },
    { id: 'game_solo', a: 'Game rounds', b: 'Solo rounds', ta: (r) => r.format === 'game' || r.format === 'tournament', tb: (r) => r.format === 'solo' },
  ];
  const splits: SplitValue['splits'] = [];
  for (const d of defs) {
    const A = full.filter(d.ta).map(score);
    const B = full.filter(d.tb).map(score);
    if (A.length < gate[0] || B.length < gate[0]) continue;
    const sa = sd(A)!, sb = sd(B)!;
    const stdErr = Math.sqrt((sa * sa) / A.length + (sb * sb) / B.length);
    const diff = mean(A)! - mean(B)!;
    splits.push({ id: d.id, labelA: d.a, labelB: d.b, nA: A.length, nB: B.length, meanA: round2(mean(A)!), meanB: round2(mean(B)!), diff: round2(diff), stdError: round2(stdErr), detectable: Math.abs(diff) >= 2 * stdErr });
  }
  const args = { id: 'time_splits', title: 'Your Tuesday vs your Saturday', n: full.length, nUnit: 'complete rounds', gate: [gate[0] * 2, gate[1] * 2, gate[2] * 2] as [number, number, number], baseline: 'own_average' as const, sample: isSample(full), quality: qualityOf(full), invitationUnit: { text: 'complete rounds across both kinds of day' } };
  if (splits.length === 0) {
    const nr = notReady<SplitValue>({ ...args, n: Math.min(full.length, args.gate[0] - 1) });
    return nr!;
  }
  const hit = splits.filter((s) => s.detectable).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  const { numbers, f } = numFmt();
  const take = hit
    ? `${hit.diff < 0 ? hit.labelA : hit.labelB} you beats ${hit.diff < 0 ? hit.labelB : hit.labelA} you by ${f(Math.abs(hit.diff))} strokes a round (${f(hit.nA, 0)} vs ${f(hit.nB, 0)} rounds). Book your tee times like you mean it.`
    : `Weekday, weekend, morning, game: none of them move your score beyond noise. You're consistent, or you haven't played enough contrast yet.`;
  return ready(args, { splits, biggest: hit?.id ?? null }, take, numbers, confidenceFor(Math.min(...splits.map((s) => Math.min(s.nA, s.nB))), gate));
}

// ───────────────────────────── Nemesis holes ─────────────────────────────

export interface NemesisValue {
  holes: { courseName: string; hole: number; plays: number; avgToPar: number; vsYourParTypeAvg: number }[];
}
export const NEMESIS_MIN_DELTA = 1.0; // strokes worse than your own average for that par type on that course (proposed default)
export function nemesisHoles(rounds: readonly RoundInput[], cfg: Config): Insight<NemesisValue> {
  const gate = cfg.gate.repeatHole!;
  const hs = allHoles(rounds).filter((r) => r.hole.par !== null && r.hole.strokes !== null && r.hole.par >= 3);
  const key = (r: HoleRef) => `${r.round.courseId ?? r.round.courseName}#${r.hole.number}`;
  const groups = new Map<string, HoleRef[]>();
  for (const r of hs) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  const maxPlays = Math.max(0, ...[...groups.values()].map((g) => g.length));
  const args = { id: 'nemesis_holes', title: 'Nemesis holes', n: maxPlays, nUnit: 'plays of one hole', gate, baseline: 'own_average' as const, sample: isSample(rounds), quality: qualityOf(rounds), invitationUnit: { text: 'plays of the same course' } };
  const nr = notReady<NemesisValue>(args);
  if (nr) return nr;
  const out: NemesisValue['holes'] = [];
  for (const g of groups.values()) {
    if (g.length < gate[0]) continue;
    const course = g[0]!.round.courseId ?? g[0]!.round.courseName;
    const par = g[0]!.hole.par!;
    const sameType = hs.filter((r) => (r.round.courseId ?? r.round.courseName) === course && r.hole.par === par);
    const typeAvg = mean(sameType.map((r) => r.hole.strokes! - r.hole.par!))!;
    const avg = mean(g.map((r) => r.hole.strokes! - r.hole.par!))!;
    if (avg - typeAvg >= NEMESIS_MIN_DELTA) out.push({ courseName: g[0]!.round.courseName, hole: g[0]!.hole.number, plays: g.length, avgToPar: round2(avg), vsYourParTypeAvg: round2(avg - typeAvg) });
  }
  out.sort((a, b) => b.vsYourParTypeAvg - a.vsYourParTypeAvg || a.hole - b.hole);
  const top = out.slice(0, 3);
  const { numbers, f } = numFmt();
  const take = top[0]
    ? `Hole ${f(top[0].hole, 0)} at ${top[0].courseName} is your nemesis: ${f(top[0].avgToPar, 2)} over par on average, ${f(top[0].vsYourParTypeAvg, 2)} worse than your usual for that kind of hole. Write a different plan for it: take the safe club off the tee and play to the fat side.`
    : `No hole is eating you alive beyond your normal. Your bad scores are spread out, not hiding on one tee box.`;
  const res = ready(args, { holes: top }, take, numbers, confidenceFor(maxPlays, gate));
  if (top[0]) res.shareTake = take.replace(` at ${top[0].courseName}`, '');
  return res;
}
