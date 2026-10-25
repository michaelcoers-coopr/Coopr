import type { StoredRound } from './from-round';

export interface HomeRoundRow {
  id: string;
  playedOn: string;
  courseName: string;
  gross: number | null;
  toPar: number | null;
  kept: boolean;
}

function scored(strokes: number | null): strokes is number {
  return strokes != null && Number.isFinite(strokes);
}

export function formatToPar(value: number): string {
  if (value === 0) return 'E';
  return value > 0 ? `+${value}` : String(value);
}

export function averageToParLabel(values: readonly number[]): string {
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rounded = Math.round(avg * 10) / 10;
  if (rounded === 0) return 'avg E to par';
  const body = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  return rounded > 0 ? `avg +${body} to par` : `avg -${body} to par`;
}

export function roundRow(round: StoredRound): HomeRoundRow {
  const holes = round.holes.slice(0, 18);
  const kept = round.holes.length >= 18 && holes.every((hole) => scored(hole.strokes));
  const gross = kept ? holes.reduce((sum, hole) => sum + (hole.strokes as number), 0) : null;
  const withPar = kept && holes.every((hole) => hole.par != null);
  const toPar = withPar ? holes.reduce((sum, hole) => sum + ((hole.strokes as number) - (hole.par as number)), 0) : null;
  return { id: round.id, playedOn: round.playedOn, courseName: round.courseName || 'Round', gross, toPar, kept };
}

export interface HomeRoundSummary {
  rows: HomeRoundRow[];
  kept: number;
  last: HomeRoundRow | null;
  lastKept: HomeRoundRow | null;
  /** The sentence under the to-par tile. The play-3 line stays until three scored rounds exist. */
  handicap: string;
  /** Shown on its own when a to-par trend exists. Not an official index. */
  disclaimer: string | null;
  /** Average of the last three to-par scores, only after three scored rounds. Not an official index. */
  trend: string | null;
}

export function homeRoundSummary(rounds: readonly StoredRound[]): HomeRoundSummary {
  const rows = rounds.filter((round) => round.id !== 'open').map(roundRow);
  const keptRows = rows.filter((row) => row.kept);
  const scored = keptRows.filter((row) => row.toPar != null);
  const last = rows.length > 0 ? rows[rows.length - 1]! : null;
  const lastKept = keptRows.length > 0 ? keptRows[keptRows.length - 1]! : null;
  if (scored.length < 3) {
    return { rows, kept: keptRows.length, last, lastKept, handicap: 'Play 3 rounds to see your handicap trend', disclaimer: null, trend: null };
  }
  const recent = scored.slice(-3);
  const bits = recent.map((row) => formatToPar(row.toPar as number));
  return {
    rows,
    kept: keptRows.length,
    last,
    lastKept,
    handicap: `Last 3 rounds ${bits.join(', ')} to par.`,
    disclaimer: 'Not an official handicap.',
    trend: averageToParLabel(recent.map((row) => row.toPar as number)),
  };
}
