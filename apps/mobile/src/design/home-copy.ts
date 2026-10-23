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

/** A line from a real Open-Meteo reading. Null when the feed has not arrived. */
export function skyLine(input: { temperatureF: number; windMph: number; headwindMph: number | null } | null): string | null {
  if (!input || !Number.isFinite(input.temperatureF) || !Number.isFinite(input.windMph)) return null;
  const base = `${Math.round(input.temperatureF)}° · Wind ${Math.round(input.windMph)} mph`;
  if (input.headwindMph == null || !Number.isFinite(input.headwindMph)) return base;
  const face = Math.round(input.headwindMph);
  if (face > 0) return `${base} · ${face} in your face`;
  if (face < 0) return `${base} · ${Math.abs(face)} helping`;
  return `${base} · across`;
}
