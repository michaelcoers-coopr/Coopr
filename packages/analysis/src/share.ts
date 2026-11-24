import type { Analysis } from './index';
import { makeCard, type InsightCard } from './cards';

/** Builds every shareable card the current analysis supports. Needs-more insights produce no card (no number, no card). */
export function buildCards(a: Analysis): InsightCard[] {
  const cards: (InsightCard | null)[] = [];
  const fix = a.oneFix;
  if (fix.status === 'ready' && fix.value!.fix) {
    const x = fix.value!.fix;
    cards.push(makeCard(fix, { kind: 'one_fix', eyebrow: 'ONE THING TO FIX', bigNumber: x.strokesPer18, bigUnit: 'STROKES / ROUND', headline: x.shortLabel, decimals: 1 }));
  }
  const rk = a.ranking;
  if (rk && rk.status === 'ready' && rk.value!.losses[0]) {
    const t = rk.value!.losses[0];
    cards.push(makeCard(rk, { kind: 'loss_ranking', eyebrow: 'WHERE I LOSE STROKES', bigNumber: t.strokesPer18, bigUnit: 'STROKES / ROUND', headline: t.label, decimals: 1 }));
  }
  const tp = a.threePutt;
  if (tp.status === 'ready') cards.push(makeCard(tp, { kind: 'three_putt', eyebrow: '3-PUTT WATCH', bigNumber: tp.value!.per18, bigUnit: '3-PUTTS / ROUND', headline: 'Lag it close' }));
  const gp = a.gapping;
  if (gp.status === 'ready') {
    const big = gp.value!.gaps.filter((g) => g.flag === 'big').sort((x, y) => y.gapYds - x.gapYds)[0];
    if (big) cards.push(makeCard(gp, { kind: 'gap', eyebrow: 'HOLE IN MY BAG', bigNumber: big.gapYds, bigUnit: 'YARD GAP', headline: `${big.longer} to ${big.shorter}`, decimals: 0 }));
  }
  const fd = a.backNine;
  if (fd.status === 'ready' && fd.value!.verdict === 'fade') cards.push(makeCard(fd, { kind: 'fade', eyebrow: 'BACK-NINE FADE', bigNumber: fd.value!.meanBackMinusFront, bigUnit: 'STROKES WORSE', headline: 'Back nine bites' }));
  const pr = a.pressure;
  if (pr.status === 'ready' && pr.value!.verdict !== 'no_detectable_effect') cards.push(makeCard(pr, { kind: 'pressure', eyebrow: 'PRESSURE HOLES', bigNumber: Math.abs(pr.value!.meanDelta), bigUnit: 'STROKES / HOLE', headline: pr.value!.verdict === 'pressure_tax' ? 'Pressure tax' : 'Ice in the veins', decimals: 2 }));
  return cards.filter((c): c is InsightCard => c !== null);
}
