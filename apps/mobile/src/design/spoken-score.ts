/**
 * A spoken or typed score. Only a whole phrase counts, so a caddie question
 * that mentions par is not saved as a score.
 */
export function spokenStrokes(phrase: string, par: number): number | null {
  const text = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text || !Number.isFinite(par)) return null;
  const holePar = Math.round(par);
  if (text === 'par') return holePar;
  if (text === 'birdie') return Math.max(1, holePar - 1);
  if (text === 'bogey' || text === 'bogie') return holePar + 1;
  if (text === 'double bogey' || text === 'double bogie') return holePar + 2;
  if (!/^\d{1,2}$/.test(text)) return null;
  const strokes = Number(text);
  if (strokes < 1 || strokes > 20) return null;
  return strokes;
}

export function spokenConfirm(phrase: string, par: number): string | null {
  const strokes = spokenStrokes(phrase, par);
  if (strokes == null) return null;
  return `Save ${strokes}?`;
}
