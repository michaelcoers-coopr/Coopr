/** Saturated lime across the bottom of the sheet. */
export const SHEET_BALL_LIME = '#8AC926';

/** Yellow-lime at the two bottom corners. */
export const SHEET_BALL_CREST = '#C6F135';

/** Pale white-lime for the dimple strokes. */
export const SHEET_BALL_LINE = '#F4FBD2';

/** Facing wireframe strokes. They fade toward the limb and the base. */
export const SHEET_BALL_LINE_OPACITY = 0.55;

/** Dark olive inside the cap, so the lime reads as light behind it. */
export const SHEET_BALL_INTERIOR = '#122006';

/** Thin rim of the cap. A visible circular silhouette. */
export const SHEET_BALL_RIM = '#FFFFFF';
export const SHEET_BALL_RIM_OPACITY = 0.75;

/** Dark olive the glow climbs through, then the deeper olive above it. */
export const SHEET_BALL_OLIVE = '#2e4a12';
export const SHEET_BALL_OLIVE_DEEP = '#1c2e0f';

/**
 * Corner-lobe radius in the lime band's viewBox.
 * Two lobes this size do not meet, so the middle stays the lime body.
 */
/**
 * Corner-lobe radius. The two lobes fade out before they meet,
 * so the middle stays the darker valley under the cap.
 */
export const SHEET_BALL_LOBE_RADIUS = 148;

/** How far each corner lobe reaches above the sheet bottom. */
export const SHEET_BALL_LIME_BAND = 68;

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
  /** Center spacing of a hex cell, in px on the face. */
  spacing: 22,
  /** Half-width of a facing cell. About 22px across. */
  dimple: 11,
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
 * Large dimple outlines on the visible cap.
 * Orthographic projection of a sphere:
 *   x = R cos(lat) sin(lon)
 *   y = R sin(lat)
 *   z = R cos(lat) cos(lon)
 * Rows are hex-packed. A tilt about X bows each parallel.
 * The minor axis points at the sphere center and shortens toward the limb.
 */
export function projectedDimples(): ProjectedDimple[] {
  const { viewBox, ball, spacing, dimple } = SHEET_BALL;
  const { cx, cy, r } = ball;
  const bottom = viewBox.h;
  const tau = (46 * Math.PI) / 180;
  const cosT = Math.cos(tau);
  const sinT = Math.sin(tau);
  const marks: ProjectedDimple[] = [];
  const rowPitch = spacing * 0.866;
  let row = 0;
  for (let phi = -0.15; phi <= 1.5; phi += rowPitch / r) {
    const cosP = Math.max(0.22, Math.abs(Math.cos(phi)));
    const dLam = spacing / (r * cosP);
    const stagger = row % 2 === 0 ? 0 : dLam * 0.5;
    row += 1;
    for (let lam = -Math.PI + stagger; lam <= Math.PI; lam += dLam) {
      const x = Math.cos(phi) * Math.sin(lam);
      const y = Math.sin(phi);
      const z = Math.cos(phi) * Math.cos(lam);
      const y2 = y * cosT - z * sinT;
      const z2 = y * sinT + z * cosT;
      if (z2 < 0.04) continue;
      const sx = cx + r * x;
      const sy = cy - r * y2;
      if (sy < bottom - SHEET_BALL_DOME + 2 || sy > bottom - 4) continue;
      if (sx < -20 || sx > viewBox.w + 20) continue;
      const across = Math.min(1, Math.abs(sx - cx) / (viewBox.w * 0.52));
      const squash = Math.max(0.34, 1 - across * across * 0.72);
      const rise = (bottom - sy) / SHEET_BALL_DOME;
      const base = rise < 0.24 ? rise / 0.24 : 1;
      const opacity = SHEET_BALL_LINE_OPACITY * (0.34 + 0.66 * squash) * base;
      const rx = dimple * (0.84 + 0.16 * squash);
      const ry = dimple * squash * (0.78 + 0.22 * Math.min(1, z2 / 0.4));
      if (opacity < 0.08 || ry < 2.2) continue;
      const radial = Math.atan2(sy - cy, sx - cx);
      marks.push({
        cx: sx,
        cy: sy,
        rx,
        ry,
        rotation: (radial * 180) / Math.PI - 90,
        opacity,
        lat: phi,
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
    { tag: 'circle', cx: ball.cx, cy: ball.cy, r: ball.r, fill: SHEET_BALL_INTERIOR },
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
