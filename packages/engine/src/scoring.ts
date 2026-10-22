export interface HoleStrokes {
  hole: number;
  strokes: number;
}

export interface RoundScore {
  gross: number;
  front: number;
  back: number;
  holesEntered: number;
}

/** Strokes only. Narrative text is not an input and cannot change the result. */
export function scoreRound(holes: readonly HoleStrokes[]): RoundScore {
  const gross = holes.reduce((sum, hole) => sum + hole.strokes, 0);
  const front = holes.filter((hole) => hole.hole >= 1 && hole.hole <= 9).reduce((sum, hole) => sum + hole.strokes, 0);
  const back = holes.filter((hole) => hole.hole >= 10 && hole.hole <= 18).reduce((sum, hole) => sum + hole.strokes, 0);
  return { gross, front, back, holesEntered: holes.length };
}

export function narrateScore(score: RoundScore, text: string): { score: RoundScore; text: string } {
  return { score, text };
}

export function presentHandicap(handicap: { value: number | null; official: boolean }): string {
  if (handicap.value == null) return 'Handicap: unknown';
  if (!handicap.official) {
    return `Estimated handicap ${handicap.value} — not an official GHIN Handicap Index`;
  }
  return `Handicap Index ${handicap.value}`;
}
