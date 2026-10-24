/** Lime from the sheet. The glow and the rim use this and nothing else. */
export const SHEET_BALL_LIME = '#8AC926';

export const SHEET_BALL = {
  viewBox: { w: 360, h: 156 },
  ball: { cx: 180, cy: 196, r: 158 },
  spacing: 13,
  dimple: 4.15,
} as const;

/**
 * One hex cell. Corner dimples sit on the tile edge so the next tile completes them.
 * The offset dimple is one spacing away from each corner, which is a hex lattice.
 */
export function hexDimpleSeeds(spacing: number): { x: number; y: number }[] {
  const h = spacing * Math.sqrt(3);
  return [
    { x: 0, y: 0 },
    { x: spacing, y: 0 },
    { x: 0, y: h },
    { x: spacing, y: h },
    { x: spacing / 2, y: h / 2 },
  ];
}

export interface BallMark {
  tag: 'circle' | 'ellipse';
  cx: number;
  cy: number;
  r?: number;
  rx?: number;
  ry?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

/** One dimple: the well, the inner shadow, and the rim highlight. */
export function dimpleMarks(cx: number, cy: number, r: number): BallMark[] {
  return [
    { tag: 'circle', cx, cy, r, fill: '#C9C3B6' },
    { tag: 'circle', cx: cx + r * 0.18, cy: cy + r * 0.22, r: r * 0.78, fill: '#6E685E' },
    { tag: 'circle', cx: cx - r * 0.32, cy: cy - r * 0.34, r: r * 0.3, fill: '#FFFFFF', fillOpacity: 0.92 },
  ];
}

/** Dimple wells, the ball rim, and the glow. The sheet draws these. A render test draws the same list. */
export function sheetBallMarks(): BallMark[] {
  const { ball, spacing, dimple, viewBox } = SHEET_BALL;
  const wells = hexDimpleSeeds(spacing).flatMap((seed) => dimpleMarks(seed.x, seed.y, dimple));
  return [
    { tag: 'ellipse', cx: ball.cx, cy: viewBox.h - 6, rx: 168, ry: 78, fill: SHEET_BALL_LIME },
    { tag: 'circle', cx: ball.cx, cy: ball.cy, r: ball.r - 1.5, fill: 'none', stroke: SHEET_BALL_LIME, strokeOpacity: 0.45, strokeWidth: 2.25 },
    { tag: 'circle', cx: ball.cx, cy: ball.cy, r: ball.r + 2.5, fill: 'none', stroke: SHEET_BALL_LIME, strokeOpacity: 0.18, strokeWidth: 7 },
    ...wells,
  ];
}
