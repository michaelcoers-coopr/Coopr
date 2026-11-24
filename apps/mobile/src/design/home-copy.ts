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

/**
 * Course pill on Home. The tee name lives on the sheet row.
 * The pill is one line beside the crest, so it does not repeat the tees.
 */
export function coursePill(input: { course: string; hole: number; par: number | null }): string {
  const course = input.course.trim();
  const hole = Number.isFinite(input.hole) ? Math.round(input.hole) : 1;
  const parts = [course.toUpperCase(), `Hole ${hole}`];
  if (input.par != null && Number.isFinite(input.par)) parts.push(`Par ${Math.round(input.par)}`);
  return parts.join(' · ');
}

/** The card under the hero. Par is omitted when the card does not have one. */
export function holeSubline(input: { hole: number; par: number | null; tee?: string }): string {
  const tee = input.tee?.trim() || 'White tees';
  const hole = Number.isFinite(input.hole) ? Math.round(input.hole) : 1;
  const par = input.par != null && Number.isFinite(input.par) ? ` · Par ${Math.round(input.par)}` : '';
  return `${tee} · Hole ${hole}${par}`;
}

/** Home card. A blank round is an invitation. A started round resumes. Handicap is never filled in. */
export function resumeLine(input: { hole: number; holesEntered: number; gross: number | null; par?: number | null }): { title: string; detail: string } {
  if (input.holesEntered <= 0) {
    return { title: 'Play High Cedars', detail: holeSubline({ hole: input.hole, par: input.par ?? null }) };
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
