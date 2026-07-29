import type {
  ClubProfile,
  QuantileSet,
  Recommendation,
  RecommendationInput,
  Reason,
  RiskLevel,
  RiskPreference,
  Hazard,
} from '@coopr/core';
import { cdfFromQuantiles, clamp01, round1 } from './stats';
import { playsLikeDistance, LIE_DISTANCE_MULT, LIE_DISPERSION_MULT } from './conditions';

// Scoring weights (in "penalty units", roughly yards-equivalent). Lower total = better
// expected outcome. Tuned so that a longer, safer club beats an on-distance club whose
// short-miss tail overlaps a front hazard — invariant 2, the golden rule.
const HAZARD_W_FRONT = 40;
const HAZARD_W_BACK = 30;
const HAZARD_W_LATERAL = 8;
const SHORTFALL_W = 0.5; // extra cost per yard the stock strike comes up short
const REACH_W = 5; // cost of the club's chance of not reaching the target
const CONFIDENCE_W = 5; // cost of low confidence (uncertainty)

const RISK_HAZARD_MULT: Record<RiskPreference, number> = { conservative: 1.3, neutral: 1.0, aggressive: 0.7 };
const RISK_SHORT_MULT: Record<RiskPreference, number> = { conservative: 1.5, neutral: 1.0, aggressive: 0.6 };

interface EffModel {
  stock: number;
  q: QuantileSet; // effective quantiles in the comparison metric, lie-adjusted
  metricMismatch: boolean;
}

/** Effective distance model for a club under the current lie, in the target metric. */
function effectiveModel(p: ClubProfile, input: RecommendationInput): EffModel {
  const distMult = LIE_DISTANCE_MULT[input.conditions.lie];
  const dispMult = LIE_DISPERSION_MULT[input.conditions.lie];

  // Prefer the quantile set matching the target metric; fall back to the backing set.
  const matching = input.targetMetric === 'carry' ? p.carry : p.total;
  const fallback = p.metric === 'carry' ? p.carry : p.total;
  const baseQ = matching ?? fallback ?? { p20: p.stockDistanceYards, p50: p.stockDistanceYards, p80: p.stockDistanceYards };
  const metricMismatch = matching == null && p.metric !== input.targetMetric;

  const stock = p.stockDistanceYards * distMult;
  const p50 = baseQ.p50 * distMult;
  // Inflate spread around the median for a poorer lie.
  const q: QuantileSet = {
    p20: round1(p50 - (p50 - baseQ.p20 * distMult) * dispMult),
    p50: round1(p50),
    p80: round1(p50 + (baseQ.p80 * distMult - p50) * dispMult),
  };
  return { stock: round1(stock), q, metricMismatch };
}

function frontHazards(hs: Hazard[]): Hazard[] {
  return hs.filter((h) => h.side === 'front');
}
function backHazards(hs: Hazard[]): Hazard[] {
  return hs.filter((h) => h.side === 'back');
}
function sideHazards(hs: Hazard[], side: 'left' | 'right'): Hazard[] {
  return hs.filter((h) => h.side === side);
}

/** Probability a stock-ish shot comes up short of a front hazard it must carry. */
function shortOfHazardProb(eff: EffModel, h: Hazard, fallbackShortMiss: number): number {
  if (h.distanceYards == null) return fallbackShortMiss; // no geometry: use the club's short-miss rate
  return cdfFromQuantiles(eff.q, h.distanceYards);
}

function scoreCandidate(p: ClubProfile, eff: EffModel, input: RecommendationInput, playsLike: number): number {
  const centerError = Math.abs(eff.stock - playsLike);
  const shortfall = Math.max(0, playsLike - eff.stock) * SHORTFALL_W * RISK_SHORT_MULT[input.riskPreference];
  const reach = cdfFromQuantiles(eff.q, playsLike) * REACH_W; // chance of not reaching
  const confidencePenalty = (1 - p.confidence) * CONFIDENCE_W;

  let hazardPenalty = 0;
  const hm = RISK_HAZARD_MULT[input.riskPreference];
  for (const h of frontHazards(input.hazards)) {
    hazardPenalty += shortOfHazardProb(eff, h, p.shortMissRate) * HAZARD_W_FRONT * hm;
  }
  for (const h of backHazards(input.hazards)) {
    const longProb = h.distanceYards == null ? p.longMissRate : 1 - cdfFromQuantiles(eff.q, h.distanceYards);
    hazardPenalty += longProb * HAZARD_W_BACK * hm;
  }
  // Lateral hazards: we rarely have a lateral distribution in Phase 1, so this is a
  // modest, symmetric nudge away from clubs when a side hazard exists.
  const lateralCount = sideHazards(input.hazards, 'left').length + sideHazards(input.hazards, 'right').length;
  hazardPenalty += lateralCount * 0.5 * HAZARD_W_LATERAL * hm;

  return centerError + shortfall + reach + confidencePenalty + hazardPenalty;
}

function levelFromProb(x: number): RiskLevel {
  if (x < 0.1) return 'low';
  if (x < 0.25) return 'moderate';
  if (x < 0.45) return 'elevated';
  return 'high';
}

function chooseStrategicTarget(input: RecommendationInput, worstSide: 'left' | 'right' | null): string {
  if (input.intent === 'lay_up') return 'Safe layup zone';
  if (worstSide) {
    const fat = worstSide === 'right' ? 'left' : 'right';
    return `Fat side of the green (${fat}-center, away from the ${worstSide})`;
  }
  if (input.intent === 'attack_pin') return 'Pin';
  return 'Center green';
}

/**
 * The deterministic caddie. Pure: same input → same output. Selects the lowest
 * expected-score club/mode, then produces a strategic target and separate risk fields.
 * A language model never runs here; it only renders `reasons` afterward.
 */
export function recommend(input: RecommendationInput): Recommendation {
  if (input.profiles.length === 0) throw new Error('recommend: no candidate profiles');

  const { playsLikeYards, reasons: conditionReasons } = playsLikeDistance(input.targetDistanceYards, input.conditions);

  const scored = input.profiles.map((p) => {
    const eff = effectiveModel(p, input);
    return { p, eff, score: scoreCandidate(p, eff, input, playsLikeYards) };
  });
  // Deterministic selection: lowest score, tie-broken by center error then label.
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Math.abs(a.eff.stock - playsLikeYards) - Math.abs(b.eff.stock - playsLikeYards) ||
      a.p.clubLabel.localeCompare(b.p.clubLabel),
  );
  const winner = scored[0]!;
  const p = winner.p;
  const eff = winner.eff;

  // Risk fields (kept separate; mechanical miss never becomes an aim offset).
  const front = frontHazards(input.hazards);
  const frontProb = front.length > 0 ? Math.max(...front.map((h) => shortOfHazardProb(eff, h, p.shortMissRate))) : 0;
  const shortRisk = levelFromProb(clamp01(0.6 * frontProb + 0.5 * p.shortMissRate));

  const back = backHazards(input.hazards);
  const backProb =
    back.length > 0
      ? Math.max(...back.map((h) => (h.distanceYards == null ? p.longMissRate : 1 - cdfFromQuantiles(eff.q, h.distanceYards))))
      : 0;
  const longRisk = levelFromProb(clamp01(0.6 * backProb + 0.4 * p.longMissRate));

  const leftBias = p.lateral?.biasNote?.includes('left') ? 0.3 : 0;
  const rightBias = p.lateral?.biasNote?.includes('right') ? 0.3 : 0;
  const leftRisk = levelFromProb(clamp01((sideHazards(input.hazards, 'left').length > 0 ? 0.3 : 0) + leftBias));
  const rightRisk = levelFromProb(clamp01((sideHazards(input.hazards, 'right').length > 0 ? 0.3 : 0) + rightBias));

  const worstSide: 'left' | 'right' | null =
    rightRisk === 'high' || rightRisk === 'elevated'
      ? 'right'
      : leftRisk === 'high' || leftRisk === 'elevated'
        ? 'left'
        : null;
  const strategicTarget = chooseStrategicTarget(input, worstSide);

  // Miss-zone warning: the most salient overlap, if any.
  let missZoneWarning: string | null = null;
  if (shortRisk === 'high' || shortRisk === 'elevated') {
    const kind = front[0]?.kind ?? null;
    missZoneWarning = kind
      ? `Short-miss distribution overlaps the front ${kind}.`
      : 'Short misses come up meaningfully short of target.';
  } else if (worstSide) {
    const h = sideHazards(input.hazards, worstSide)[0];
    if (h) missZoneWarning = `Miss zone elevated on the ${worstSide}; ${h.kind} is tight ${worstSide}.`;
  }

  const reasons: Reason[] = [...conditionReasons];
  reasons.push({
    code: 'selection',
    text: `${p.clubLabel} (${p.swingMode}) gives the lowest expected score for ${playsLikeYards} yd plays-like — stock ${round1(eff.stock)} yd.`,
  });
  if (scored.length > 1) {
    const runnerUp = scored[1]!;
    reasons.push({
      code: 'comparison',
      text: `Preferred over ${runnerUp.p.clubLabel}: ${
        front.length > 0 ? 'more front-clear margin against the hazard' : 'better distance match with acceptable risk'
      }.`,
    });
  }
  if (eff.metricMismatch) {
    reasons.push({
      code: 'metric_mismatch',
      text: `Target is stated in ${input.targetMetric}, but this club is modeled from ${p.metric} data — treat the number as ${p.metric}-based.`,
    });
  }
  if (p.confidence < 0.4) {
    reasons.push({ code: 'low_confidence', text: `Confidence is low (n=${p.sampleSize}); expect wider outcomes.` });
  }
  if (p.validationRequired) {
    reasons.push({ code: 'validation', text: 'This club has a session flagged for data validation.' });
  }

  const distMult = LIE_DISTANCE_MULT[input.conditions.lie];
  const scaleQ = (q: QuantileSet | null): QuantileSet | null =>
    q ? { p20: round1(q.p20 * distMult), p50: round1(q.p50 * distMult), p80: round1(q.p80 * distMult) } : null;

  return {
    clubId: p.clubId,
    clubLabel: p.clubLabel,
    swingMode: p.swingMode,
    strategicTarget,
    recommendedAim: strategicTarget, // NEVER offset by mechanicalMissPattern (invariant 3)
    mechanicalMissPattern: p.lateral?.biasNote ?? null,
    playsLikeDistanceYards: playsLikeYards,
    expectedCarryYards: scaleQ(p.carry),
    expectedTotalYards: scaleQ(p.total),
    shortRisk,
    longRisk,
    leftRisk,
    rightRisk,
    missZoneWarning,
    confidence: round1((eff.metricMismatch ? p.confidence * 0.9 : p.confidence) * 100) / 100,
    metricMismatch: eff.metricMismatch,
    reasons,
  };
}
