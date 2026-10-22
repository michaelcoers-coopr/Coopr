import type { CaddiePersonality, DistanceMetric } from '@coopr/domain';
import { DEFAULT_PERSONALITY } from '@coopr/domain';
import type { DistanceProfile } from './profile';

export interface Hazard {
  side: 'front' | 'back' | 'left' | 'right';
  kind: string;
  /** Carry yards required to clear. Never a total distance. */
  carryToClearYards: number | null;
}

export interface UnusedAggregate {
  clubLabel: string;
  note: string;
}

export interface CaddieRequest {
  targetDistanceYards: number;
  targetMetric: DistanceMetric | 'unspecified';
  hazards: readonly Hazard[];
  intent: 'neutral' | 'attack_pin' | 'play_safe' | 'lay_up';
  riskPreference: 'conservative' | 'neutral' | 'aggressive';
  profiles: readonly DistanceProfile[];
  candidateClubIds?: readonly string[];
  clubLabels?: Readonly<Record<string, string>>;
  intendedClubId?: string | null;
  intendedClubLabel?: string | null;
  intendedSwingMode?: string | null;
  unusedAggregates?: readonly UnusedAggregate[];
  personality?: CaddiePersonality;
  recordOutcome?: boolean;
}

export interface QuantileBand {
  p20: number;
  p50: number;
  p80: number;
}

export interface CaddieLines {
  distance: string;
  club: string;
  swingMode: string;
  target: string;
  expected: string;
  keyRisk: string;
  reason: string;
  instruction: string | null;
}

export interface CaddieCard {
  posture: 'recommend' | 'conservative' | 'decline';
  clubId: string | null;
  clubLabel: string | null;
  swingMode: string | null;
  strategicTarget: string;
  recommendedAim: string;
  mechanicalMissPattern: string | null;
  expectedCarry: QuantileBand | null;
  expectedTotal: QuantileBand | null;
  metricUsed: DistanceMetric | null;
  lines: CaddieLines;
  /** Selection cost in yards-equivalent. Not a probability and not shown as one. */
  selectionCost: number | null;
  /**
   * A closer stock that was not called. Null when the called club is the closest,
   * or when no club is called. The winner does not change because this exists.
   */
  passedCloser: string | null;
}

const SAMPLE_FLOOR = 5;
const FIRM_SAMPLE = 8;
const STOCK_GAP_YARDS = 8;
/** A stock farther than this from the shot is not called. The gap is yards, not a probability. */
export const STOCK_REACH_YARDS = 15;

/**
 * Geometry only. This function does not read a miss pattern, and there is no
 * aim-offset parameter to add one later without changing the signature.
 */
export function strategicTargetFor(request: Pick<CaddieRequest, 'hazards' | 'intent'>): string {
  if (request.intent === 'lay_up') return 'Safe layup zone';
  const lateral = request.hazards.find((hazard) => hazard.side === 'left' || hazard.side === 'right');
  if (lateral) {
    const away = lateral.side === 'right' ? 'left' : 'right';
    return `Fat side, ${away} of center, away from the ${lateral.side} ${lateral.kind}`;
  }
  if (request.hazards.some((hazard) => hazard.side === 'front')) {
    return 'Center of the green, past the carry line';
  }
  if (request.intent === 'attack_pin') return 'Pin';
  return 'Center';
}

function missPattern(profile: DistanceProfile): string | null {
  const parts: string[] = [];
  if (profile.shortMissShare >= 0.25 && profile.shortMissShare >= profile.longMissShare) {
    parts.push('short of the median in this sample');
  } else if (profile.longMissShare >= 0.25) {
    parts.push('long of the median in this sample');
  }
  if (profile.lateralMiss === 'left') parts.push('left');
  if (profile.lateralMiss === 'right') parts.push('right');
  return parts.length === 0 ? null : parts.join('; ');
}

function band(profile: DistanceProfile): QuantileBand {
  return { p20: profile.p20, p50: profile.p50, p80: profile.p80 };
}

function yards(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function decisionMetric(request: CaddieRequest): DistanceMetric | null {
  if (request.hazards.some((hazard) => hazard.side === 'front')) return 'carry';
  if (request.targetMetric === 'unspecified') return null;
  return request.targetMetric;
}

function poolFor(request: CaddieRequest, metric: DistanceMetric): DistanceProfile[] {
  const allow = request.candidateClubIds ? new Set(request.candidateClubIds) : null;
  const matching = request.profiles.filter((profile) => {
    if (profile.metric !== metric) return false;
    if (allow && !allow.has(profile.clubId)) return false;
    return true;
  });
  const blendedKeys = new Set(matching.filter((profile) => profile.blended).map((profile) => `${profile.clubId}|${profile.swingMode}`));
  return matching.filter((profile) => profile.blended || !blendedKeys.has(`${profile.clubId}|${profile.swingMode}`));
}

function clearsFront(profile: DistanceProfile, hazards: readonly Hazard[]): boolean {
  if (profile.metric !== 'carry' || profile.dispersionKnown === false) return false;
  for (const hazard of hazards) {
    if (hazard.side !== 'front') continue;
    if (hazard.carryToClearYards == null) return false;
    if (profile.p20 < hazard.carryToClearYards) return false;
  }
  return true;
}

function selectionCost(profile: DistanceProfile, target: number): number {
  const gap = Math.abs(profile.stockYards - target);
  const confidencePenalty = profile.confidence === 'limited' ? 12 : 0;
  return gap + confidencePenalty + profile.iqr * 0.1;
}

function footnote(request: CaddieRequest): string {
  const notes = request.unusedAggregates ?? [];
  if (notes.length === 0) return '';
  return ` Unused: ${notes.map((note) => `${note.clubLabel} — ${note.note}`).join(' ')}`;
}

function expectedText(carry: QuantileBand | null, total: QuantileBand | null): string {
  const carryText = carry ? `carry median ${yards(carry.p50)} (P20 ${yards(carry.p20)}, P80 ${yards(carry.p80)})` : 'carry unknown';
  const totalText = total ? `total median ${yards(total.p50)} (P20 ${yards(total.p20)}, P80 ${yards(total.p80)})` : 'total unknown';
  return `${carryText}; ${totalText}`;
}

interface Draft {
  posture: CaddieCard['posture'];
  clubId: string | null;
  clubLabel: string | null;
  swingMode: string | null;
  pattern: string | null;
  carry: QuantileBand | null;
  total: QuantileBand | null;
  metricUsed: DistanceMetric | null;
  keyRisk: string;
  reason: string;
  instruction: string | null;
  selectionCost: number | null;
  passedCloser?: string | null;
}

function finish(request: CaddieRequest, draft: Draft): CaddieCard {
  const strategicTarget = strategicTargetFor(request);
  const recommendedAim = strategicTarget;
  const personality = request.personality ?? DEFAULT_PERSONALITY;
  const lines: CaddieLines = {
    distance: `${yards(request.targetDistanceYards)} yards (${request.targetMetric === 'unspecified' ? 'metric not stated' : request.targetMetric})`,
    club: draft.clubLabel ?? 'No club',
    swingMode: draft.swingMode ?? 'not recorded',
    target: strategicTarget,
    expected: expectedText(draft.carry, draft.total),
    keyRisk: draft.keyRisk,
    reason: voice(personality, draft.reason),
    instruction: draft.instruction,
  };
  return {
    posture: draft.posture,
    clubId: draft.clubId,
    clubLabel: draft.clubLabel,
    swingMode: draft.swingMode,
    strategicTarget,
    recommendedAim,
    mechanicalMissPattern: draft.pattern,
    expectedCarry: draft.carry,
    expectedTotal: draft.total,
    metricUsed: draft.metricUsed,
    lines,
    selectionCost: draft.selectionCost,
    passedCloser: draft.passedCloser ?? null,
  };
}

/** Closer stocks that lost. Thin samples and scattered samples stay named, and they are not called. */
function closerLeftOut(request: CaddieRequest, metric: DistanceMetric, winner: DistanceProfile): string | null {
  const winnerGap = Math.abs(winner.stockYards - request.targetDistanceYards);
  const front = request.hazards.filter((hazard) => hazard.side === 'front');
  const key = (profile: DistanceProfile) =>
    `${profile.clubId}|${profile.swingMode}|${profile.environment}|${profile.metric}|${profile.blended ? 'blend' : 'raw'}`;
  const winnerKey = key(winner);
  const closer = poolFor(request, metric)
    .filter((profile) => key(profile) !== winnerKey)
    .filter((profile) => Math.abs(profile.stockYards - request.targetDistanceYards) + 0.05 < winnerGap)
    .sort(
      (a, b) =>
        Math.abs(a.stockYards - request.targetDistanceYards) - Math.abs(b.stockYards - request.targetDistanceYards) ||
        a.clubLabel.localeCompare(b.clubLabel),
    );
  const lines = closer.slice(0, 2).map((profile) => {
    const gap = Math.abs(profile.stockYards - request.targetDistanceYards);
    const head = `Closer club left out: ${profile.clubLabel} ${metric} ${yards(profile.stockYards)} is ${yards(gap)} yards off from ${profile.sampleSize} shots`;
    if (profile.sampleSize < SAMPLE_FLOOR) return `${head}, only ${profile.sampleSize} shots, so it stays out.`;
    if (front.length > 0 && !clearsFront(profile, front)) return `${head}, and it does not clear the carry line, so it stays out.`;
    return `${head}, and those shots scatter, so it stays out.`;
  });
  return lines.length === 0 ? null : lines.join(' ');
}

function voice(personality: CaddiePersonality, reason: string): string {
  if (personality === 'funny_knowledgeable') return `The joke can wait. ${reason}`;
  if (personality === 'encouraging_coach') return `We can work with the truth. ${reason}`;
  if (personality === 'classic_tour') return `Play the number you have. ${reason}`;
  if (personality === 'direct_analytical') return reason;
  return reason;
}

function decline(request: CaddieRequest, draft: Omit<Draft, 'posture' | 'selectionCost'> & { selectionCost?: number | null }): CaddieCard {
  return finish(request, { ...draft, posture: 'decline', selectionCost: draft.selectionCost ?? null });
}

/**
 * Deterministic caddie. Same request, same card. No random draws, no clock, no network.
 * A language model may later rephrase `lines`, and may not change club, target, or numbers.
 */
export function recommend(request: CaddieRequest): CaddieCard {
  const target = strategicTargetFor(request);
  void target;

  if (request.recordOutcome && request.intendedClubId) {
    const metric = decisionMetric(request);
    const existing = metric ? poolFor(request, metric).find((profile) => profile.clubId === request.intendedClubId) : undefined;
    if (!existing || existing.sampleSize < SAMPLE_FLOOR) {
      return decline(request, {
        clubId: request.intendedClubId,
        clubLabel: request.intendedClubLabel ?? request.intendedClubId,
        swingMode: request.intendedSwingMode ?? null,
        pattern: null,
        carry: null,
        total: null,
        metricUsed: null,
        keyRisk: 'Uncalibrated. There is no measured sample, so the outcome is unknown.',
        reason: `${request.intendedClubLabel ?? 'This club'} has no usable measured sample for this shot. Nothing is invented to fill the gap.`,
        instruction: 'Record the carry and the total as two separate results. Do not copy one into the other.',
      });
    }
  }

  const metric = decisionMetric(request);
  if (metric == null) {
    return decline(request, {
      clubId: null,
      clubLabel: null,
      swingMode: null,
      pattern: null,
      carry: null,
      total: null,
      metricUsed: null,
      keyRisk: 'Carry and total were not stated, and they are not the same number.',
      reason: 'The distance metric is unspecified. A total will not be treated as a carry, and a carry will not be treated as a total.',
      instruction: null,
    });
  }

  const front = request.hazards.filter((hazard) => hazard.side === 'front');
  let candidates = poolFor(request, metric).filter((profile) => profile.sampleSize >= SAMPLE_FLOOR);
  if (front.length > 0) {
    candidates = candidates.filter((profile) => clearsFront(profile, front));
  }

  if (candidates.length === 0) {
    const totals = poolFor(request, 'total').filter((profile) =>
      request.candidateClubIds ? request.candidateClubIds.includes(profile.clubId) : true,
    );
    const totalNote =
      metric === 'carry' && totals.length > 0
        ? ` ${totals
            .map((profile) => `${profile.clubLabel} total median ${yards(profile.stockYards)} is not a carry`)
            .join('. ')}.`
        : '';
    const thin = poolFor(request, metric).filter((profile) => profile.sampleSize < SAMPLE_FLOOR);
    const thinNote =
      thin.length > 0
        ? ` Sample too small (${thin.map((profile) => `${profile.clubLabel} n=${profile.sampleSize}`).join(', ')}).`
        : '';
    const missing = (request.candidateClubIds ?? []).filter(
      (clubId) => !request.profiles.some((profile) => profile.clubId === clubId && profile.metric === metric),
    );
    const missingNote =
      missing.length > 0
        ? ` No ${metric} measurements for ${missing.map((clubId) => request.clubLabels?.[clubId] ?? clubId).join(', ')}.`
        : '';
    const frontNote =
      front.length > 0
        ? ' Hazard clearance uses the carry P20. No club in this set has a carry P20 that clears it.'
        : '';
    return decline(request, {
      clubId: null,
      clubLabel: null,
      swingMode: null,
      pattern: null,
      carry: null,
      total: null,
      metricUsed: null,
      keyRisk: front.length > 0 ? `Front ${front.map((hazard) => hazard.kind).join(', ')} is not cleared by a measured carry.` : 'No eligible measured sample.',
      reason: `Declining. No eligible ${metric} sample.${frontNote}${missingNote}${totalNote}${thinNote}${footnote(request)}`.replace(/\s+/g, ' ').trim(),
      instruction: front.length > 0 ? 'Do not substitute a total distance for the carry.' : null,
    });
  }

  const ranked = [...candidates].sort((a, b) => {
    const cost = selectionCost(a, request.targetDistanceYards) - selectionCost(b, request.targetDistanceYards);
    if (cost !== 0) return cost;
    return a.clubLabel.localeCompare(b.clubLabel);
  });
  const winner = ranked[0];
  if (!winner) {
    return decline(request, {
      clubId: null,
      clubLabel: null,
      swingMode: null,
      pattern: null,
      carry: null,
      total: null,
      metricUsed: null,
      keyRisk: 'No eligible measured sample.',
      reason: 'Declining.',
      instruction: null,
    });
  }

  const gap = Math.abs(winner.stockYards - request.targetDistanceYards);
  if (gap > STOCK_REACH_YARDS) {
    return decline(request, {
      clubId: null,
      clubLabel: null,
      swingMode: null,
      pattern: null,
      carry: null,
      total: null,
      metricUsed: null,
      keyRisk: `The shot is ${yards(gap)} yards from the closest measured stock.`,
      reason: `No club. The closest ${metric} is ${winner.clubLabel} at ${yards(winner.stockYards)}, ${yards(gap)} yards from ${yards(request.targetDistanceYards)}. A call stays within ${STOCK_REACH_YARDS} yards of a measured stock. Nothing is stretched to fit.`,
      instruction: null,
    });
  }
  const posture: CaddieCard['posture'] =
    winner.sampleSize < FIRM_SAMPLE || winner.confidence === 'limited' || gap > STOCK_GAP_YARDS ? 'conservative' : 'recommend';
  const carry = winner.metric === 'carry' ? band(winner) : null;
  const total = winner.metric === 'total' ? band(winner) : null;
  const other = request.profiles.find(
    (profile) =>
      profile.clubId === winner.clubId &&
      profile.environment === winner.environment &&
      profile.swingMode === winner.swingMode &&
      profile.metric !== winner.metric,
  );
  const expectedCarry = winner.metric === 'carry' ? carry : other?.metric === 'carry' ? band(other) : null;
  const expectedTotal = winner.metric === 'total' ? total : other?.metric === 'total' ? band(other) : null;

  const riskParts = [
    posture === 'conservative' ? 'Conservative: the sample or the gap does not support a firm number.' : 'The median is the stock, not the longest shot.',
  ];
  if (expectedCarry == null) riskParts.push('Carry is unknown, so this cannot clear a hazard.');
  if (winner.sampleWarning) riskParts.push(winner.sampleWarning);
  if (front.length > 0) riskParts.push(`Front ${front[0]!.kind} checked with carry P20 ${yards(winner.p20)}.`);
  const passedCloser = closerLeftOut(request, metric, winner);

  return finish(request, {
    posture,
    clubId: winner.clubId,
    clubLabel: winner.clubLabel,
    swingMode: winner.swingMode === 'unknown' ? null : winner.swingMode,
    pattern: missPattern(winner),
    carry: expectedCarry,
    total: expectedTotal,
    metricUsed: metric,
    keyRisk: riskParts.join(' '),
    passedCloser,
    reason: `${winner.clubLabel} ${metric} ${winner.blended ? 'blended median' : 'median'} is ${yards(winner.stockYards)} from ${winner.sampleSize} ${winner.blended ? 'combined' : winner.environment} ${winner.reported ? 'reported' : 'shots'} (${winner.swingMode} swing). Confidence is ${winner.confidence}. The longest shot in the sample is ${yards(winner.longestYards)} and is not the stock.${winner.reported ? ' This is their reported number, not a COOPR measurement.' : ''}${footnote(request)}${passedCloser ? ` ${passedCloser}` : ''}`,
    instruction: [
      expectedCarry == null && metric === 'total' ? 'Do not use this total to clear a hazard.' : null,
      winner.swingMode === 'unknown' ? 'The source did not record a swing mode. Do not assume a full stock swing.' : null,
    ]
      .filter((part): part is string => part != null)
      .join(' ') || null,
    selectionCost: selectionCost(winner, request.targetDistanceYards),
  });
}

/** Response order: distance, club, swing, target, expected, risk, reason, optional instruction. */
export function orderedLines(card: CaddieCard): string[] {
  const lines = [
    `Distance: ${card.lines.distance}`,
    `Club: ${card.lines.club}`,
    `Swing: ${card.lines.swingMode}`,
    `Target: ${card.lines.target}`,
    `Expected: ${card.lines.expected}`,
    `Risk: ${card.lines.keyRisk}`,
    `Reason: ${card.lines.reason}`,
  ];
  if (card.lines.instruction) lines.push(`Instruction: ${card.lines.instruction}`);
  return lines;
}
