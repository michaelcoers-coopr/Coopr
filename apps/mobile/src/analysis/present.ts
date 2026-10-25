import { buildCards, type Analysis, type FixId, type Insight } from '@coopr/analysis';

export interface AnalysisRow {
  label: string;
  detail: string;
  tone: 'loss' | 'gain' | 'neutral';
}

export interface AnalysisPanel {
  id: string;
  eyebrow: string;
  title: string;
  status: Insight<unknown>['status'];
  sample: boolean;
  confidence: string | null;
  /** Set only when the insight is ready. The screen must not draw a number otherwise. */
  figure: string | null;
  unit: string | null;
  /** The ready fix's short name, such as APPROACH + SHORT GAME. Null until a fix exists. */
  headline: string | null;
  invitation: string | null;
  take: string | null;
  action: string | null;
  caveat: string | null;
  /** The ready fix, so a finished round can remember which leak was shown. */
  fixId: FixId | null;
  rows: AnalysisRow[];
}

const CONFIDENCE: Record<string, string> = {
  insufficient: 'Not enough yet',
  limited: 'Early read',
  moderate: 'Solid read',
  solid: 'Locked in',
};

function figureOf(status: Insight<unknown>['status'], value: number | null | undefined): string | null {
  if (status !== 'ready' || value == null || !Number.isFinite(value)) return null;
  return String(value);
}

function blank(insight: Insight<unknown>, eyebrow: string): AnalysisPanel {
  return {
    id: insight.id,
    eyebrow,
    title: insight.title,
    status: insight.status,
    sample: insight.sample,
    confidence: insight.status === 'ready' ? (CONFIDENCE[insight.confidence] ?? null) : null,
    figure: null,
    unit: null,
    headline: null,
    invitation: insight.invitation,
    take: insight.status === 'ready' ? insight.take : null,
    action: null,
    caveat: null,
    fixId: null,
    rows: [],
  };
}

export function presentAnalysis(analysis: Analysis): AnalysisPanel[] {
  const fix = analysis.oneFix;
  const home = blank(fix, '1 · ANALYSIS');
  if (fix.status === 'ready' && fix.value?.fix) {
    home.fixId = fix.value.fix.id;
    home.headline = fix.value.fix.shortLabel;
    home.figure = figureOf('ready', fix.value.fix.strokesPer18);
    home.unit = 'STROKES / ROUND';
    const headline = fix.value.fix.prescription.headline;
    const drill = `${fix.value.fix.prescription.drill.title}: ${fix.value.fix.prescription.drill.steps[0] ?? ''}`.trim();
    home.action = home.take?.includes(headline) ? drill : `${headline} ${drill}`.trim();
    if (fix.value.runnerUp) home.rows = [{ label: 'Also on the radar', detail: fix.value.runnerUp.label, tone: 'neutral' }];
  } else if (fix.status === 'ready') {
    home.action = fix.take;
  }

  const ledger = analysis.ledger;
  const loss = blank(ledger, '2 · WHERE YOU LOSE STROKES');
  loss.caveat = analysis.ranking?.status === 'ready' ? analysis.ranking.value?.caveat ?? null : "Measured against par's allowance, not against Tour players.";
  if (ledger.status === 'ready' && ledger.value) {
    const top = ledger.value.items[0];
    loss.figure = figureOf('ready', top?.strokesPer18);
    loss.unit = 'STROKES / ROUND';
    loss.rows = ledger.value.items.map((item) => ({
      label: item.label,
      detail: String(item.strokesPer18),
      tone: item.strokesPer18 > 0 ? 'loss' : item.strokesPer18 < 0 ? 'gain' : 'neutral',
    }));
    if (top && top.strokesPer18 > 0) loss.action = `Next round, start with ${top.label}.`;
  }

  const gap = analysis.gapping;
  const bag = blank(gap, '3 · YOUR BAG, FOR REAL');
  if (gap.status === 'ready' && gap.value) {
    const big = [...gap.value.gaps].filter((item) => item.flag === 'big').sort((a, b) => b.gapYds - a.gapYds)[0];
    bag.figure = figureOf('ready', big?.gapYds ?? gap.value.clubs[0]?.p50);
    bag.unit = big ? 'YARD GAP' : 'CARRY';
    bag.rows = gap.value.clubs.map((club) => ({
      label: `${club.club} · ${club.label}`,
      detail: club.p50 == null ? '' : String(club.p50),
      tone: 'neutral' as const,
    }));
    for (const item of gap.value.gaps) {
      if (item.flag === 'ok') continue;
      bag.rows.push({ label: `${item.longer} to ${item.shorter}`, detail: item.flag === 'big' ? 'GAP' : 'OVERLAP', tone: item.flag === 'big' ? 'loss' : 'neutral' });
    }
  } else if (analysis.dispersion.status !== 'ready' && gap.status !== 'ready') {
    bag.invitation = gap.invitation ?? analysis.dispersion.invitation;
  }
  if (bag.take) bag.take = bag.take.replace(/ Tap the gap to see what fills it\./g, '');
  if (bag.invitation) bag.invitation = bag.invitation.replace(/ Tap the gap to see what fills it\./g, '');
  if (analysis.dispersion.status === 'ready' && analysis.dispersion.value?.clubs[0]) {
    const club = analysis.dispersion.value.clubs[0];
    bag.rows.push({
      label: `${club.club} landing`,
      detail: club.aimOffsetYds == null ? 'No aim offset yet' : `Aim ${String(Math.abs(club.aimOffsetYds))} ${club.aimOffsetYds < 0 ? 'left' : 'right'}`,
      tone: 'neutral',
    });
  }

  const scoring = analysis.scoringByHoleType;
  const holes = blank(scoring, '4 · SCORING BY HOLE TYPE');
  if (scoring.status === 'ready' && scoring.value) {
    const named = scoring.value.buckets.filter((bucket) => bucket.avgToPar != null);
    const worst = named.find((bucket) => bucket.label === scoring.value?.worst);
    holes.figure = figureOf('ready', worst?.avgToPar ?? named[0]?.avgToPar);
    holes.unit = 'OVER PAR / HOLE';
    holes.rows = scoring.value.buckets.map((bucket) => ({
      label: bucket.label,
      detail: bucket.avgToPar == null ? bucket.invitation ?? '' : String(bucket.avgToPar),
      tone: bucket.avgToPar != null && bucket.avgToPar > 0 ? 'loss' : 'neutral',
    }));
  }

  const pressure = analysis.pressure.status === 'ready' ? analysis.pressure : analysis.backNine;
  const day = blank(pressure, '5 · PRESSURE AND FADE');
  if (analysis.pressure.status !== 'ready') day.invitation = analysis.pressure.invitation;
  if (analysis.backNine.status !== 'ready' && analysis.pressure.status !== 'ready') {
    day.invitation = analysis.backNine.invitation ?? analysis.pressure.invitation;
  }
  if (analysis.backNine.status === 'ready' && analysis.backNine.value) {
    day.figure = analysis.backNine.value.verdict === 'no_meaningful_difference' ? null : figureOf('ready', analysis.backNine.value.meanBackMinusFront);
    day.unit = day.figure == null ? null : 'STROKES, BACK MINUS FRONT';
    day.take = analysis.backNine.take;
    day.rows.push({ label: 'Back nine', detail: analysis.backNine.value.verdict.replaceAll('_', ' '), tone: 'neutral' });
  }
  if (analysis.pressure.status === 'ready' && analysis.pressure.value) {
    day.rows.push({
      label: 'Pressure',
      detail: analysis.pressure.value.verdict.replaceAll('_', ' '),
      tone: analysis.pressure.value.verdict === 'pressure_tax' ? 'loss' : 'neutral',
    });
    if (day.take == null) day.take = analysis.pressure.take;
  }

  const cards = buildCards(analysis);
  const shareSource = cards[0];
  const share: AnalysisPanel = {
    id: 'share',
    eyebrow: '6 · SHARE',
    title: shareSource?.eyebrow ?? 'Share',
    status: shareSource ? 'ready' : 'needs_more',
    sample: shareSource?.sample ?? analysis.meta.sample,
    confidence: shareSource?.confidenceLabel ?? null,
    figure: shareSource?.bigNumber ?? null,
    unit: shareSource?.bigUnit ?? null,
    headline: shareSource?.headline ?? null,
    invitation: shareSource ? null : 'A share card shows up when an insight is ready. Nothing here is filled in.',
    take: shareSource?.take ?? null,
    action: shareSource ? 'Share stays on this phone until you send it yourself.' : null,
    caveat: shareSource?.basis ?? null,
    fixId: null,
    rows: [],
  };

  return [home, loss, bag, holes, day, share];
}

/** The generic line is only for a panel that is actually short of data. */
export function showsNeedsMore(panel: AnalysisPanel): boolean {
  return panel.figure == null && panel.status !== 'ready';
}

export const NEEDS_MORE_LINE = 'Needs more rounds before this number exists.';

/** Share text is the panel's own computed lines. No extra number is added. */
export function shareText(panel: AnalysisPanel): string | null {
  if (panel.id !== 'share') return null;
  if (panel.figure == null && !panel.take && panel.rows.length === 0) return null;
  const lines = [panel.title];
  if (panel.sample) lines.push('SAMPLE');
  if (panel.headline) lines.push(panel.headline);
  if (panel.figure != null) lines.push([panel.figure, panel.unit].filter(Boolean).join(' '));
  if (panel.take) lines.push(panel.take);
  if (panel.caveat) lines.push(panel.caveat);
  for (const row of panel.rows) lines.push(row.detail ? `${row.label}: ${row.detail}` : row.label);
  return lines.join('\n');
}
