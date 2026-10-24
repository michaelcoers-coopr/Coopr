/** Lime from the sheet. The glow and the dimple edges use this and nothing else. */
export const SHEET_BALL_LIME = '#8AC926';

/** Dark green-black. White type on these fills stays above AA. */
export const SHEET_BALL_BODY = '#0C1410';
export const SHEET_BALL_BODY_LIT = '#14201A';
export const SHEET_BALL_BODY_EDGE = '#080E0B';
export const SHEET_BALL_WELL = '#1A2620';
export const SHEET_BALL_SHADOW = '#060908';

/**
 * Absolute stage. It does not add to the sheet height.
 * The viewBox matches this height so the art is not letterboxed inside a taller box.
 */
export const SHEET_BALL_STAGE = 48;

/**
 * Lowest resting ink, in px from the sheet bottom.
 * Closed coach stack, one line each, mic row included:
 * 12 + 18 + 16 + 18 + 17 + 18 + 28 = 127, and 176 - 127 = 49.
 * A second line on the pattern sentence still leaves the mic glyphs above the paint.
 * Open details use paddingBottom 36, and the scroll itself stops above the paint
 * so a line in the middle of the list cannot sit on the glow.
 */
export const SHEET_BALL_TEXT = { closedPx: 49, openPx: 36 } as const;

/** Bright paint lives in this many px at the bottom, under both text lines. */
export const SHEET_BALL_PAINT_TOP = 28;

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
  /** Large ball, center below the view, so only a shallow cap shows. */
  ball: { cx: 180, cy: 934, r: 900 },
  spacing: 7,
  dimple: 2.35,
} as const;

/**
 * Wide lime pool behind the cap. Its top is an ellipse, under the type.
 * The radial fill reaches opacity 0 inside this shape, so the edge is not a line.
 */
export const SHEET_BALL_GLOW_ELLIPSE = { cx: 180, cy: 52, rx: 240, ry: 32 } as const;

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
