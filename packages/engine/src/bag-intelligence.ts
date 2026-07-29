import type {
  Club,
  ClubProfile,
  DistanceMetric,
  BagIntelligence,
  ClubReport,
  ClubStatus,
  BagGap,
  BagInsight,
  IdealBagItem,
  Evidence,
  KnownDistance,
  ClubFeedbackInput,
} from '@coopr/core';
import { distanceRank, category } from './club-order';
import { clamp01, round1 } from './stats';

export interface BagInput {
  profiles: ClubProfile[];
  clubs: Club[];
  knownDistances?: KnownDistance[];
  feedback?: ClubFeedbackInput[];
}

export interface BagOptions {
  minReliableShots?: number;
}

const DEFAULT_MIN_SHOTS = 5;
const OVERLAP_YARDS = 6; // stocks within this are effectively the same club
const LARGE_GAP_YARDS = 24;
const POOR_FLOOR_SHORT_MISS = 0.35;
const LOW_CONFIDENCE = 0.4;
const RELIABLE_CONFIDENCE = 0.5;

interface Entry {
  club: Club;
  stock: number | null;
  metric: DistanceMetric | null;
  confidence: number;
  evidence: Evidence;
  sampleSize: number;
  shortMissRate: number;
  iqrYards: number | null;
  rank: number | null;
  feedbackConfidence: 'low' | 'moderate' | 'high' | null;
}

const EVIDENCE_RANK: Record<Evidence, number> = { measured: 3, aggregate: 2, user: 1, none: 0 };

// Prefer the club backed by better evidence, then higher confidence, then more shots.
function better(a: Entry, b: Entry): Entry {
  if (EVIDENCE_RANK[a.evidence] !== EVIDENCE_RANK[b.evidence])
    return EVIDENCE_RANK[a.evidence] > EVIDENCE_RANK[b.evidence] ? a : b;
  if (Math.abs(a.confidence - b.confidence) > 0.02) return a.confidence > b.confidence ? a : b;
  return a.sampleSize >= b.sampleSize ? a : b;
}

function buildEntry(
  club: Club,
  profiles: ClubProfile[],
  known: Map<string, KnownDistance>,
  feedback: Map<string, ClubFeedbackInput>,
): Entry {
  const clubProfiles = profiles.filter((p) => p.clubId === club.id);
  const best = clubProfiles.sort((a, b) => b.sampleSize - a.sampleSize)[0];
  const fb = feedback.get(club.id)?.confidence ?? null;
  if (best) {
    return {
      club, stock: best.stockDistanceYards, metric: best.metric, confidence: best.confidence,
      evidence: 'measured', sampleSize: best.sampleSize, shortMissRate: best.shortMissRate,
      iqrYards: best.dispersion.iqrYards, rank: distanceRank(club), feedbackConfidence: fb,
    };
  }
  const kd = known.get(club.id);
  if (kd) {
    return {
      club, stock: kd.carryYards, metric: 'carry', confidence: kd.source === 'aggregate' ? 0.25 : 0.2,
      evidence: kd.source, sampleSize: 0, shortMissRate: 0, iqrYards: null, rank: distanceRank(club),
      feedbackConfidence: fb,
    };
  }
  return {
    club, stock: null, metric: null, confidence: 0, evidence: 'none', sampleSize: 0, shortMissRate: 0,
    iqrYards: null, rank: distanceRank(club), feedbackConfidence: fb,
  };
}

export function analyzeBag(input: BagInput, opts: BagOptions = {}): BagIntelligence {
  const minShots = opts.minReliableShots ?? DEFAULT_MIN_SHOTS;
  const known = new Map((input.knownDistances ?? []).map((k) => [k.clubId, k]));
  const feedback = new Map((input.feedback ?? []).map((f) => [f.clubId, f]));

  const entries = input.clubs
    .filter((c) => c.type !== 'putter')
    .map((c) => buildEntry(c, input.profiles, known, feedback))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const withStock = entries.filter((e) => e.stock != null);

  // --- Gaps between adjacent clubs (by loft order) ---------------------------
  const gaps: BagGap[] = [];
  const overlapPartner = new Map<string, Entry>(); // clubId -> the club it overlaps
  for (let i = 0; i < withStock.length - 1; i++) {
    const longer = withStock[i]!;
    const shorter = withStock[i + 1]!;
    const expectedGap = round1(longer.stock! - shorter.stock!);
    let kind: BagGap['kind'] = 'ok';
    if (expectedGap < -3) kind = 'inversion';
    else if (expectedGap <= OVERLAP_YARDS) kind = 'overlap';
    else if (expectedGap > LARGE_GAP_YARDS) kind = 'large_gap';
    if (kind === 'overlap') {
      overlapPartner.set(longer.club.id, shorter);
      overlapPartner.set(shorter.club.id, longer);
    }
    gaps.push({
      longerClubId: longer.club.id, longerLabel: longer.club.label,
      shorterClubId: shorter.club.id, shorterLabel: shorter.club.label,
      gapYards: expectedGap, kind,
    });
  }

  // --- Per-club status -------------------------------------------------------
  const reports: ClubReport[] = entries.map((e) => {
    const reasons: string[] = [];
    let status: ClubStatus;

    const partner = overlapPartner.get(e.club.id);
    const redundant = partner != null && better(e, partner) !== e; // the other is better

    if (e.evidence === 'none') {
      status = 'gather_data';
      reasons.push('No shot data yet — log a session to profile this club.');
      if (e.feedbackConfidence === 'low') reasons.push('You rate its strike quality low.');
    } else if (redundant) {
      status = e.evidence === 'measured' ? 'test' : 'remove';
      reasons.push(`Carries almost the same as your ${partner!.club.label}, which has stronger evidence.`);
    } else if (e.evidence !== 'measured') {
      status = 'gather_data';
      reasons.push('Distance is from a summary, not logged shots — confirm with a session.');
    } else if (e.sampleSize < minShots) {
      status = 'gather_data';
      reasons.push(`Only ${e.sampleSize} shots — log more for a reliable read.`);
    } else if (e.shortMissRate >= POOR_FLOOR_SHORT_MISS) {
      status = 'test';
      reasons.push(`High upside but a poor floor (${Math.round(e.shortMissRate * 100)}% land well short) — test a more forgiving option.`);
    } else if (e.confidence < LOW_CONFIDENCE) {
      status = 'test';
      reasons.push(`Low confidence (n=${e.sampleSize}, wide spread) — test a more forgiving option.`);
    } else if (e.confidence >= RELIABLE_CONFIDENCE && e.shortMissRate < 0.3) {
      status = 'keep';
      reasons.push('Reliable and well gapped.');
    } else {
      status = 'retest';
      reasons.push('Borderline — recheck in your next session.');
    }

    return {
      clubId: e.club.id, clubLabel: e.club.label, status, stockYards: e.stock, metric: e.metric,
      confidence: e.confidence, evidence: e.evidence, reasons,
    };
  });

  // --- Insights (ranked) -----------------------------------------------------
  const insights: BagInsight[] = [];
  for (const g of gaps.filter((x) => x.kind === 'inversion')) {
    insights.push({
      code: 'inversion', severity: 'priority', clubIds: [g.longerClubId, g.shorterClubId],
      text: `${g.longerLabel} and ${g.shorterLabel} are inverted — ${g.shorterLabel} carries farther. Verify strike and lofts.`,
    });
  }
  for (const g of gaps.filter((x) => x.kind === 'overlap')) {
    insights.push({
      code: 'overlap', severity: 'watch', clubIds: [g.longerClubId, g.shorterClubId],
      text: `${g.longerLabel} and ${g.shorterLabel} overlap (~${Math.abs(g.gapYards)} yд apart) — you may only need one.`,
    });
  }
  for (const r of reports.filter((x) => x.status === 'test' && x.evidence === 'measured')) {
    insights.push({
      code: 'poor_floor', severity: 'priority', clubIds: [r.clubId],
      text: `${r.clubLabel}: ${r.reasons[0]}`,
    });
  }
  for (const g of gaps.filter((x) => x.kind === 'large_gap')) {
    insights.push({
      code: 'large_gap', severity: 'watch', clubIds: [g.longerClubId, g.shorterClubId],
      text: `A ${Math.round(g.gapYards)} yд gap between ${g.longerLabel} and ${g.shorterLabel} — a club may be missing here.`,
    });
  }
  // Feedback-driven (subjective, no measured data): surface the spread per category.
  insights.push(...feedbackInsights(entries));

  const severityRank = { priority: 0, watch: 1, info: 2 } as const;
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // --- Ideal bag (a reasoned summary, not a prescription) --------------------
  const actionFor = (s: ClubStatus): IdealBagItem['action'] =>
    s === 'remove' ? 'drop' : s === 'test' || s === 'replace' ? 'test_alternative' : 'carry';
  const idealBag: IdealBagItem[] = reports.map((r) => ({
    clubLabel: r.clubLabel,
    role: roleFor(input.clubs.find((c) => c.id === r.clubId)!),
    action: actionFor(r.status),
    rationale: r.reasons[0] ?? '',
  }));
  const carryCount = idealBag.filter((i) => i.action !== 'drop').length;

  return { clubReports: reports, gaps, insights: insights.slice(0, 8), idealBag, carryCount };
}

function feedbackInsights(entries: Entry[]): BagInsight[] {
  const rankVal = { low: 0, moderate: 1, high: 2 } as const;
  const out: BagInsight[] = [];
  const byCat = new Map<string, Entry[]>();
  for (const e of entries) {
    const cat = category(e.club);
    if (!cat) continue;
    const arr = byCat.get(cat);
    if (arr) arr.push(e);
    else byCat.set(cat, [e]);
  }
  for (const [, group] of byCat) {
    const rated = group.filter((e) => e.feedbackConfidence != null && e.evidence !== 'measured');
    if (rated.length < 2) continue;
    const sorted = [...rated].sort((a, b) => rankVal[b.feedbackConfidence!] - rankVal[a.feedbackConfidence!]);
    const top = sorted[0]!;
    const bottom = sorted[sorted.length - 1]!;
    if (top.feedbackConfidence === bottom.feedbackConfidence) continue;
    out.push({
      code: 'feedback_spread', severity: 'watch', clubIds: [top.club.id, bottom.club.id],
      text: `By feel, your ${top.club.label} rates highest and your ${bottom.club.label} lowest — log a session to confirm which to carry.`,
    });
  }
  return out;
}

function roleFor(club: Club): string {
  switch (club.type) {
    case 'driver': return 'Tee';
    case 'wood': return 'Long';
    case 'hybrid': return 'Long/rescue';
    case 'utility': return 'Long iron replacement';
    case 'iron': return 'Approach';
    case 'wedge': return 'Scoring';
    default: return 'Other';
  }
}
