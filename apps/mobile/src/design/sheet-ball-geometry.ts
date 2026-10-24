/** Saturated lime across the bottom of the sheet. */
export const SHEET_BALL_LIME = '#8AC926';

/** Yellow-lime at the two bottom corners. */
export const SHEET_BALL_CREST = '#C6F135';

/** Pale white-lime for the dimple strokes. */
export const SHEET_BALL_LINE = '#F4FBD2';

/** Facing wireframe strokes. They fade toward the limb and the base. */
export const SHEET_BALL_LINE_OPACITY = 0.4;

/** Dark olive inside the cap. Painted translucent so the lime shows through. */
export const SHEET_BALL_INTERIOR = '#122006';
export const SHEET_BALL_INTERIOR_ALPHA = 0.35;

/** Thin rim of the cap. Soft, so it does not cut a line into the lime. */
export const SHEET_BALL_RIM = '#FFFFFF';
export const SHEET_BALL_RIM_OPACITY = 0.4;

/** Dark olive the glow climbs through, then the deeper olive above it. */
export const SHEET_BALL_OLIVE = '#2e4a12';
export const SHEET_BALL_OLIVE_DEEP = '#1c2e0f';

/**
 * Horizontal reach of one corner lobe, about 45% of the sheet.
 * Two of these leave a valley under the cap.
 */
export const SHEET_BALL_LOBE_RADIUS = 162;

/** How far each corner lobe reaches above the sheet bottom. */
export const SHEET_BALL_LIME_BAND = 76;

/** Soft tail of each lobe, so the bulge fades instead of ending in a line. */
export const SHEET_BALL_LIME_FEATHER = 50;

/** Olive lights the lower portion of the sheet, above and behind the lime. */
export const SHEET_BALL_OLIVE_PORTION = 0.45;

/** Minimum olive above the lime band, so a short sheet is not pure black. */
export const SHEET_BALL_OLIVE_LIFT = 56;

/**
 * How far the cap's crown sits above the sheet bottom.
 * The closed card's last line ends about 84px up, so 75px leaves >=8px clear.
 */
export const SHEET_BALL_DOME = 75;

/** Top of the open scroll. Glyphs dissolve here instead of being cut. */
export const SHEET_BALL_SCROLL_FADE = 48;

/**
 * Bottom of the open scroll. Short, so the last full line stays opaque
 * and only the line past it fades.
 */
export const SHEET_BALL_SCROLL_FADE_BOTTOM = 18;

/**
 * Closed: gap under the Course / Coach AI / Stats row.
 * Open: the scroll ends just above the low cap.
 */
export const SHEET_BALL_TEXT = { closedPx: 8, openPx: 72 } as const;

/**
 * Mix used only if type ever shares pixels with the crest.
 * The sheet does not paint this as a full-width band. That band was the seam.
 */
export const SHEET_BALL_SCRIM = '#040A18';

/** Opaque enough that white type on the crest still clears 7:1. */
export const SHEET_BALL_SCRIM_ALPHA = 0.72;

/** Kept so a future text scrim stays under the old open-scroll budget. */
export const SHEET_BALL_SCRIM_TOP = 128;

/** Dimple and rim hairline. One pixel reads at 1x. */
export const SHEET_BALL_STROKE = 1;
export const SHEET_BALL_RIM_WIDTH = 1;

const BALL_VIEW_H = 800;
const BALL_R = 260;
const BALL_DROP = BALL_R - SHEET_BALL_DOME;

export const SHEET_BALL = {
  viewBox: { w: 360, h: BALL_VIEW_H },
  /**
   * Center sits below the sheet. Radius 260, so the cap is wider than the
   * sheet and the top of the circle crosses it as a rim.
   */
  ball: { cx: 180, cy: BALL_VIEW_H + BALL_DROP, r: BALL_R },
  /** Center spacing of a hex cell. Diameter plus about a 2px gap. */
  spacing: 20,
  /** Half-width of a facing cell. 18px across, so neighbors do not touch. */
  dimple: 9,
} as const;

/** Glint just under the crown, inside the cap. */
export const SHEET_BALL_SPECULAR = { cx: 180, cy: BALL_VIEW_H - SHEET_BALL_DOME + 20, rx: 48, ry: 12 } as const;

/** How far the cap's crown sits above the sheet bottom. */
export function ballCrownFromBottom(): number {
  const { viewBox, ball } = SHEET_BALL;
  return viewBox.h - (ball.cy - ball.r);
}

/** Chord of the sphere at the sheet bottom. Wider than the sheet. */
export function ballChordWidth(): number {
  const { viewBox, ball } = SHEET_BALL;
  const drop = ball.cy - viewBox.h;
  return 2 * Math.sqrt(ball.r * ball.r - drop * drop);
}

/** Olive layer height for a sheet of `sheetHeight` px. */
export function oliveHeight(sheetHeight: number): number {
  return Math.max(Math.round(sheetHeight * SHEET_BALL_OLIVE_PORTION), SHEET_BALL_LIME_BAND + SHEET_BALL_OLIVE_LIFT);
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
  /** Degrees. The minor axis follows the radial direction. */
  rotation: number;
  opacity: number;
  /** Latitude, so a test can check that one ring bows. */
  lat: number;
}

/**
 * Three rows of dimple outlines on the cap.
 * Centers sit on a hex lattice in the sheet, with a gap between cells.
 * Cells toward the limb squash and fade. Cells toward the base fade.
 */
export function projectedDimples(): ProjectedDimple[] {
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const { cx, cy, r } = ball;
  const bottom = viewBox.h;
  const pitch = spacing * 0.8660254;
  const marks: ProjectedDimple[] = [];
  for (let row = 0; row < 3; row += 1) {
    const sy = bottom - SHEET_BALL_DOME + dimple + 6 + row * pitch;
    const stagger = row % 2 === 0 ? 0 : spacing / 2;
    for (let i = -14; i <= 14; i += 1) {
      const sx = cx + stagger + i * spacing;
      if (sx < -8 || sx > viewBox.w + 8) continue;
      const dx = sx - cx;
      const dy = sy - cy;
      if (dx * dx + dy * dy > (r - 4) * (r - 4)) continue;
      if (sy > bottom - dimple) continue;
      const across = Math.min(1, Math.abs(sx - cx) / (viewBox.w * 0.48));
      const squash = Math.max(0.4, 1 - across * across * 0.62);
      const rise = (bottom - sy) / SHEET_BALL_DOME;
      const base = rise < 0.5 ? rise / 0.5 : 1;
      const opacity = SHEET_BALL_LINE_OPACITY * (0.35 + 0.65 * squash) * base;
      if (opacity < 0.08) continue;
      const radial = Math.atan2(sy - cy, sx - cx);
      marks.push({
        cx: sx,
        cy: sy,
        rx: dimple,
        ry: dimple * squash,
        rotation: (radial * 180) / Math.PI - 90,
        opacity,
        lat: row,
      });
    }
  }
  return marks;
}

/**
 * Lime body, corner crests, the rim, and the projected dimples.
 * The sheet draws the same shapes. A render test draws this list.
 */
export function sheetBallMarks(): BallMark[] {
  const { viewBox, ball } = SHEET_BALL;
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
    {
      tag: 'circle',
      cx: ball.cx,
      cy: ball.cy,
      r: ball.r,
      fill: SHEET_BALL_INTERIOR,
      fillOpacity: SHEET_BALL_INTERIOR_ALPHA,
    },
    { tag: 'ellipse', cx: viewBox.w / 2, cy: viewBox.h - 40, rx: viewBox.w / 2, ry: 70, fill: SHEET_BALL_OLIVE_DEEP },
    { tag: 'ellipse', cx: viewBox.w / 2, cy: viewBox.h - 24, rx: viewBox.w / 2 + 8, ry: 56, fill: SHEET_BALL_OLIVE },
    { tag: 'ellipse', cx: viewBox.w / 2, cy: viewBox.h, rx: viewBox.w / 2 + 4, ry: 48, fill: SHEET_BALL_LIME },
    { tag: 'ellipse', cx: 28, cy: viewBox.h - 4, rx: 120, ry: 70, fill: SHEET_BALL_CREST },
    { tag: 'ellipse', cx: viewBox.w - 28, cy: viewBox.h - 4, rx: 120, ry: 70, fill: SHEET_BALL_CREST },
    {
      tag: 'circle',
      cx: ball.cx,
      cy: ball.cy,
      r: ball.r,
      fill: 'none',
      stroke: SHEET_BALL_RIM,
      strokeWidth: SHEET_BALL_RIM_WIDTH,
      strokeOpacity: SHEET_BALL_RIM_OPACITY,
    },
    {
      tag: 'ellipse',
      cx: SHEET_BALL_SPECULAR.cx,
      cy: SHEET_BALL_SPECULAR.cy,
      rx: SHEET_BALL_SPECULAR.rx,
      ry: SHEET_BALL_SPECULAR.ry,
      fill: SHEET_BALL_RIM,
      fillOpacity: 0.85,
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
