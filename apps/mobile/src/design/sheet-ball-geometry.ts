/** Saturated lime. The dome body is this, and the crest shifts toward SHEET_BALL_CREST. */
export const SHEET_BALL_LIME = '#8AC926';

/** Yellow-lime at the crest of the hill. */
export const SHEET_BALL_CREST = '#C6F135';

/** Hairline dimples and the ball rim. Line art, not a filled photo. */
export const SHEET_BALL_LINE = '#FFFFFF';

/**
 * White dimple strokes. Kept inside 35–55% so the lime shows through the lines.
 */
export const SHEET_BALL_LINE_OPACITY = 0.45;

/**
 * How the glow composites over the dark glass.
 * Screen keeps a low-opacity feather lime, instead of sinking into olive.
 */
export const SHEET_BALL_GLOW_BLEND = 'screen' as const;

/**
 * Solid hill, in px from the sheet bottom.
 * The crest is the brightest point. The ball's visible cap matches this height.
 */
export const SHEET_BALL_DOME = 84;

/** Soft spill above the crest, fading to nothing. */
export const SHEET_BALL_FEATHER = 30;

/**
 * Absolute stage. It does not add to the sheet height.
 * Dome plus the feather above it. The closed sheet stays 176.
 */
export const SHEET_BALL_STAGE = SHEET_BALL_DOME + SHEET_BALL_FEATHER;

/**
 * Closed: the mic and the caddie line sit this far above the sheet bottom,
 * just over the vivid hill. Open: scrolled details stop above the dome.
 * The feather may still spill under those rows; the scrim keeps the type.
 */
export const SHEET_BALL_TEXT = { closedPx: 68, openPx: SHEET_BALL_DOME } as const;

/** Dark scrim behind the type that shares pixels with the feather. */
export const SHEET_BALL_SCRIM = '#040A18';

/** Opaque enough that white type on the crest still clears 7:1. */
export const SHEET_BALL_SCRIM_ALPHA = 0.9;

/** Hairline. One viewBox unit, so a 3x screen draws a 3px stroke. */
export const SHEET_BALL_STROKE = 1;

export const SHEET_BALL = {
  viewBox: { w: 360, h: SHEET_BALL_STAGE },
  /**
   * Center sits below the view. The crown is `stage - (cy - r)` = the dome,
   * so only the top of the ball shows and the bottom edge crops it.
   */
  ball: { cx: 180, cy: SHEET_BALL_FEATHER + 230, r: 230 },
  spacing: 10,
  dimple: 3.4,
} as const;

/**
 * Hill sitting on the sheet's bottom edge. The top of the ellipse is the crest.
 * The radial hot spot and the feather live above that line.
 */
export const SHEET_BALL_GLOW_ELLIPSE = {
  cx: 180,
  cy: SHEET_BALL_STAGE,
  rx: 300,
  ry: SHEET_BALL_DOME,
} as const;

/**
 * Specular on the visible cap, just below the type.
 * The geometric crest is higher and sits under the scrim.
 */
export const SHEET_BALL_SPECULAR = { cx: 180, cy: SHEET_BALL_FEATHER + 28, rx: 36, ry: 10 } as const;

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

/** One dimple: a hairline circle, no fill. The lime glow is the ball's color. */
export function dimpleMarks(cx: number, cy: number, r: number): BallMark[] {
  return [
    {
      tag: 'circle',
      cx,
      cy,
      r,
      fill: 'none',
      stroke: SHEET_BALL_LINE,
      strokeWidth: SHEET_BALL_STROKE,
      strokeOpacity: SHEET_BALL_LINE_OPACITY,
    },
  ];
}

/**
 * Glow hill, the cropped ball rim, a crest highlight, and the dimple seeds.
 * The sheet draws the same shapes. A render test draws this list.
 */
export function sheetBallMarks(): BallMark[] {
  const { ball, spacing, dimple } = SHEET_BALL;
  const glow = SHEET_BALL_GLOW_ELLIPSE;
  const wells = hexDimpleSeeds(spacing).flatMap((seed) => dimpleMarks(seed.x, seed.y, dimple));
  return [
    { tag: 'ellipse', cx: glow.cx, cy: glow.cy, rx: glow.rx, ry: glow.ry, fill: SHEET_BALL_LIME },
    {
      tag: 'ellipse',
      cx: SHEET_BALL_SPECULAR.cx,
      cy: SHEET_BALL_FEATHER,
      rx: 120,
      ry: SHEET_BALL_FEATHER,
      fill: SHEET_BALL_CREST,
    },
    {
      tag: 'circle',
      cx: ball.cx,
      cy: ball.cy,
      r: ball.r,
      fill: 'none',
      stroke: SHEET_BALL_LINE,
      strokeWidth: SHEET_BALL_STROKE,
      strokeOpacity: SHEET_BALL_LINE_OPACITY,
    },
    {
      tag: 'ellipse',
      cx: SHEET_BALL_SPECULAR.cx,
      cy: SHEET_BALL_SPECULAR.cy,
      rx: SHEET_BALL_SPECULAR.rx,
      ry: SHEET_BALL_SPECULAR.ry,
      fill: SHEET_BALL_LINE,
      fillOpacity: 0.85,
    },
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
