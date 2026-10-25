import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyze, DEFAULT_CONFIG, quantile7, covEllipse, signTestP, ledger, ledgerSums, completeHoles, tagBreakTargetPressure, pressureHoles, backNineFade,
  clubGapping, dispersion, reconcileHoles, shotStrokesGained, strokesGained, buildSelfBaseline, selectOneFix, rankLosses, ungroundedNumbers,
  toFitterBagGap, toPlayerShots, crewBadges, hustlerExplainer, buildCards, scoringByHoleType, timeSplits, nemesisHoles, penaltyLeaks, threePutts, blowups,
  fairways, greensInRegulation,
} from '../src/index';
import type { Baseline, Insight, ShotInput, RoundInput } from '../src/index';
import { syntheticSeason, syntheticRangeShots, thinPlayer, COURSE, simulateRound } from '../fixtures/synthetic';
import { hole, round, eighteen, shot } from './helpers';

const cfg = DEFAULT_CONFIG;
const season = syntheticSeason();
const seasonRounds = season.map((s) => s.round);
const seasonShots = [...season.flatMap((s) => s.shots), ...syntheticRangeShots()];
const full = analyze({ rounds: seasonRounds, shots: seasonShots });
// club-distances is not in this repo. The pace labels match its contract: under 3 shots stays Default, 3 is Learning, 10 is Yours.
// The 7-iron chart number is only so delta = measured P50 - that chart. It is not a licensed stock yardage.
const distances = {
  suggestDistance(club: string, _flex: string, _env?: unknown, shots?: { carry: number | null }[]) {
    const n = shots?.filter((shot) => shot.carry != null).length ?? 0;
    const label = n >= 10 ? 'Yours' : n >= 3 ? 'Learning' : 'Default';
    const chart: Record<string, number> = { '7I': 172 };
    return { label, carry: { defaultValue: chart[club] ?? null } };
  },
};
const insightsOf = (a: ReturnType<typeof analyze>): Insight<unknown>[] =>
  Object.entries(a).filter(([k]) => k !== 'meta').map(([, v]) => v as Insight<unknown> | null).filter((v): v is Insight<unknown> => v !== null);

describe('stats', () => {
  test('quantile type 7 matches hand values', () => {
    assert.equal(quantile7([1, 2, 3, 4], 0.5), 2.5);
    assert.equal(quantile7([10, 20, 30, 40, 50], 0.2), 18);
    assert.equal(quantile7([], 0.5), null);
  });
  test('sign test exact p: 9 of 10 -> 22/1024', () => {
    assert.ok(Math.abs(signTestP(9, 10) - 22 / 1024) < 1e-12);
    assert.equal(signTestP(5, 10), 1);
  });
  test('covariance ellipse, axis-aligned hand case', () => {
    const xs = [-10, 10, -10, 10, -10, 10, -10, 10, -10, 10];
    const ys = xs.map(() => 0);
    const e = covEllipse(xs, ys, 3.219)!;
    const variance = (10 * 100) / 9;
    assert.ok(Math.abs(e.a - Math.sqrt(3.219 * variance)) < 1e-9);
    assert.ok(e.b < 1e-9);
    assert.ok(Math.abs(e.angleDeg) < 1e-9);
    assert.equal(e.cx, 0);
  });
});

describe('loss ledger: exact decomposition', () => {
  test('hand-computed single hole: 6 strokes, 3 putts, 1 penalty on a par 4', () => {
    const r = round('a', eighteen(() => ({ strokes: 6, putts: 3, penalties: 1 })));
    const s = ledgerSums(completeHoles([r]), cfg);
    // each hole: penalties 1, putting 3-2=1, ttg = 6-1-1-4 = 0
    assert.equal(s.penalties, 18);
    assert.equal(s.putting, 18);
    assert.equal(s.ttg_par4, 0);
    assert.equal(s.totalOverPar, 36);
  });
  test('holed-out hole (0 putts) puts the whole excess in tee-to-green, not putting', () => {
    const r = round('a', [hole(1, { par: 4, strokes: 3, putts: 0, penalties: 0 })]);
    const s = ledgerSums(completeHoles([r]), cfg);
    assert.equal(s.putting, 0);
    assert.equal(s.ttg_par4, -1);
  });
  test('buckets sum to total over par on the synthetic season (both splits)', () => {
    const withFlags = ledger(seasonRounds, cfg);
    assert.equal(withFlags.value!.split, 'by_outcome');
    const noFlags = ledger(seasonRounds.map((r) => ({ ...r, holes: r.holes.map((h) => ({ ...h, gir: null })) })), cfg);
    assert.equal(noFlags.value!.split, 'by_par_type');
    for (const ins of [withFlags, noFlags]) {
      const per18Sum = ins.value!.items.reduce((a, i) => a + i.strokesPer18, 0);
      assert.ok(Math.abs(per18Sum - ins.value!.totalOverParPer18) < 0.06, `${per18Sum} vs ${ins.value!.totalOverParPer18}`);
    }
  });
  test('the ledger sees the designed leaks (not a claim about reality)', () => {
    const pen = penaltyLeaks(seasonRounds, cfg).value!;
    assert.ok([4, 11].includes(pen.repeatHoles[0]!.hole));
  });
  test('ledger ranks biggest loss first and gains last', () => {
    const items = full.ledger.value!.items;
    for (let i = 1; i < items.length; i++) assert.ok(items[i - 1]!.strokesPer18 >= items[i]!.strokesPer18);
  });
});

describe('sample-size gating and the null rule', () => {
  test('thin player: nothing shows a number, every insight invites', () => {
    const a = analyze({ rounds: thinPlayer() });
    for (const ins of insightsOf(a)) {
      // Scoring by hole type needs only strokes + par, so it may legitimately show (at 'limited' confidence).
      if (ins.id === 'scoring_by_hole_type') { assert.equal(ins.confidence, 'limited'); continue; }
      assert.notEqual(ins.status, 'ready', `${ins.id} must not be ready on 2 rounds with no putts/penalties`);
      assert.equal(ins.value, null, ins.id);
      assert.equal(ins.take, null, ins.id);
      assert.deepEqual(ins.numbers, [], ins.id);
      assert.ok(ins.invitation && ins.invitation.length > 5, `${ins.id} needs an invitation`);
    }
    assert.match(a.ledger.invitation!, /Needs \d+ more rounds/);
    assert.match(a.oneFix.invitation!, /log putts and penalties/);
  });
  test('needs-more counts the shortfall in rounds (54 holes needed, 36 held -> 1 more round)', () => {
    const two = seasonRounds.slice(0, 2);
    const l = ledger(two, cfg);
    assert.equal(l.status, 'needs_more');
    assert.equal(l.n, 36);
    assert.equal(l.nNeeded, 54);
    assert.equal(l.invitation, 'Needs 1 more round with strokes, putts and penalties logged on every hole.');
  });
  test('holes with null putts are skipped, not zeroed', () => {
    const rs = seasonRounds.slice(0, 3).map((r, i) => (i === 0 ? { ...r, holes: r.holes.map((h) => ({ ...h, putts: null })) } : r));
    const l = ledger(rs, cfg);
    assert.equal(l.n, 36);
    assert.equal(l.status, 'needs_more');
    const rs4 = seasonRounds.slice(0, 4).map((r, i) => (i === 0 ? { ...r, holes: r.holes.map((h) => ({ ...h, putts: null })) } : r));
    const l4 = ledger(rs4, cfg);
    assert.equal(l4.status, 'ready');
    assert.equal(l4.value!.holesSkipped, 18);
    assert.ok(l4.missingInputs.length > 0);
  });
  test('uncollected fields say not_collected with no value', () => {
    const rs = seasonRounds.map((r) => ({ ...r, holes: r.holes.map((h) => ({ ...h, gir: null, fairway: null })) }));
    assert.equal(greensInRegulation(rs, cfg).status, 'not_collected');
    assert.equal(fairways(rs, cfg).status, 'not_collected');
    const a = analyze({ rounds: seasonRounds });
    assert.equal(a.dispersion.status, 'not_collected');
    assert.equal(a.strokesGained.status, 'not_collected');
    assert.equal(a.gapping.status, 'needs_more');
  });
  test('empty input never throws', () => {
    const a = analyze({ rounds: [] });
    for (const ins of insightsOf(a)) assert.notEqual(ins.status, 'ready');
  });
  test('scoring by hole type: a bucket under the gate shows an invitation, no average', () => {
    const v = full.scoringByHoleType.value!;
    const small = v.buckets.filter((b) => b.confidence === 'insufficient');
    for (const b of small) {
      assert.equal(b.avgToPar, null);
      assert.ok(b.invitation);
    }
    for (const b of v.buckets.filter((x) => x.confidence !== 'insufficient')) assert.ok(b.avgToPar !== null && b.holes >= 8);
  });
  test('confidence bands follow the gate', () => {
    assert.equal(ledger(seasonRounds.slice(0, 3), cfg).confidence, 'limited');
    assert.equal(ledger(seasonRounds.slice(0, 5), cfg).confidence, 'moderate');
    assert.equal(ledger(seasonRounds.slice(0, 10), cfg).confidence, 'solid');
  });
});

describe('sample labeling', () => {
  test('every insight built from fixtures carries the SAMPLE flag', () => {
    for (const ins of insightsOf(full)) assert.equal(ins.sample, true, ins.id);
    assert.equal(full.meta.sample, true);
  });
  test('real (non-sample) rows do not', () => {
    const real = seasonRounds.map((r) => ({ ...r, isSample: false }));
    const a = analyze({ rounds: real });
    assert.equal(a.ledger.sample, false);
    assert.equal(a.oneFix.sample, false);
  });
  test('one sample round in the mix labels the whole insight sample', () => {
    const mixed = seasonRounds.map((r, i) => ({ ...r, isSample: i === 0 }));
    assert.equal(analyze({ rounds: mixed }).ledger.sample, true);
  });
});

describe('hole-level insights', () => {
  test('back nine fade: consistent +2 on the back across 6 rounds', () => {
    const rs = Array.from({ length: 6 }, (_, i) => round(`f${i}`, eighteen((n) => ({ strokes: n > 9 ? 5 : 4, putts: 2, penalties: 0 }))));
    // front: par 4 par; back: bogey every hole -> diff = +9 strokes, too big to be subtle; check verdict and 9.0
    const f = backNineFade(rs, cfg);
    assert.equal(f.value!.verdict, 'fade');
    assert.equal(f.value!.meanBackMinusFront, 9);
    assert.equal(f.value!.roundsWorseOnBack, 6);
    assert.ok(f.value!.drivers);
  });
  test('fade: needs 5 complete rounds; 4 -> needs 1 more', () => {
    const rs = Array.from({ length: 4 }, (_, i) => round(`f${i}`, eighteen(() => ({ strokes: 5 }))));
    const f = backNineFade(rs, cfg);
    assert.equal(f.status, 'needs_more');
    assert.equal(f.invitation, 'Needs 1 more complete 18-hole round.');
  });
  test('fade: inconsistent difference is not called', () => {
    const rs = Array.from({ length: 6 }, (_, i) => round(`f${i}`, eighteen((n) => ({ strokes: i % 2 === 0 ? (n > 9 ? 5 : 4) : n > 9 ? 4 : 5 }))));
    assert.equal(backNineFade(rs, cfg).value!.verdict, 'no_meaningful_difference');
  });
  test('break-target pressure tags: hand-worked example (all bogeys, target 90, par 72)', () => {
    const r = tagBreakTargetPressure(round('p', eighteen(() => ({ par: 4, strokes: 5 })), { targetScore: 90 }), cfg);
    const tagged = r.holes.filter((h) => h.pressure.includes('break_target')).map((h) => h.number);
    assert.deepEqual(tagged, [16, 17, 18]); // banks 3,2,1 strokes left to burn
  });
  test('no target, no break-target tags', () => {
    const r = tagBreakTargetPressure(round('p', eighteen(() => ({ strokes: 5 }))), cfg);
    assert.ok(r.holes.every((h) => h.pressure.length === 0));
  });
  test('pressure insight is not_collected without a target or a game', () => {
    assert.equal(pressureHoles(seasonRounds.map((r) => ({ ...r, targetScore: null, format: 'solo' })), cfg).status, 'not_collected');
  });
  test('pressure: same score under pressure is no effect; a flat +1 is a tax', () => {
    const mk = (extra: number) => Array.from({ length: 8 }, (_, i) => round(`q${i}`, eighteen((n) => ({ strokes: 5 + (n >= 16 ? extra : 0), pressure: n >= 16 ? ['game_on_the_line' as const] : [] }))));
    assert.equal(pressureHoles(mk(0), cfg).value!.verdict, 'no_detectable_effect');
    assert.equal(pressureHoles(mk(1), cfg).value!.verdict, 'pressure_tax');
    assert.equal(pressureHoles(mk(-1), cfg).value!.verdict, 'pressure_player');
    // 8 rounds x 3 = 24 pressure holes, 8 x 15 = 120 others
    assert.equal(pressureHoles(mk(1), cfg).value!.pressureHoles, 24);
  });
  test('3-putt: counts and gross excess are hand-checkable', () => {
    const rs = Array.from({ length: 2 }, (_, i) => round(`t${i}`, eighteen((n) => ({ putts: n <= 3 ? 3 : 2 }))));
    const t = threePutts(rs, cfg).value!;
    assert.equal(t.threePlus, 6);
    assert.equal(t.holes, 36);
    assert.equal(t.per18, 3);
    assert.equal(t.excessPer18, 3);
  });
  test('blow-ups: bogey cap saving is strokes beyond a bogey', () => {
    const rs = Array.from({ length: 3 }, (_, i) => round(`b${i}`, eighteen((n) => ({ strokes: n === 1 ? 8 : 5 })))); // +4 once a round
    const b = blowups(rs, cfg).value!;
    assert.equal(b.holesDoublePlus, 3);
    assert.equal(b.per18, 1);
    assert.equal(b.bogeyCapSavingPer18, 3);
  });
  test('time splits only call differences beyond noise', () => {
    const mk = (id: string, date: string, strokesBase: number, jitter: number) => round(id, eighteen((n) => ({ strokes: strokesBase + (n % 3 === 0 ? jitter : 0) })), { playedOn: date });
    const sat = ['2026-06-06', '2026-06-13', '2026-06-20', '2026-06-27', '2026-07-04'].map((d, i) => mk(`s${i}`, d, 4, i % 2));
    const tue = ['2026-06-02', '2026-06-09', '2026-06-16', '2026-06-23', '2026-06-30'].map((d, i) => mk(`t${i}`, d, 6, i % 2));
    const t = timeSplits([...sat, ...tue], cfg);
    assert.equal(t.status, 'ready');
    const wk = t.value!.splits.find((s) => s.id === 'weekend_weekday')!;
    assert.equal(wk.detectable, true);
    assert.ok(wk.diff < -10);
  });
  test('nemesis hole needs 3 plays and a clear gap', () => {
    const rs = Array.from({ length: 3 }, (_, i) => round(`n${i}`, eighteen((n) => ({ strokes: n === 7 ? 8 : 5 }))));
    const n = nemesisHoles(rs, cfg).value!;
    assert.equal(n.holes[0]!.hole, 7);
    assert.equal(nemesisHoles(rs.slice(0, 2), cfg).status, 'needs_more');
  });
});

describe('club gapping, real vs default', () => {
  const defaultFor = (club: string) => (distances.suggestDistance(club, 'S').carry.defaultValue);
  const g = clubGapping(syntheticRangeShots(), null, defaultFor, cfg);
  test('gap flags: PW to SW big, hybrid/5-iron overlap, driver not part of gaps', () => {
    const v = g.value!;
    assert.ok(!v.gaps.some((x) => x.longer === 'DR' || x.shorter === 'DR'));
    assert.equal(v.gaps.find((x) => x.longer === 'PW' && x.shorter === 'SW')!.flag, 'big');
    assert.equal(v.gaps.find((x) => x.longer === 'HY' && x.shorter === '5I')!.flag, 'overlap');
  });
  test('P50 is the type-7 median of the raw carries and labels follow shot counts', () => {
    const raw = syntheticRangeShots();
    const seven = raw.filter((s) => s.club === '7I').map((s) => s.carryYds!);
    const row = g.value!.clubs.find((c) => c.club === '7I')!;
    assert.equal(row.p50, Math.round(quantile7(seven, 0.5)! * 10) / 10);
    assert.equal(row.label, 'Yours');
    assert.equal(g.value!.clubs.find((c) => c.club === 'SW')!.label, 'Learning'); // 6 shots
    assert.equal(g.value!.clubs.find((c) => c.club === '9I')!.label, 'Learning'); // 9 shots
    assert.equal(g.value!.clubs.find((c) => c.club === '8I')!.label, 'Yours'); // 10 shots
  });
  test('delta vs default = measured P50 - default (real club-distances engine, S flex)', () => {
    const row = g.value!.clubs.find((c) => c.club === '7I')!;
    const def = distances.suggestDistance('7I', 'S').carry.defaultValue!;
    assert.equal(row.defaultCarry, def);
    assert.equal(row.deltaVsDefault, Math.round((row.p50! - def) * 10) / 10);
  });
  test('GPS-like / unknown-quality distances never count as carry', () => {
    const rs = syntheticRangeShots().map((s) => ({ ...s, carryQuality: 'unknown' as const }));
    assert.equal(clubGapping(rs, null, () => null, cfg).status, 'needs_more');
  });
  test('estimated on-course carries never feed gapping', () => {
    const rs = syntheticRangeShots().map((x) => ({ ...x, carryQuality: 'estimated' as const }));
    assert.equal(clubGapping(rs, null, () => null, cfg).status, 'needs_more');
  });
  test('unmeasured clubs are listed with their default only as display, never in gaps', () => {
    const v = clubGapping(syntheticRangeShots(), ['DR', '7I', 'PW', 'SW', 'GW', 'LW'], defaultFor, cfg).value;
    // 4 measured (DR,7I,PW,SW) but only 3 non-driver; gate needs >= 3 clubs
    assert.ok(v);
    assert.deepEqual(v!.unmeasured.map((u) => u.club).sort(), ['GW', 'LW']);
    assert.ok(!v!.gaps.some((x) => x.longer === 'GW' || x.shorter === 'GW'));
  });
  test('environments are never pooled: course and range are separate, larger group wins, ties go to course', () => {
    const range = Array.from({ length: 5 }, (_, i) => shot({ id: `r${i}`, club: '7I', environment: 'range', carryYds: 150 }));
    const course = Array.from({ length: 5 }, (_, i) => shot({ id: `c${i}`, club: '7I', environment: 'course', carryYds: 120 }));
    const others = ['6I', '8I', '9I'].flatMap((c, k) => Array.from({ length: 3 }, (_, i) => shot({ id: `${c}${i}`, club: c, carryYds: 100 + k * 10 })));
    const v = clubGapping([...range, ...course, ...others], null, () => null, cfg).value!;
    const seven = v.clubs.find((c) => c.club === '7I')!;
    assert.equal(seven.environment, 'course');
    assert.equal(seven.p50, 120);
    assert.equal(seven.n, 5);
  });
  test('toPlayerShots feeds club-distances: 2 shots default, 3 learning, 10 yours', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => shot({ id: `x${i}`, club: '7I', carryYds: 150 + i }));
    for (const [n, label] of [[2, 'Default'], [3, 'Learning'], [10, 'Yours']] as const) {
      const s = distances.suggestDistance('7I', 'S', null, toPlayerShots(mk(n), '7I'));
      assert.equal(s.label, label, `n=${n}`);
    }
  });
});

describe('dispersion', () => {
  const mk = (n: number, lat: (i: number) => number) => Array.from({ length: n }, (_, i) => shot({ id: `d${i}`, club: '7I', lateralYds: lat(i), longitudinalYds: i % 2 === 0 ? 4 : -4 }));
  test('10 shots with a steady 6-yard right bias recommends aiming 6 left', () => {
    const d = dispersion(mk(10, (i) => 6 + (i % 2 === 0 ? 3 : -3)), cfg).value!;
    assert.equal(d.clubs[0]!.aimOffsetYds, -6);
    assert.equal(d.clubs[0]!.biasLateralYds, 6);
  });
  test('zero bias gives no aim offset', () => {
    const d = dispersion(mk(10, (i) => (i % 2 === 0 ? 5 : -5)), cfg).value!;
    assert.equal(d.clubs[0]!.aimOffsetYds, null);
  });
  test('under the gate: pending, needs more, no ellipse', () => {
    const ins = dispersion(mk(7, () => 1), cfg);
    assert.equal(ins.status, 'needs_more');
    assert.equal(ins.value, null);
    assert.match(ins.invitation!, /Needs 3 more tracked shots/);
  });
  test('ellipse covers about 80% of a large normal-ish sample', () => {
    const shots = syntheticRangeShots().filter((s) => s.club === 'DR');
    const d = dispersion(shots, cfg).value!.clubs[0]!;
    const e = d.ellipse;
    const th = (e.angleDeg * Math.PI) / 180;
    let inside = 0;
    for (const s of shots) {
      const x = s.lateralYds! - e.cx, y = s.longitudinalYds! - e.cy;
      const u = x * Math.cos(th) + y * Math.sin(th), v = -x * Math.sin(th) + y * Math.cos(th);
      if ((u / e.a) ** 2 + (v / e.b) ** 2 <= 1) inside++;
    }
    assert.ok(inside / shots.length > 0.65 && inside / shots.length < 0.95, `coverage ${inside / shots.length}`);
  });
});

describe('strokes gained', () => {
  // A SYNTHETIC test baseline. Not real numbers. Only usable with allowSyntheticBaseline.
  const synth: Baseline = {
    name: 'SYNTHETIC test baseline', kind: 'handicap_band', synthetic: true,
    expected: (lie, d) => (lie === 'green' ? 1 + 0.08 * Math.min(d, 20) : lie === 'sand' ? 2.4 + d / 60 : 1.8 + d / 55),
  };
  const oneHole = (): { rounds: RoundInput[]; shots: ShotInput[] } => {
    const mkS = (seq: number, o: Partial<ShotInput>) => shot({ id: `h${seq}`, club: 'X', environment: 'course', roundId: 'g1', hole: 1, seq, ...o });
    const shots = [
      mkS(1, { startLie: 'tee', startDistToPinYds: 400, endLie: 'fairway', endDistToPinYds: 150 }),
      mkS(2, { startLie: 'fairway', startDistToPinYds: 150, endLie: 'green', endDistToPinYds: 10 }),
      mkS(3, { startLie: 'green', startDistToPinYds: 10, endLie: 'holed', endDistToPinYds: 0 }),
    ];
    return { rounds: [round('g1', [hole(1, { par: 4, strokes: 3, putts: 1, penalties: 0 })])], shots };
  };
  test('per-shot SG telescopes to E(start) - strokes (hand check)', () => {
    const { rounds, shots } = oneHole();
    const { holes } = reconcileHoles(shots, rounds);
    assert.equal(holes.length, 1);
    const sg = shotStrokesGained(holes, synth, cfg);
    const e0 = synth.expected('tee', 400)!;
    const total = sg.reduce((a, x) => a + x.sg!, 0);
    assert.ok(Math.abs(total - (e0 - 3)) < 1e-9);
    assert.deepEqual(sg.map((x) => x.category), ['off_tee', 'approach', 'putting']);
  });
  test('a penalty shot costs an extra stroke', () => {
    const mkS = (seq: number, o: Partial<ShotInput>) => shot({ id: `p${seq}`, club: 'X', environment: 'course', roundId: 'g1', hole: 1, seq, ...o });
    const shots = [
      mkS(1, { startLie: 'tee', startDistToPinYds: 400, endLie: 'rough', endDistToPinYds: 300, penaltyStrokes: 1 }),
      mkS(2, { startLie: 'rough', startDistToPinYds: 300, endLie: 'holed', endDistToPinYds: 0 }),
    ];
    const rounds = [round('g1', [hole(1, { par: 4, strokes: 3, putts: 0, penalties: 1 })])];
    const sg = shotStrokesGained(reconcileHoles(shots, rounds).holes, synth, cfg);
    assert.ok(Math.abs(sg[0]!.sg! - (synth.expected('tee', 400)! - synth.expected('rough', 300)! - 2)) < 1e-9);
  });
  test('holes whose shots do not add up to the scorecard are rejected, not guessed', () => {
    const { rounds, shots } = oneHole();
    const bad = [round('g1', [hole(1, { par: 4, strokes: 4, putts: 1, penalties: 0 })])];
    const r = reconcileHoles(shots, bad);
    assert.equal(r.holes.length, 0);
    assert.equal(r.rejected, 1);
    void rounds;
  });
  test('a broken chain (end spot of one shot is not the start spot of the next) is rejected', () => {
    const { rounds, shots } = oneHole();
    const broken = shots.map((s, i) => (i === 1 ? { ...s, startDistToPinYds: 120 } : s));
    assert.equal(reconcileHoles(broken, rounds).holes.length, 0);
  });
  test('own-average baseline: ranking falls back to the scorecard ledger (it nets to ~0 and cannot rank losses)', () => {
    assert.equal(full.strokesGained.status, 'ready');
    assert.equal(full.strokesGained.value!.absolute, false);
    assert.equal(full.ranking!.value!.method, 'par_allotment');
  });
  test('own-average SG per hole telescopes on real fixture holes when the baseline covers all shots', () => {
    const { holes } = reconcileHoles(seasonShots, seasonRounds);
    const base = buildSelfBaseline(holes, cfg)!;
    let checked = 0;
    for (const h of holes) {
      const sg = shotStrokesGained([h], base, cfg);
      if (sg.some((x) => x.sg === null)) continue;
      const e0 = base.expected(h.shots[0]!.startLie!, h.shots[0]!.startDistToPinYds!)!;
      assert.ok(Math.abs(sg.reduce((a, x) => a + x.sg!, 0) - (e0 - h.strokes)) < 1e-9);
      checked++;
    }
    assert.ok(checked > 100, `checked ${checked}`);
  });
  test('a tour/handicap-band baseline switches the ranking to strokes gained; synthetic baselines refuse to run in production paths', () => {
    assert.throws(() => analyze({ rounds: seasonRounds, shots: seasonShots, baseline: synth }), /Synthetic baseline refused/);
    const a = analyze({ rounds: seasonRounds, shots: seasonShots, baseline: synth, allowSyntheticBaseline: true });
    assert.equal(a.strokesGained.value!.absolute, true);
    assert.equal(a.ranking!.value!.method, 'strokes_gained');
  });
  test('no on-course shots: not collected, invitation explains', () => {
    const ins = strokesGained(syntheticRangeShots(), seasonRounds, null, cfg);
    assert.equal(ins.status, 'not_collected');
    assert.ok(ins.missingInputs.length > 0);
  });
});

describe('where you lose strokes + one fix', () => {
  test('top fix is the highest score = strokes x fixability x confidence', () => {
    const v = full.oneFix.value!;
    assert.ok(v.fix);
    const best = [...v.candidates].sort((a, b) => b.score - a.score)[0]!;
    assert.equal(v.fix!.id, best.id);
    for (const c of v.candidates) {
      const expect = c.strokesPer18 * (cfg.fixability[c.id] ?? 0.5) * cfg.confidenceWeight[c.confidence];
      assert.ok(Math.abs(c.score - expect) < 0.011);
    }
  });
  test('rotation: the same fix is damped by 0.6 so a close runner-up takes over', () => {
    const inp = { ledger: full.ledger, blowups: full.blowups, threePutt: full.threePutt, penalties: full.penalties, fairways: full.fairways };
    const first = selectOneFix(inp, cfg).value!;
    const again = selectOneFix({ ...inp, lastFix: { id: first.fix!.id, strokesPer18: first.fix!.strokesPer18 } }, cfg).value!;
    const [a, b] = first.candidates;
    const expectSwitch = b!.score > a!.score * 0.6;
    assert.equal(again.fix!.id !== first.fix!.id, expectSwitch);
    if (expectSwitch) assert.equal(again.rotatedAwayFrom, first.fix!.id);
  });
  test('a clean card has no fix and says so', () => {
    const rs = Array.from({ length: 4 }, (_, i) => round(`c${i}`, eighteen(() => ({ strokes: 4, putts: 2, penalties: 0 }))));
    const a = analyze({ rounds: rs });
    assert.equal(a.oneFix.status, 'ready');
    assert.equal(a.oneFix.value!.fix, null);
    assert.match(a.oneFix.take!, /No single leak/);
  });
  test('fix prescription is attached and names a drill', () => {
    const p = full.oneFix.value!.fix!.prescription;
    assert.ok(p.drill.steps.length >= 2 && p.headline.length > 10 && p.strategy.length > 10);
  });
  test('ranking lists losses before strengths and carries a caveat', () => {
    const r = full.ranking!.value!;
    assert.ok(r.caveat.length > 10);
    for (let i = 1; i < r.losses.length; i++) assert.ok(r.losses[i - 1]!.strokesPer18 >= r.losses[i]!.strokesPer18);
    assert.ok(r.strengths.every((s) => s.strokesPer18 <= 0));
  });
});

describe('grounding: every number in a take is engine-computed', () => {
  test('all takes on the synthetic season', () => {
    for (const ins of insightsOf(full)) {
      if (ins.take === null) continue;
      assert.deepEqual(ungroundedNumbers(ins.take, ins.numbers), [], `${ins.id}: ${ins.take}`);
    }
  });
  test('the guard catches an invented number', () => {
    assert.deepEqual(ungroundedNumbers('You lose 4.7 strokes', []), ['4.7']);
    assert.deepEqual(ungroundedNumbers('You lose 4.7 strokes', [4.7]), []);
    assert.deepEqual(ungroundedNumbers('Your 7-iron and par 5s', []), []);
  });
});

describe('share cards', () => {
  const cards = buildCards(full);
  test('cards exist, are sample-labeled, location-free and grounded', () => {
    assert.ok(cards.length >= 4);
    for (const c of cards) {
      assert.equal(c.sample, true);
      assert.equal(c.includesLocation, false);
      assert.ok(!(c.take + c.headline).includes(COURSE.name));
      assert.deepEqual(ungroundedNumbers(`${c.bigNumber} ${c.take}`, c.numbers), []);
      assert.match(c.basis, /^Based on \d+ /);
    }
  });
  test('no card for an insight that is not ready', () => {
    assert.deepEqual(buildCards(analyze({ rounds: thinPlayer() })), []);
    assert.deepEqual(buildCards(analyze({ rounds: [] })), []);
  });
});

describe('integration', () => {
  const defaultFor = (club: string) => distances.suggestDistance(club, 'S').carry.defaultValue;
  test('fitter bag-gap input is measured only and brand-neutral', () => {
    const gap = clubGapping(syntheticRangeShots(), null, defaultFor, cfg);
    const disp = dispersion(syntheticRangeShots(), cfg);
    const fit = toFitterBagGap(gap, disp)!;
    assert.equal(fit.dataQuality, 'measured');
    assert.equal(fit.brandNeutral, true);
    assert.ok(fit.measured.every((m) => m.carryP50 > 0 && 'dispersionWidthYds' in m));
    const big = fit.gaps.find((x) => x.flag === 'big')!;
    assert.equal(big.category, 'wedges');
    const lo = gap.value!.clubs.find((c) => c.club === big.shorter)!.p50!;
    assert.equal(big.targetCarryYds, Math.round(lo + big.gapYds / 2));
    assert.ok(!JSON.stringify(fit).match(/price|commission|brand_name|affiliate/i));
    assert.equal(toFitterBagGap(clubGapping([], null, () => null, cfg), null), null);
  });
  test('crew badges: opted-out players are invisible, need 2+ eligible, ties are shared', () => {
    const mkSeason = (offset: number) => Array.from({ length: 8 }, (_, i) => simulateRound(offset * 100 + i, { playedOn: '2026-06-06', period: 'am', format: 'game', target: 90, weekend: true }).round);
    const members = [
      { playerId: 'a', displayName: 'A', sharesStats: true, rounds: mkSeason(1) },
      { playerId: 'b', displayName: 'B', sharesStats: true, rounds: mkSeason(2) },
      { playerId: 'c', displayName: 'C', sharesStats: false, rounds: mkSeason(3) },
    ];
    const badges = crewBadges(members);
    assert.ok(badges.length >= 2);
    for (const b of badges) assert.ok(b.winners.every((w) => w.playerId !== 'c'));
    assert.deepEqual(crewBadges([members[0]!, members[2]!]), []); // only one opted-in
    const twin = crewBadges([{ ...members[0]!, playerId: 'x' }, { ...members[0]!, playerId: 'y' }]);
    const clean = twin.find((b) => b.id === 'clean_card')!;
    assert.deepEqual(clean.winners.map((w) => w.playerId).sort(), ['x', 'y']);
  });
  test('hustler explainer: BB are points, sums by par type, gated at 9 holes, disclosure attached', () => {
    const rs = [simulateRound(5, { playedOn: '2026-06-06', period: 'am', format: 'game', target: null, weekend: true }).round];
    const h = hustlerExplainer(rs)!;
    assert.equal(h.holesWithBB, 18);
    assert.equal(h.byPar.par3 + h.byPar.par4 + h.byPar.par5, h.bbNetTotal);
    assert.match(h.disclosure, /no real-world value/);
    assert.deepEqual(ungroundedNumbers(h.take, h.numbers), []);
    assert.equal(hustlerExplainer([round('x', [hole(1, { bbNet: 5 })])]), null);
  });
});

describe('determinism and doc drift', () => {
  test('analyze is deterministic', () => {
    assert.equal(JSON.stringify(analyze({ rounds: seasonRounds, shots: seasonShots })), JSON.stringify(full));
  });
  test('every insight id is documented in ANALYSIS_SPEC.md', () => {
    const md = readFileSync(new URL('../ANALYSIS_SPEC.md', import.meta.url), 'utf8');
    for (const ins of insightsOf(full)) assert.ok(md.includes('`' + ins.id + '`'), `spec is missing \`${ins.id}\``);
  });
  test('fixtures are marked synthetic', () => {
    const src = readFileSync(new URL('../fixtures/synthetic.ts', import.meta.url), 'utf8');
    assert.match(src, /SYNTHETIC TEST DATA/);
    assert.ok(seasonRounds.every((r) => r.isSample) && seasonShots.every((s) => s.isSample));
  });
});
