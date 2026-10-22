/** Home card. A blank round is an invitation. A started round resumes. Handicap is never filled in. */
export function resumeLine(input: { hole: number; holesEntered: number; gross: number | null }): { title: string; detail: string } {
  if (input.holesEntered <= 0) {
    return { title: 'Play High Cedars', detail: 'White tees. Hole 1 is waiting.' };
  }
  return {
    title: `Resume hole ${input.hole}`,
    detail: input.gross == null ? 'Gross —' : `Gross ${input.gross}`,
  };
}

export function bagGlance(inPlay: number): string {
  return `${inPlay} of 14`;
}
