import type {
  ClubProfile,
  Club,
  GolfIqAssessment,
  IqComponent,
  IqInsight,
  GapAnomaly,
  PracticePriority,
  CategoryCoverage,
} from '@coopr/core';
import { clamp01, round1 } from './stats';
import { distanceRank, category } from './club-order';

export interface GolfIqOptions {
  /** Minimum shots for a club to count toward baseline coverage. */
  minBaselineShots?: number;
}

const DEFAULT_MIN_SHOTS = 8;

// One representative profile per club: the one with the most data.
function representativeProfiles(profiles: ClubProfile[]): ClubProfile[] {
  const best = new Map<string, ClubProfile>();
  for (const p of profiles) {
    const cur = best.get(p.clubId);
    if (!cur || p.sampleSize > cur.sampleSize) best.set(p.clubId, p);
  }
  return [...best.values()];
}

function reliability(p: ClubProfile): number {
  return clamp01(0.6 * (1 - p.shortMissRate) + 0.4 * p.confidence);
}

function meanReliability(profiles: ClubProfile[]): number | null {
  if (profiles.length === 0) return null;
  return profiles.reduce((a, p) => a + reliability(p), 0) / profiles.length;
}

function gradeFor(score: number): string {
  if (score < 35) return 'Foundational';
  if (score < 50) return 'Developing';
  if (score < 65) return 'Competent';
  if (score < 80) return 'Skilled';
  return 'Elite';
}

/**
 * The baseline Golf IQ assessment. Pure and deterministic: same profiles → same
 * result. Produces an overall score, component sub-scores, gapping anomalies, ranked
 * insights, and practice priorities from the biggest expected-score leaks.
 */
export function assessGolfIq(
  allProfiles: ClubProfile[],
  clubs: Club[],
  opts: GolfIqOptions = {},
): GolfIqAssessment {
  const minShots = opts.minBaselineShots ?? DEFAULT_MIN_SHOTS;
  const clubById = new Map(clubs.map((c) => [c.id, c]));
  const profiles = representativeProfiles(allProfiles).sort((a, b) => a.clubId.localeCompare(b.clubId));

  // --- Gapping anomalies -----------------------------------------------------
  const ranked = profiles
    .map((p) => ({ p, club: clubById.get(p.clubId), rank: clubById.get(p.clubId) ? distanceRank(clubById.get(p.clubId)!) : null }))
    .filter((x): x is { p: ClubProfile; club: Club; rank: number } => x.club != null && x.rank != null)
    .sort((a, b) => a.rank - b.rank);

  const gapAnomalies: GapAnomaly[] = [];
  for (let i = 0; i < ranked.length - 1; i++) {
    const longer = ranked[i]!; // should be longer
    const shorter = ranked[i + 1]!; // should be shorter
    const expectedGap = longer.p.stockDistanceYards - shorter.p.stockDistanceYards; // expected positive
    const signedGap = round1(shorter.p.stockDistanceYards - longer.p.stockDistanceYards);
    const base = {
      longerClubId: longer.p.clubId, longerClubLabel: longer.p.clubLabel,
      shorterClubId: shorter.p.clubId, shorterClubLabel: shorter.p.clubLabel, gapYards: signedGap,
    };
    if (expectedGap < -3) gapAnomalies.push({ kind: 'inversion', ...base });
    else if (expectedGap < 5) gapAnomalies.push({ kind: 'overlap', ...base });
    else if (longer.club.type === 'iron' && shorter.club.type === 'iron' && expectedGap > 20)
      gapAnomalies.push({ kind: 'large_gap', ...base });
  }

  // --- Component scores ------------------------------------------------------
  const longGroup = profiles.filter((p) => {
    const c = clubById.get(p.clubId);
    if (!c) return false;
    if (c.type === 'driver' || c.type === 'wood' || c.type === 'hybrid' || c.type === 'utility') return true;
    return c.type === 'iron' && ['5i', '6i', '7i'].includes(p.clubLabel.toLowerCase());
  });
  const shortGroup = profiles.filter((p) => {
    const c = clubById.get(p.clubId);
    if (!c) return false;
    if (c.type === 'wedge') return true;
    return c.type === 'iron' && ['8i', '9i', 'pw', 'aw'].includes(p.clubLabel.toLowerCase());
  });

  const consistency = pctOrNeutral(meanReliability(profiles));
  const avgRelIqr =
    profiles.length > 0
      ? profiles.reduce((a, p) => a + (p.stockDistanceYards > 0 ? p.dispersion.iqrYards / p.stockDistanceYards : 1), 0) /
        profiles.length
      : 1;
  const predictability = Math.round(100 * clamp01(1 - avgRelIqr / 0.35));
  const inversions = gapAnomalies.filter((a) => a.kind === 'inversion').length;
  const overlaps = gapAnomalies.filter((a) => a.kind === 'overlap').length;
  const largeGaps = gapAnomalies.filter((a) => a.kind === 'large_gap').length;
  const gapping = Math.max(0, 100 - 15 * inversions - 8 * overlaps - 6 * largeGaps);
  const longGame = pctOrNeutral(meanReliability(longGroup));
  const shortGame = pctOrNeutral(meanReliability(shortGroup));

  const components: IqComponent[] = [
    { key: 'consistency', label: 'Strike consistency', score: consistency, rationale: `Across ${profiles.length} clubs, blending short-miss rate and confidence.` },
    { key: 'predictability', label: 'Predictability', score: predictability, rationale: `Average dispersion is ${Math.round(avgRelIqr * 100)}% of stock distance.` },
    { key: 'gapping', label: 'Bag gapping', score: gapping, rationale: `${inversions} inversion(s), ${overlaps} overlap(s), ${largeGaps} large gap(s).` },
    { key: 'long_game', label: 'Long game', score: longGame, rationale: longGroup.length ? `${longGroup.length} long clubs assessed.` : 'No long-club baseline yet.' },
    { key: 'short_game', label: 'Short game', score: shortGame, rationale: shortGroup.length ? `${shortGroup.length} scoring clubs assessed.` : 'No wedge/short-iron baseline yet.' },
  ];

  const weights: Record<string, number> = { consistency: 0.3, predictability: 0.2, gapping: 0.2, long_game: 0.15, short_game: 0.15 };
  const overallScore = Math.round(components.reduce((a, c) => a + c.score * weights[c.key]!, 0));

  // --- Practice priorities (biggest scoring leaks) ---------------------------
  const priorities: PracticePriority[] = profiles
    .map((p) => {
      const leak = clamp01(0.6 * p.shortMissRate + 0.4 * (1 - p.confidence));
      let reason: string;
      if (p.shortMissRate >= 0.3) reason = `High short-miss rate (${Math.round(p.shortMissRate * 100)}%).`;
      else if (p.confidence < 0.4) reason = `Low confidence (n=${p.sampleSize}).`;
      else reason = `Wide dispersion (${Math.round(p.dispersion.iqrYards)} yд IQR).`;
      return { clubId: p.clubId, clubLabel: p.clubLabel, leakScore: round1(leak * 100) / 100, reason };
    })
    .sort((a, b) => b.leakScore - a.leakScore || a.clubLabel.localeCompare(b.clubLabel))
    .slice(0, 3);

  // --- Coverage --------------------------------------------------------------
  const cats: CategoryCoverage['category'][] = ['driver', 'woods_hybrids', 'irons', 'wedges'];
  const coverage: CategoryCoverage[] = cats.map((cat) => {
    const inCat = profiles.filter((p) => {
      const c = clubById.get(p.clubId);
      return c != null && category(c) === cat;
    });
    const adequate = inCat.some((p) => p.sampleSize >= minShots);
    return { category: cat, clubsWithData: inCat.length, adequate };
  });
  const baselineCompleteness = coverage.filter((c) => c.adequate).length / coverage.length;

  // --- Insights (ranked) -----------------------------------------------------
  const insights: IqInsight[] = [];
  for (const a of gapAnomalies.filter((x) => x.kind === 'inversion')) {
    insights.push({
      code: 'gap_inversion', severity: 'priority', clubIds: [a.longerClubId, a.shorterClubId],
      text: `${a.longerClubLabel} and ${a.shorterClubLabel} are inverted — ${a.shorterClubLabel} is carrying farther. Verify strike and lofts before changing anything.`,
    });
  }
  if (priorities[0] && priorities[0].leakScore >= 0.35) {
    insights.push({
      code: 'biggest_leak', severity: 'priority', clubIds: [priorities[0].clubId],
      text: `${priorities[0].clubLabel} is your biggest scoring leak: ${priorities[0].reason} Prioritize it in practice.`,
    });
  }
  for (const a of gapAnomalies.filter((x) => x.kind === 'overlap')) {
    insights.push({
      code: 'gap_overlap', severity: 'watch', clubIds: [a.longerClubId, a.shorterClubId],
      text: `${a.longerClubLabel} and ${a.shorterClubLabel} carry almost the same distance — a possible redundancy.`,
    });
  }
  for (const c of coverage.filter((x) => !x.adequate)) {
    insights.push({
      code: 'coverage_gap', severity: 'watch', clubIds: [],
      text: `No solid ${c.category.replace('_', '/')} baseline yet — log a session to complete your assessment.`,
    });
  }
  const mostReliable = [...profiles].sort((a, b) => reliability(b) - reliability(a))[0];
  if (mostReliable) {
    insights.push({
      code: 'most_reliable', severity: 'info', clubIds: [mostReliable.clubId],
      text: `Most reliable club: ${mostReliable.clubLabel}. Lean on it when you need a shot you can trust.`,
    });
  }
  const severityRank = { priority: 0, watch: 1, info: 2 } as const;
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // --- Confidence & disclaimers ----------------------------------------------
  const totalShots = profiles.reduce((a, p) => a + p.sampleSize, 0);
  const weightedConf = totalShots > 0 ? profiles.reduce((a, p) => a + p.confidence * p.sampleSize, 0) / totalShots : 0;
  const confidence = round1(clamp01(weightedConf * (0.5 + 0.5 * baselineCompleteness)) * 100) / 100;

  const disclaimers = ['Computed deterministically from your logged shots — add a session per club to sharpen it.'];
  if (profiles.some((p) => p.environment === 'simulator'))
    disclaimers.push('Simulator carries can read short of outdoor; that gap is tracked separately and never auto-applied.');
  if (baselineCompleteness < 1) disclaimers.push('Baseline is incomplete — some categories still need a session.');

  return {
    overallScore,
    grade: gradeFor(overallScore),
    components,
    insights: insights.slice(0, 6),
    gapAnomalies,
    practicePriorities: priorities,
    coverage,
    baselineCompleteness: round1(baselineCompleteness * 100) / 100,
    confidence,
    disclaimers,
  };
}

function pctOrNeutral(r: number | null): number {
  return r == null ? 50 : Math.round(r * 100);
}
