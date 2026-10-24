/** Lime from the sheet. The glow and the dimple edges use this and nothing else. */
export const SHEET_BALL_LIME = '#8AC926';

/**
 * Dark green, light enough that the cap separates from the glass.
 * White type on these fills stays above AA.
 */
export const SHEET_BALL_BODY = '#173024';
export const SHEET_BALL_BODY_LIT = '#2C4A38';
export const SHEET_BALL_BODY_EDGE = '#102018';
export const SHEET_BALL_WELL = '#07140E';
export const SHEET_BALL_SHADOW = '#040C08';

/**
 * Absolute stage. It does not add to the sheet height.
 * The viewBox matches this height so the art is not letterboxed inside a taller box.
 * The closed sheet stays 176. The coach stack is tightened so this cap fits under the type.
 */
export const SHEET_BALL_STAGE = 70;

/**
 * Lowest resting ink, in px from the sheet bottom.
 * Closed coach stack, sentence wrapped to two lines:
 * 6 + 14 + 14 + 14 + 30 + 15 + 18 = 111, and 176 - 111 = 65.
 * The crown sits under that. Open details stop above the same line.
 */
export const SHEET_BALL_TEXT = { closedPx: 62, openPx: 62 } as const;

/** Bright lime lives in this many px at the bottom, on the rim, under the type. */
export const SHEET_BALL_PAINT_TOP = 30;

/** ViewBox y. Bright paint stays below this line. */
export const SHEET_BALL_CLEAR_Y = SHEET_BALL_STAGE - SHEET_BALL_PAINT_TOP;

/**
 * Lime that can share a pixel with type stays at or under this opacity.
 * Brighter lime is only used inside the paint strip, below the text.
 */
export const SHEET_BALL_LIME_ON_TYPE = 0.48;

/** Peak of the radial glow at the bottom edge. It sits below the text. */
export const SHEET_BALL_GLOW_PEAK = 0.92;

export const SHEET_BALL = {
  viewBox: { w: 360, h: SHEET_BALL_STAGE },
  /**
   * Center sits below the view. The crown is `stage - (cy - r)` = 58px,
   * inside the 55–70px cap, with enough curve that the dimples read.
   */
  ball: { cx: 180, cy: 160, r: 148 },
  spacing: 16,
  dimple: 5.6,
} as const;

/**
 * Lime pool along the lower rim. Its top stays inside the paint strip.
 * The radial fill reaches opacity 0 inside this shape, so the edge is not a line.
 */
export const SHEET_BALL_GLOW_ELLIPSE = { cx: 180, cy: 80, rx: 250, ry: 40 } as const;

/** How far the cap's crown sits above the sheet bottom. */
export function ballCrownFromBottom(): number {
  const { viewBox, ball } = SHEET_BALL;
  return viewBox.h - (ball.cy - ball.r);
}

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

/** One dimple: a dark well, an inner shadow, and a lime catch on the rim. */
export function dimpleMarks(cx: number, cy: number, r: number): BallMark[] {
  return [
    { tag: 'circle', cx, cy, r, fill: SHEET_BALL_WELL },
    { tag: 'circle', cx: cx + r * 0.2, cy: cy + r * 0.24, r: r * 0.76, fill: SHEET_BALL_SHADOW },
    {
      tag: 'circle',
      cx: cx - r * 0.28,
      cy: cy - r * 0.32,
      r: r * 0.55,
      fill: SHEET_BALL_LIME,
      fillOpacity: SHEET_BALL_LIME_ON_TYPE,
    },
  ];
}

/** Dimple wells, the ball rim, and the glow. The sheet draws these. A render test draws the same list. */
export function sheetBallMarks(): BallMark[] {
  const { ball, spacing, dimple, viewBox } = SHEET_BALL;
  const wells = hexDimpleSeeds(spacing).flatMap((seed) => dimpleMarks(seed.x, seed.y, dimple));
  return [
    { tag: 'ellipse', cx: ball.cx, cy: viewBox.h - 4, rx: 176, ry: 36, fill: SHEET_BALL_LIME },
    { tag: 'circle', cx: ball.cx, cy: ball.cy, r: ball.r - 1.2, fill: 'none', stroke: SHEET_BALL_LIME, strokeOpacity: 0.7, strokeWidth: 2.4 },
    { tag: 'circle', cx: ball.cx, cy: ball.cy, r: ball.r + 3, fill: 'none', stroke: SHEET_BALL_LIME, strokeOpacity: 0.28, strokeWidth: 8 },
    ...wells,
  ];
}

function srgbChannel(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = hex.replace('#', '');
  const rgb = [0, 2, 4].map((index) => srgbChannel(parseInt(n.slice(index, index + 2), 16)));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

/** WCAG contrast. The lighter color is the foreground when type is white. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function mixHex(over: string, under: string, alpha: number): string {
  const parse = (hex: string) => [0, 2, 4].map((index) => parseInt(hex.replace('#', '').slice(index, index + 2), 16));
  const top = parse(over);
  const bottom = parse(under);
  const rgb = top.map((channel, index) => Math.round(channel * alpha + bottom[index]! * (1 - alpha)));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
