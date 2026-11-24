/** Hole order for a shotgun. Hole 10 plays 10 through 18, then 1 through 9. */
export function shotgunOrder(start: number | null): number[] {
  const first = start != null && start >= 1 && start <= 18 ? Math.trunc(start) : 1;
  return Array.from({ length: 18 }, (_, index) => ((first - 1 + index) % 18) + 1);
}

/** The next hole in the shotgun, or null when the loop is complete. */
export function nextShotgunHole(current: number, start: number | null, dir: 'next' | 'prev'): number | null {
  const order = shotgunOrder(start);
  const index = order.indexOf(current);
  if (index < 0) return order[0] ?? 1;
  if (dir === 'next') return index >= order.length - 1 ? null : order[index + 1] ?? null;
  return index <= 0 ? null : order[index - 1] ?? null;
}

export function unscoredHoles(scores: readonly (number | null)[], start: number | null): number[] {
  return shotgunOrder(start).filter((hole) => scores[hole - 1] == null);
}

export function finishBlocked(scores: readonly (number | null)[], start: number | null): { ok: true } | { ok: false; open: number[] } {
  const open = unscoredHoles(scores, start);
  if (open.length === 0) return { ok: true };
  return { ok: false, open };
}

export function viewerScoreMessage(scorerName: string): string {
  const name = scorerName.trim() || 'the scorer';
  return `Only ${name} can post scores`;
}

export function mulliganRejectedMessage(max: number, scope: 'team' | 'player'): string {
  if (scope === 'player') return `That player has used ${max} mulligans.`;
  return `This team has used its ${max} mulligans.`;
}
