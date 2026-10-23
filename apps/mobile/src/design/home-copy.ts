/** The open course record spells the club out. The phone already calls it High Cedars. */
export function courseCall(name: string): string {
  const trimmed = name.trim();
  if (/high cedars/i.test(trimmed)) return 'High Cedars';
  return trimmed.replace(/\s+golf club$/i, '').trim();
}

/**
 * Home hero. The first name and the course come from the phone.
 * A missing name or course is left out. Nothing is filled in.
 */
export function hypeHero(input: { name: string; course: string }): string {
  const course = courseCall(input.course);
  const first = input.name.trim().split(/\s+/)[0] ?? '';
  if (course && first) return `Let's go, ${first}. ${course} is waiting.`;
  if (course) return `${course} is waiting.`;
  if (first) return `Let's go, ${first}.`;
  return "Let's go.";
}

export const TEE_IT_UP = 'TEE IT UP';

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
