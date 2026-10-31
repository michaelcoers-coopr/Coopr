/** Shareable insight cards, and the grounding guard that keeps every printed number engine-computed. */
import type { Insight } from './types';

export interface InsightCard {
  kind: 'one_fix' | 'loss_ranking' | 'gap' | 'pressure' | 'fade' | 'three_putt' | 'generic';
  eyebrow: string;
  bigNumber: string;
  bigUnit: string;
  headline: string;
  take: string;
  /** "Based on 9 rounds". Always present. */
  basis: string;
  confidenceLabel: string;
  /** Red SAMPLE chip. A card made from sample data can never lose it. */
  sample: boolean;
  /** Course names, dates and playing partners are never on a card unless the player turns that on. */
  includesLocation: false;
  footer: string;
  /** Numbers allowed to appear in headline/take/bigNumber. */
  numbers: number[];
}

const CONF: Record<string, string> = { insufficient: 'Not enough yet', limited: 'Early read', moderate: 'Solid read', solid: 'Locked in' };

export function makeCard(ins: Insight<unknown>, spec: { kind: InsightCard['kind']; eyebrow: string; bigNumber: number; bigUnit: string; headline: string; decimals?: number }): InsightCard | null {
  if (ins.status !== 'ready' || ins.take === null) return null; // no card for a number we do not have
  const big = Number(spec.bigNumber.toFixed(spec.decimals ?? 1));
  return {
    kind: spec.kind, eyebrow: spec.eyebrow, bigNumber: String(big), bigUnit: spec.bigUnit, headline: spec.headline, take: ins.shareTake ?? ins.take,
    basis: `Based on ${ins.n} ${ins.nUnit}`, confidenceLabel: CONF[ins.confidence]!, sample: ins.sample, includesLocation: false,
    footer: 'COOPR · Chase your PR', numbers: [...ins.numbers, big],
  };
}

/** Structural vocabulary that may appear without being "a statistic": hole/putt/par/club words. */
const STRUCTURAL = new Set([1, 2, 3, 4, 5, 9, 14, 18]);

/** Returns every number token in `text` that is neither engine-computed nor structural. Empty = grounded. */
export function ungroundedNumbers(text: string, allowed: readonly number[]): string[] {
  const out: string[] = [];
  const stripped = text.replace(/\b\d{1,2}-(wood|iron)s?\b/gi, '');
  const tokens = stripped.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const t of tokens) {
    const v = Number(t);
    if (STRUCTURAL.has(v)) continue;
    if (allowed.some((a) => Math.abs(a - v) < 1e-9 || Math.abs(Math.abs(a) - v) < 1e-9)) continue;
    out.push(t);
  }
  return out;
}
