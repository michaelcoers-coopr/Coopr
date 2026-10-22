/** Display steps between two real yardages. The last step is the real number. Nothing past it is invented. */
export function rollSteps(from: number, to: number, frames: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const end = Math.round(to);
  if (frames < 2 || Math.round(from) === end) return [end];
  const steps: number[] = [];
  for (let i = 1; i <= frames; i += 1) {
    const t = 1 - (1 - i / frames) ** 3;
    steps.push(Math.round(from + (to - from) * t));
  }
  steps[steps.length - 1] = end;
  return steps;
}

/** Horizontal swipe between holes. A vertical drag is a scroll, not a hole change. */
export function holeSwipe(dx: number, dy: number, hole: number, last = 18): 'next' | 'prev' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return null;
  if (dx < 0 && hole < last) return 'next';
  if (dx > 0 && hole > 1) return 'prev';
  return null;
}
