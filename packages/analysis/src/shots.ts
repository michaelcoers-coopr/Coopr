/**
 * Shot-level insights: club gapping (real vs default), dispersion ellipses, strokes gained.
 * Carry and total are never blended or converted. Range/sim/course samples are never pooled:
 * for each club we use the single environment with the best evidence (course wins ties).
 */
import type { Config, Insight, ShotInput, RoundInput, Lie, Environment, Quality, BaselineKind, Confidence } from './types';
import { confidenceFor, notReady, notCollected, ready, weakestQuality } from './gate';
import { quantile7, median, covEllipse, mean, sd, round1, round2, sum, type Ellipse } from './stats';
import { numFmt } from './holes';

export const CLUB_NAMES: Record<string, string> = { DR: 'driver', '3W': '3-wood', '5W': '5-wood', '7W': '7-wood', HY: 'hybrid', '3I': '3-iron', '4I': '4-iron', '5I': '5-iron', '6I': '6-iron', '7I': '7-iron', '8I': '8-iron', '9I': '9-iron', PW: 'pitching wedge', GW: 'gap wedge', AW: 'approach wedge', SW: 'sand wedge', LW: 'lob wedge' };
export const clubName = (id: string): string => CLUB_NAMES[id] ?? id;

const ENV_PRIORITY: Environment[] = ['course', 'range', 'simulator'];

function bestEnvGroup<T extends ShotInput>(shots: readonly T[], need: (s: T) => boolean, minN: number): { env: Environment; shots: T[] } | null {
  let best: { env: Environment; shots: T[] } | null = null;
  for (const env of ENV_PRIORITY) {
    const g = shots.filter((s) => s.environment === env && need(s));
    if (g.length < minN) continue;
    if (!best || g.length > best.shots.length) best = { env, shots: g };
  }
  // If nothing reaches minN, still report the largest group so the UI can say "2 of 3".
  if (!best) {
    for (const env of ENV_PRIORITY) {
      const g = shots.filter((s) => s.environment === env && need(s));
      if (g.length > 0 && (!best || g.length > best.shots.length)) best = { env, shots: g };
    }
  }
  return best;
}
const clubsOf = (shots: readonly ShotInput[]) => [...new Set(shots.map((s) => s.club))];
const sampleOf = (shots: readonly ShotInput[]) => shots.some((s) => s.isSample);

// ───────────────────────────── Club gapping ─────────────────────────────

export type DefaultCarryFn = (club: string) => number | null;

export interface ClubCarry {
  club: string;
  environment: Environment;
  n: number;
  p20: number | null;
  p50: number | null;
  p80: number | null;
  spread: number | null;
  shortMissShare: number | null;
  /** 'Learning' = 3..9 measured carries, 'Yours' = 10+, mirrors club-distances. */
  label: 'Default' | 'Learning' | 'Yours';
  defaultCarry: number | null;
  /** Measured P50 minus default. Only set once the player has >= gate[0] shots. */
  deltaVsDefault: number | null;
  confidence: Confidence;
}
export interface GapValue {
  clubs: ClubCarry[]; // longest first; only clubs with a measured median
  gaps: { longer: string; shorter: string; gapYds: number; flag: 'big' | 'overlap' | 'ok' }[];
  medianGap: number | null;
  /** Bag clubs with fewer than gate[0] measured carries. Their default (if any) is display-only. */
  unmeasured: { club: string; n: number; defaultCarry: number | null }[];
  /** Largest absolute real-vs-default difference among measured clubs, for the headline. */
  biggestDefaultMiss: { club: string; deltaYds: number } | null;
}

export function clubGapping(shots: readonly ShotInput[], bagClubs: readonly string[] | null, defaultCarry: DefaultCarryFn, cfg: Config): Insight<GapValue> {
  const g = cfg.gate.gapping!;
  // Only measured / user-confirmed carries feed gapping. Estimated (e.g. on-course guesses) and unknown never do.
  const carries = shots.filter((s) => s.carryYds !== null && (s.carryQuality === 'measured' || s.carryQuality === 'user_confirmed') && s.carryYds > 0);
  const clubs = bagClubs ? [...bagClubs] : clubsOf(carries);
  const rows: ClubCarry[] = [];
  const unmeasured: GapValue['unmeasured'] = [];
  for (const club of clubs) {
    const grp = bestEnvGroup(carries.filter((s) => s.club === club), () => true, g[0]);
    const n = grp?.shots.length ?? 0;
    const def = defaultCarry(club);
    if (!grp || n < g[0]) {
      unmeasured.push({ club, n, defaultCarry: def });
      continue;
    }
    const v = grp.shots.map((s) => s.carryYds!);
    const p50 = quantile7(v, 0.5)!;
    rows.push({
      club, environment: grp.env, n, p20: round1(quantile7(v, 0.2)!), p50: round1(p50), p80: round1(quantile7(v, 0.8)!),
      spread: round1(quantile7(v, 0.8)! - quantile7(v, 0.2)!),
      shortMissShare: n >= g[1] ? round2(v.filter((x) => x < p50 * (1 - cfg.gaps.shortMissFrac)).length / n) : null,
      label: n >= g[1] ? 'Yours' : 'Learning', defaultCarry: def, deltaVsDefault: def === null ? null : round1(p50 - def),
      confidence: confidenceFor(n, g),
    });
  }
  rows.sort((a, b) => b.p50! - a.p50! || a.club.localeCompare(b.club));
  const gc = cfg.gate.gapClubs!;
  const sample = sampleOf(carries);
  const q: Quality = weakestQuality(carries.map((s) => s.carryQuality));
  const args = { id: 'club_gapping', title: 'Club gapping', n: rows.length, nUnit: 'clubs with measured carries', gate: gc, baseline: 'none' as const, sample, quality: q, invitationUnit: { text: `clubs with ${g[0]}+ measured carries (range or monitor shots count; GPS distances do not)` }, missingInputs: carries.length === 0 ? ['measured carry per club'] : [] };
  const nr = notReady<GapValue>(args);
  if (nr) return nr;
  // Driver is left out of gap flags: a big driver-to-3-wood step is normal, not a hole in the bag.
  const gapRows = rows.filter((r) => r.club !== 'DR');
  const gaps: GapValue['gaps'] = [];
  for (let i = 0; i + 1 < gapRows.length; i++) gaps.push({ longer: gapRows[i]!.club, shorter: gapRows[i + 1]!.club, gapYds: round1(gapRows[i]!.p50! - gapRows[i + 1]!.p50!), flag: 'ok' });
  if (gaps.length === 0) return { ...notReady<GapValue>({ ...args, n: 0 })!, n: rows.length };
  const medGap = median(gaps.map((x) => x.gapYds))!;
  for (const x of gaps) {
    if (x.gapYds >= Math.max(cfg.gaps.bigGapMinYds, cfg.gaps.bigGapMultiple * medGap)) x.flag = 'big';
    else if (x.gapYds <= Math.max(cfg.gaps.overlapMaxYds, cfg.gaps.overlapFracOfMedian * medGap)) x.flag = 'overlap';
  }
  const dm = rows.filter((r) => r.deltaVsDefault !== null).sort((a, b) => Math.abs(b.deltaVsDefault!) - Math.abs(a.deltaVsDefault!))[0];
  const value: GapValue = { clubs: rows, gaps, medianGap: round1(medGap), unmeasured, biggestDefaultMiss: dm ? { club: dm.club, deltaYds: dm.deltaVsDefault! } : null };
  const { numbers, f } = numFmt();
  const big = gaps.filter((x) => x.flag === 'big').sort((a, b) => b.gapYds - a.gapYds)[0];
  const over = gaps.filter((x) => x.flag === 'overlap').sort((a, b) => a.gapYds - b.gapYds)[0];
  const parts: string[] = [];
  const yd = (x: number) => `${f(x, 0)} ${Math.round(x) === 1 ? 'yard' : 'yards'}`;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  if (big) parts.push(`${cap(clubName(big.longer))} to ${clubName(big.shorter)} is a ${f(big.gapYds, 0)}-yard hole in your bag. You have no club for that number.`);
  if (over) parts.push(`${cap(clubName(over.longer))} and ${clubName(over.shorter)} carry only ${yd(over.gapYds)} apart. One of them is a spare.`);
  if (dm && Math.abs(dm.deltaVsDefault!) >= 5) parts.push(`Your ${clubName(dm.club)} actually carries ${yd(Math.abs(dm.deltaVsDefault!))} ${dm.deltaVsDefault! < 0 ? 'shorter' : 'longer'} than the chart says. Play your number, not the chart.`);
  const take = parts.length ? parts.join(' ') : `Your gaps are tidy: no big holes and no doubled-up clubs among what's measured. Keep logging the rest of the bag.`;
  return ready(args, value, take, numbers, confidenceFor(rows.length, gc));
}

// ───────────────────────────── Dispersion ─────────────────────────────

export interface ClubDispersion {
  club: string;
  environment: Environment;
  n: number;
  /** Ellipse at cfg.ellipseChi2 coverage (80% under a bivariate normal model). */
  ellipse: Ellipse;
  /** 80% band widths under the same model, yards. */
  widthYds: number;
  depthYds: number;
  biasLateralYds: number;
  biasLongYds: number;
  /** How far to aim opposite the bias; null unless bias is both >= minYds and >= minZ standard errors. */
  aimOffsetYds: number | null;
  confidence: Confidence;
}
export interface DispersionValue {
  clubs: ClubDispersion[];
  /** Clubs with some tracked shots but under the gate, so the UI can say "7 of 10". */
  pending: { club: string; n: number; needed: number }[];
}
export function dispersion(shots: readonly ShotInput[], cfg: Config): Insight<DispersionValue> {
  const g = cfg.gate.dispersion!;
  const tracked = shots.filter((s) => s.lateralYds !== null && s.longitudinalYds !== null);
  if (tracked.length === 0) {
    return notCollected('dispersion', 'Dispersion and miss pattern', ['landing offset left/right and long/short vs target per shot'], 'Needs shots with a target and a landing spot: a launch monitor feed, or tap-to-mark on the course. Scorecard alone cannot give a dispersion.');
  }
  const value: DispersionValue = { clubs: [], pending: [] };
  for (const club of clubsOf(tracked)) {
    const grp = bestEnvGroup(tracked.filter((s) => s.club === club), () => true, g[0])!;
    if (grp.shots.length < g[0]) { value.pending.push({ club, n: grp.shots.length, needed: g[0] }); continue; }
    const xs = grp.shots.map((s) => s.lateralYds!);
    const ys = grp.shots.map((s) => s.longitudinalYds!);
    const el = covEllipse(xs, ys, cfg.ellipseChi2)!;
    const n = xs.length;
    const sdx = sd(xs)!;
    const z = sdx === 0 ? Infinity : Math.abs(el.cx) / (sdx / Math.sqrt(n));
    const k = Math.sqrt(cfg.ellipseChi2);
    value.clubs.push({
      club, environment: grp.env, n, ellipse: el, widthYds: round1(2 * k * el.sdLateral), depthYds: round1(2 * k * el.sdLong),
      biasLateralYds: round1(el.cx), biasLongYds: round1(el.cy),
      aimOffsetYds: Math.abs(el.cx) >= cfg.aimOffset.minYds && z >= cfg.aimOffset.minZ ? -Math.round(el.cx) : null,
      confidence: confidenceFor(n, g),
    });
  }
  value.clubs.sort((a, b) => b.n - a.n || a.club.localeCompare(b.club));
  const sample = sampleOf(tracked);
  const best = Math.max(0, ...value.clubs.map((c) => c.n), ...value.pending.map((c) => c.n));
  const args = { id: 'dispersion', title: 'Dispersion and miss pattern', n: best, nUnit: 'tracked shots (best club)', gate: g, baseline: 'none' as const, sample, quality: weakestQuality(tracked.map((s) => s.carryQuality)), invitationUnit: { text: 'tracked shots with the same club' } };
  const nr = notReady<DispersionValue>(args);
  if (nr) return { ...nr, value: null };
  const { numbers, f } = numFmt();
  const offs = value.clubs.filter((c) => c.aimOffsetYds !== null).sort((a, b) => Math.abs(b.aimOffsetYds!) - Math.abs(a.aimOffsetYds!))[0];
  const widest = [...value.clubs].sort((a, b) => b.widthYds - a.widthYds)[0]!;
  const take = offs
    ? `Your ${clubName(offs.club)} lands about ${f(Math.abs(offs.biasLateralYds), 0)} yards ${offs.biasLateralYds > 0 ? 'right' : 'left'} of where you aim. Aim ${f(Math.abs(offs.aimOffsetYds!), 0)} yards ${offs.aimOffsetYds! < 0 ? 'left' : 'right'} and you've just bought free accuracy.`
    : `No club has a stubborn miss side. Your widest pattern is the ${clubName(widest.club)}: about ${f(widest.widthYds, 0)} yards wide. Pick targets with that much room, not a flag tucked behind a bunker.`;
  return ready(args, value, take, numbers, confidenceFor(value.clubs[0]!.n, g));
}

// ───────────────────────────── Strokes gained ─────────────────────────────

export interface Baseline {
  name: string;
  kind: BaselineKind;
  /** True for test fixtures. A synthetic baseline can never be shown to a user. */
  synthetic: boolean;
  /** Expected strokes to hole out from a lie and a distance to the pin (yards). null = not covered. */
  expected(lie: Lie, distYds: number): number | null;
}

const BINS_NON_GREEN = [0, 3, 8, 15, 30, 60, 100, 150, 200, 300, Infinity];
const BINS_GREEN = [0, 2, 4, 7, 12, 20, Infinity];
function binIndex(lie: Lie, d: number): number {
  const edges = lie === 'green' ? BINS_GREEN : BINS_NON_GREEN;
  for (let i = 0; i + 1 < edges.length; i++) if (d >= edges[i]! && d < edges[i + 1]!) return i;
  return edges.length - 2;
}
const bucketKey = (lie: Lie, d: number) => `${lie === 'fringe' ? 'green' : lie}|${binIndex(lie === 'fringe' ? 'green' : lie, d)}`;

export interface HoleShots {
  round: RoundInput;
  holeNumber: number;
  strokes: number;
  par: number;
  shots: ShotInput[];
}
/** A hole is usable only if the shot list reproduces the scorecard: shots + penalties = strokes, seq 1..k, last shot holed. */
export function reconcileHoles(shots: readonly ShotInput[], rounds: readonly RoundInput[]): { holes: HoleShots[]; rejected: number } {
  const byRound = new Map(rounds.map((r) => [r.id, r]));
  const groups = new Map<string, ShotInput[]>();
  for (const s of shots) {
    if (s.environment !== 'course' || s.roundId === null || s.hole === null || s.seq === null) continue;
    const k = `${s.roundId}#${s.hole}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const holes: HoleShots[] = [];
  let rejected = 0;
  for (const [k, g] of groups) {
    const [rid, hn] = k.split('#');
    const round = byRound.get(rid!);
    const hole = round?.holes.find((h) => h.number === Number(hn));
    g.sort((a, b) => a.seq! - b.seq!);
    const ok =
      round && hole && hole.strokes !== null && hole.par !== null &&
      g.every((s, i) => s.seq === i + 1 && s.startLie !== null && s.startDistToPinYds !== null && s.endLie !== null) &&
      g[g.length - 1]!.endLie === 'holed' &&
      // The end spot of each shot is the start spot of the next one (same lie, within half a yard), otherwise SG would not add up.
      g.every((s, i) => i === g.length - 1 || (s.endLie === g[i + 1]!.startLie && s.endDistToPinYds !== null && Math.abs(s.endDistToPinYds - g[i + 1]!.startDistToPinYds!) <= 0.5)) &&
      g.length + sum(g.map((s) => s.penaltyStrokes)) === hole.strokes;
    if (ok) holes.push({ round: round!, holeNumber: hole!.number, strokes: hole!.strokes!, par: hole!.par!, shots: g });
    else rejected++;
  }
  return { holes, rejected };
}

/** "vs your own average" baseline built from the player's reconciled holes. Buckets under minBucket stay null. */
export function buildSelfBaseline(holes: readonly HoleShots[], cfg: Config): Baseline | null {
  const rounds = new Set(holes.map((h) => h.round.id));
  if (holes.length / 18 < cfg.sg.minRoundsSelf || rounds.size < 1) return null;
  const acc = new Map<string, { sum: number; n: number }>();
  for (const h of holes) {
    let used = 0;
    for (const s of h.shots) {
      const key = bucketKey(s.startLie!, s.startDistToPinYds!);
      const a = acc.get(key) ?? { sum: 0, n: 0 };
      a.sum += h.strokes - used;
      a.n += 1;
      acc.set(key, a);
      used += 1 + s.penaltyStrokes;
    }
  }
  return {
    name: 'Your own average', kind: 'own_average', synthetic: false,
    expected(lie, d) {
      const a = acc.get(bucketKey(lie, d));
      return a && a.n >= cfg.sg.minBucket ? a.sum / a.n : null;
    },
  };
}

export type SgCategory = 'off_tee' | 'approach' | 'around_green' | 'putting';
const SG_LABEL: Record<SgCategory, string> = { off_tee: 'Off the tee', approach: 'Approach', around_green: 'Around the green', putting: 'Putting' };

export function sgCategory(s: ShotInput, par: number, cfg: Config): SgCategory {
  if (s.startLie === 'green' || s.startLie === 'fringe') return 'putting';
  if (s.startLie === 'tee') return par >= 4 ? 'off_tee' : 'approach';
  return s.startDistToPinYds! > cfg.sg.aroundGreenYds ? 'approach' : 'around_green';
}

export interface ShotSg {
  shot: ShotInput;
  holeNumber: number;
  category: SgCategory;
  sg: number | null;
}
/** SG per shot = E(start) - E(end) - 1 - penaltyStrokes. Holed = 0 expected. null when the baseline does not cover a position. */
export function shotStrokesGained(holes: readonly HoleShots[], baseline: Baseline, cfg: Config): ShotSg[] {
  const out: ShotSg[] = [];
  for (const h of holes) {
    for (const s of h.shots) {
      const e0 = baseline.expected(s.startLie!, s.startDistToPinYds!);
      const e1 = s.endLie === 'holed' ? 0 : s.endDistToPinYds === null ? null : baseline.expected(s.endLie as Lie, s.endDistToPinYds);
      out.push({ shot: s, holeNumber: h.holeNumber, category: sgCategory(s, h.par, cfg), sg: e0 === null || e1 === null ? null : e0 - e1 - 1 - s.penaltyStrokes });
    }
  }
  return out;
}

export interface SgValue {
  baselineName: string;
  baselineKind: BaselineKind;
  /** True only for a tour or handicap-band baseline: only then does a negative number mean "you lose strokes". */
  absolute: boolean;
  holesUsed: number;
  holesRejected: number;
  shotsSkippedNoBaseline: number;
  categories: { id: SgCategory; label: string; sgPer18: number | null; shots: number; confidence: Confidence; invitation: string | null }[];
}
export function strokesGained(shots: readonly ShotInput[], rounds: readonly RoundInput[], baselineIn: Baseline | null, cfg: Config): Insight<SgValue> {
  const { holes, rejected } = reconcileHoles(shots, rounds);
  const sample = rounds.some((r) => r.isSample) || sampleOf(shots);
  const trackedHoles = holes.length;
  const baseline = baselineIn ?? buildSelfBaseline(holes, cfg);
  const gate = cfg.gate.sgCategory!;
  const args = { id: 'strokes_gained', title: 'Strokes gained', n: trackedHoles, nUnit: 'fully tracked holes', gate: [cfg.sg.minRoundsSelf * 18, cfg.sg.minRoundsSelf * 36, cfg.sg.minRoundsSelf * 72] as [number, number, number], baseline: (baseline?.kind ?? 'none') as BaselineKind, sample, quality: 'derived' as Quality, invitationUnit: { perRound: 18, text: 'fully tracked rounds (every shot with start spot, end spot and lie)' }, missingInputs: ['shot start/end position and lie per shot'] };
  if (shots.filter((s) => s.environment === 'course').length === 0) {
    return notCollected('strokes_gained', 'Strokes gained', args.missingInputs, 'COOPR does not track on-course shot positions yet. Once shots are marked, this unlocks. Until then the scorecard ledger does the job.', 'none');
  }
  const nr = notReady<SgValue>(args);
  if (nr || !baseline) return nr ?? notReady<SgValue>({ ...args, n: 0 })!;
  const sgs = shotStrokesGained(holes, baseline, cfg);
  const valid = sgs.filter((x) => x.sg !== null);
  const cats = (['off_tee', 'approach', 'around_green', 'putting'] as SgCategory[]).map((id) => {
    const v = valid.filter((x) => x.category === id);
    const confidence = confidenceFor(v.length, gate);
    if (v.length < cfg.sg.minShotsPerCategory) return { id, label: SG_LABEL[id], sgPer18: null, shots: v.length, confidence: 'insufficient' as Confidence, invitation: `Needs ${cfg.sg.minShotsPerCategory - v.length} more tracked ${SG_LABEL[id].toLowerCase()} shots.` };
    return { id, label: SG_LABEL[id], sgPer18: round2((sum(v.map((x) => x.sg!)) / trackedHoles) * 18), shots: v.length, confidence, invitation: null };
  });
  const absolute = baseline.kind === 'tour' || baseline.kind === 'handicap_band';
  const known = cats.filter((c) => c.sgPer18 !== null);
  const { numbers, f } = numFmt();
  let take: string;
  if (known.length === 0) take = `Shots are tracked but no category has enough yet. Keep marking them.`;
  else {
    const worst = [...known].sort((a, b) => a.sgPer18! - b.sgPer18!)[0]!;
    take = absolute
      ? `Biggest loss against ${baseline.name}: ${worst.label.toLowerCase()}, ${f(-worst.sgPer18!, 2)} strokes a round. Start there.`
      : `Against your own average, ${worst.label.toLowerCase()} is your weakest link (${f(worst.sgPer18!, 2)} strokes a round). That's relative to you, not a verdict: it shows the shape of your game, not what you lose to a better player.`;
  }
  return ready(args, { baselineName: baseline.name, baselineKind: baseline.kind, absolute, holesUsed: trackedHoles, holesRejected: rejected, shotsSkippedNoBaseline: sgs.length - valid.length, categories: cats }, take, numbers, confidenceFor(trackedHoles, args.gate));
}
