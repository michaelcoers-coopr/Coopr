/** Saturated lime. The dome body is this, and the crest shifts toward SHEET_BALL_CREST. */
export const SHEET_BALL_LIME = '#8AC926';

/** Yellow-lime at the crest of the hill. */
export const SHEET_BALL_CREST = '#C6F135';

/** Hairline dimples and the ball rim. Line art, not a filled photo. */
export const SHEET_BALL_LINE = '#FFFFFF';

/**
 * White dimple strokes at the facing part of the cap.
 * The limb and the cropped base fade below this. Kept inside 35–45%.
 */
export const SHEET_BALL_LINE_OPACITY = 0.42;

/** Dark olive the glow climbs through before it becomes lime. It lights the sheet. */
export const SHEET_BALL_OLIVE = '#3F6218';

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
 * Closed: gap under the Course / Coach AI / Stats row, so the club line never
 * shares pixels with the tabs. Open: the scroll stops above the bright hill
 * and above the short scrim, so a line is not cut in half.
 */
export const SHEET_BALL_TEXT = { closedPx: 8, openPx: 120 } as const;

/** Dark scrim behind the type that shares pixels with the feather. */
export const SHEET_BALL_SCRIM = '#040A18';

/** Opaque enough that white type on the crest still clears 7:1. */
export const SHEET_BALL_SCRIM_ALPHA = 0.75;

/**
 * Short scrim, measured from the sheet bottom up to its top edge.
 * It backs the closed card's lowest rows. The open scroll stops above it.
 */
export const SHEET_BALL_SCRIM_TOP = 110;
export const SHEET_BALL_SCRIM_HEIGHT = 58;

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
 * Radial hill, wider than the sheet, centered low.
 * The transparent edge of this ellipse is outside the corners, so the
 * visible contour is a curve that feathers out instead of a vertical cut.
 */
export const SHEET_BALL_GLOW_ELLIPSE = {
  cx: 180,
  cy: SHEET_BALL_STAGE - 16,
  rx: 220,
  ry: 118,
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

export interface ProjectedDimple {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
}

/**
 * Dimple outlines on the visible cap.
 * A hex lattice on the sphere is projected toward the camera: rows shorten
 * toward the limb, each ring squashes along the surface tilt, and the stroke
 * fades toward the silhouette and the cropped base.
 */
export function projectedDimples(): ProjectedDimple[] {
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const { cx, cy, r } = ball;
  const marks: ProjectedDimple[] = [];
  const rowStep = (spacing * Math.sqrt(3)) / 2;
  const vMax = r - spacing * 0.7;
  const vMin = cy - viewBox.h + 6;
  let row = 0;
  for (let v = vMax; v > vMin; v -= rowStep) {
    const shift = row % 2 === 0 ? 0 : spacing / 2;
    const reach = Math.sqrt(Math.max(0, r * r - v * v));
    for (let u = -reach; u <= reach + 0.01; u += spacing) {
      const uu = u + shift;
      const planar = uu * uu + v * v;
      if (planar >= r * r * 0.985) continue;
      const w = Math.sqrt(r * r - planar);
      const nz = w / r;
      const nx = Math.abs(uu) / r;
      const ny = Math.abs(v) / r;
      if (nz < 0.2) continue;
      const screenY = cy - v;
      if (screenY < 6 || screenY > viewBox.h - 1) continue;
      const shrink = 0.42 + 0.58 * nz;
      const rx = dimple * shrink * Math.max(0.34, Math.sqrt(nz * nz + ny * ny));
      const ry = dimple * shrink * Math.max(0.28, Math.sqrt(nz * nz + nx * nx));
      const facing = Math.min(1, nz / 0.58);
      const base = screenY > viewBox.h - 20 ? Math.max(0, (viewBox.h - screenY) / 20) : 1;
      const opacity = SHEET_BALL_LINE_OPACITY * facing * base;
      if (opacity < 0.08 || rx < 0.5 || ry < 0.4) continue;
      marks.push({ cx: cx + uu, cy: screenY, rx, ry, opacity });
    }
    row += 1;
    if (row > 20) break;
  }
  return marks;
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
  const glow = SHEET_BALL_GLOW_ELLIPSE;
  const dimples = projectedDimples().map((dimple) => ({
    tag: 'ellipse' as const,
    cx: dimple.cx,
    cy: dimple.cy,
    rx: dimple.rx,
    ry: dimple.ry,
    fill: 'none',
    stroke: SHEET_BALL_LINE,
    strokeWidth: SHEET_BALL_STROKE,
    strokeOpacity: dimple.opacity,
  }));
  return [
    { tag: 'ellipse', cx: glow.cx, cy: glow.cy, rx: glow.rx, ry: glow.ry, fill: SHEET_BALL_LIME },
    {
      tag: 'ellipse',
      cx: glow.cx,
      cy: glow.cy - 36,
      rx: 90,
      ry: 28,
      fill: SHEET_BALL_CREST,
    },
    {
      tag: 'ellipse',
      cx: SHEET_BALL_SPECULAR.cx,
      cy: SHEET_BALL_SPECULAR.cy,
      rx: SHEET_BALL_SPECULAR.rx,
      ry: SHEET_BALL_SPECULAR.ry,
      fill: SHEET_BALL_LINE,
      fillOpacity: 0.8,
    },
    ...dimples,
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
