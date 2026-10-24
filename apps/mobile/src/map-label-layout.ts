import type { LabelBox } from '@coopr/engine';

/** Minimum space between any two map labels, in points. */
export const LABEL_GAP = 6;

/** Green front, center, and back. White diameter in points. The outline sits outside it. */
export const GREEN_DOT = 4;

/** Dark ring around each green dot, in points. */
export const DOT_STROKE = 1;

/** A pill farther than this from its point is dropped. The panel still shows the number. */
export const LEADER_MAX = 28;

const OVAL_FLOOR = 14;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PlacedMapLabel {
  id: string;
  text: string;
  kind: 'pill';
  box: LabelBox;
  /** Text anchor. A pill baseline, or the center of a letter. */
  at: ScreenPoint;
  /** The measured point this label belongs to. */
  anchor: ScreenPoint;
  /** Draw a short line from the point to the pill. */
  leader: boolean;
}

export interface GreenDot {
  id: 'front' | 'center' | 'back';
  at: ScreenPoint;
}

export interface HoleLabelLayout {
  labels: PlacedMapLabel[];
  dots: GreenDot[];
}

export interface HoleLabelLayoutInput {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  line: readonly ScreenPoint[];
  front: ScreenPoint | null;
  center: ScreenPoint | null;
  back: ScreenPoint | null;
  greenPoints: readonly ScreenPoint[];
  /** Projected dispersion ring. The plays pill stays off its glow. */
  ellipsePoints?: readonly ScreenPoint[];
  labels: readonly { text: string; at: ScreenPoint }[];
}

interface Axis {
  dir: ScreenPoint;
  perp: ScreenPoint;
}

/** True when `gap` points of air sit between the two rectangles. */
export function boxesSeparated(a: LabelBox, b: LabelBox, gap = LABEL_GAP): boolean {
  return a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y;
}

function contains(rect: LabelBox, box: LabelBox): boolean {
  return box.x >= rect.x - 0.5 && box.y >= rect.y - 0.5 && box.x + box.w <= rect.x + rect.w + 0.5 && box.y + box.h <= rect.y + rect.h + 0.5;
}

export function insideEllipse(point: ScreenPoint, cx: number, cy: number, halfW: number, halfH: number): boolean {
  const dx = (point.x - cx) / Math.max(halfW, 0.5);
  const dy = (point.y - cy) / Math.max(halfH, 0.5);
  return dx * dx + dy * dy <= 1;
}

export function ellipseEdge(from: ScreenPoint, cx: number, cy: number, halfW: number, halfH: number): ScreenPoint {
  const vx = from.x - cx;
  const vy = from.y - cy;
  const denom = Math.hypot(vx / Math.max(halfW, 0.5), vy / Math.max(halfH, 0.5));
  if (!Number.isFinite(denom) || denom === 0) return { x: cx, y: cy };
  const t = 1 / denom;
  return { x: cx + vx * t, y: cy + vy * t };
}

/** Stop a polyline where it enters the oval so the arc does not paint across the pattern. */
export function clipPolylineAtOval(points: readonly ScreenPoint[], cx: number, cy: number, halfW: number, halfH: number): ScreenPoint[] {
  const out: ScreenPoint[] = [];
  for (const point of points) {
    if (insideEllipse(point, cx, cy, halfW, halfH)) {
      const prev = out[out.length - 1];
      if (prev) out.push(ellipseEdge(prev, cx, cy, halfW, halfH));
      break;
    }
    out.push(point);
  }
  return out;
}

/** True-scale oval. A pattern smaller than the floor is drawn larger. */
export function fittedEllipse(points: readonly ScreenPoint[]): { cx: number; cy: number; halfW: number; halfH: number; scale: number } | null {
  if (points.length < 3) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const short = Math.max(Math.min(maxX - minX, maxY - minY), 0.5);
  const scale = short < OVAL_FLOOR ? OVAL_FLOOR / short : 1;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    halfW: ((maxX - minX) * scale) / 2,
    halfH: ((maxY - minY) * scale) / 2,
    scale,
  };
}

/** Largest glow the oval breathes to. The plays pill clears this, so the breath does not move it. */
const OVAL_BREATH = 1.045;

/** Axis-aligned bounds of the soft glow, including the breath. */
export function ovalGlowBox(points: readonly ScreenPoint[]): LabelBox | null {
  const fit = fittedEllipse(points);
  if (!fit) return null;
  const halo = fit.scale > 1 ? 2.2 : 1.55;
  const grow = halo * OVAL_BREATH;
  const halfW = fit.halfW * grow;
  const halfH = fit.halfH * grow;
  return { x: fit.cx - halfW, y: fit.cy - halfH, w: halfW * 2, h: halfH * 2 };
}

/** The dot under a tap, when the tap is close enough to mean that dot. */
export function nearestMark(dots: readonly GreenDot[], x: number, y: number, radius = 28): GreenDot['id'] | null {
  let best: { id: GreenDot['id']; distance: number } | null = null;
  for (const dot of dots) {
    const distance = Math.hypot(dot.at.x - x, dot.at.y - y);
    if (distance > radius) continue;
    if (!best || distance < best.distance) best = { id: dot.id, distance };
  }
  return best?.id ?? null;
}

function holeAxis(line: readonly ScreenPoint[]): Axis {
  const start = line[0];
  const end = line[line.length - 1];
  if (!start || !end) return { dir: { x: 0, y: -1 }, perp: { x: 1, y: 0 } };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / length, y: dy / length };
  return { dir, perp: { x: -dir.y, y: dir.x } };
}

function boundsOf(points: readonly ScreenPoint[]): LabelBox | null {
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function isDistance(text: string): boolean {
  return text === '150' || text === '300' || text === '450';
}

function pillSize(text: string): { w: number; h: number } {
  return { w: Math.max(44, text.length * 12 + 16), h: 28 };
}

function boxFromCenter(center: ScreenPoint, size: { w: number; h: number }): LabelBox {
  return { x: center.x - size.w / 2, y: center.y - size.h / 2, w: size.w, h: size.h };
}

/** Pull the pill into the open hole. A pill taller than the hole cannot be placed. */
function clampCenter(center: ScreenPoint, size: { w: number; h: number }, visible: LabelBox): ScreenPoint | null {
  const minX = visible.x + size.w / 2;
  const maxX = visible.x + visible.w - size.w / 2;
  const minY = visible.y + size.h / 2;
  const maxY = visible.y + visible.h - size.h / 2;
  if (minX > maxX || minY > maxY) return null;
  return {
    x: Math.min(maxX, Math.max(minX, center.x)),
    y: Math.min(maxY, Math.max(minY, center.y)),
  };
}

/** Distance from the point to the nearest point on the box. Zero when the point is inside. */
export function leaderLength(anchor: ScreenPoint, box: LabelBox): number {
  const x = Math.min(Math.max(anchor.x, box.x), box.x + box.w);
  const y = Math.min(Math.max(anchor.y, box.y), box.y + box.h);
  return Math.hypot(anchor.x - x, anchor.y - y);
}

/** The point on the box the leader should meet. */
export function leaderEnd(anchor: ScreenPoint, box: LabelBox): ScreenPoint {
  return {
    x: Math.min(Math.max(anchor.x, box.x), box.x + box.w),
    y: Math.min(Math.max(anchor.y, box.y), box.y + box.h),
  };
}

function overGreen(box: LabelBox, green: LabelBox | null): boolean {
  if (!green || green.w <= 0 || green.h <= 0) return false;
  return !boxesSeparated(box, green, 0);
}

function placeAt(
  anchor: ScreenPoint,
  size: { w: number; h: number },
  axis: Axis,
  perpShift: number,
  alongShift: number,
  green: LabelBox | null,
  taken: readonly LabelBox[],
  visible: LabelBox,
  extra: readonly LabelBox[] = [],
): { box: LabelBox; leader: boolean } | null {
  const center = clampCenter(
    {
      x: anchor.x + axis.perp.x * perpShift + axis.dir.x * alongShift,
      y: anchor.y + axis.perp.y * perpShift + axis.dir.y * alongShift,
    },
    size,
    visible,
  );
  if (!center) return null;
  const box = boxFromCenter(center, size);
  if (!contains(visible, box)) return null;
  if (overGreen(box, green)) return null;
  if (taken.some((other) => !boxesSeparated(box, other, LABEL_GAP))) return null;
  if (extra.some((other) => !boxesSeparated(box, other, LABEL_GAP))) return null;
  const lead = leaderLength(anchor, box);
  if (lead > LEADER_MAX) return null;
  return { box, leader: lead > 1 };
}

/** Which side of the line of play a box sits on. Zero when it is still on the point. */
function perpOffset(anchor: ScreenPoint, box: LabelBox, axis: Axis): number {
  const centerX = box.x + box.w / 2 - anchor.x;
  const centerY = box.y + box.h / 2 - anchor.y;
  return centerX * axis.perp.x + centerY * axis.perp.y;
}

/** The side with more open map beside the point. A tie stays to the right of the shot. */
function roomierSide(anchor: ScreenPoint, axis: Axis, visible: LabelBox): 1 | -1 {
  const room = (sign: 1 | -1) => {
    let distance = 0;
    for (let step = 1; step <= 400; step += 1) {
      const x = anchor.x + axis.perp.x * sign * step;
      const y = anchor.y + axis.perp.y * sign * step;
      if (x < visible.x || y < visible.y || x > visible.x + visible.w || y > visible.y + visible.h) break;
      distance = step;
    }
    return distance;
  };
  return room(1) >= room(-1) ? 1 : -1;
}

/**
 * Side of the line of play for a plays pill.
 * The oval is not an input, so showing it cannot flip the pill to the other side.
 */
function playsSide(
  anchor: ScreenPoint,
  size: { w: number; h: number },
  axis: Axis,
  green: LabelBox | null,
  taken: readonly LabelBox[],
  visible: LabelBox,
): 1 | -1 {
  const bare = attachPill(anchor, size, axis, green, taken, visible);
  if (!bare) return roomierSide(anchor, axis, visible);
  const offset = perpOffset(anchor, bare.box, axis);
  if (Math.abs(offset) <= 1) return roomierSide(anchor, axis, visible);
  return offset > 0 ? 1 : -1;
}

function attachPill(
  anchor: ScreenPoint,
  size: { w: number; h: number },
  axis: Axis,
  green: LabelBox | null,
  taken: readonly LabelBox[],
  visible: LabelBox,
  extra: readonly LabelBox[] = [],
  side: 1 | -1 | null = null,
  minPerp = 0,
): { box: LabelBox; leader: boolean } | null {
  const halfW = Math.floor(size.w / 2);
  const halfH = Math.floor(size.h / 2);
  const floor = Math.max(0, Math.ceil(minPerp));
  for (let perp = 0; perp <= halfW && floor === 0; perp += 1) {
    for (let along = 0; along <= halfH; along += 1) {
      const perpShifts = perp === 0 ? [0] : [perp, -perp];
      const alongShifts = along === 0 ? [0] : [-along, along];
      for (const perpShift of perpShifts) {
        for (const alongShift of alongShifts) {
          const placed = placeAt(anchor, size, axis, perpShift, alongShift, green, taken, visible, extra);
          if (placed && !placed.leader) return placed;
        }
      }
    }
  }
  const maxShift = Math.ceil(LEADER_MAX + size.w / 2 + size.h / 2);
  const alongNudge = [0, -4, -8, -12, -16, -20, -24, 4, 8, 12];
  const signs: Array<1 | -1> = side == null ? [1, -1] : [side];
  for (let step = Math.max(1, floor); step <= maxShift; step += 1) {
    for (const sign of signs) {
      for (const alongShift of alongNudge) {
        const placed = placeAt(anchor, size, axis, step * sign, alongShift, green, taken, visible, extra);
        if (placed) return placed;
      }
    }
  }
  return null;
}

/**
 * Dots sit on the green points. A pill stays only when it is on its point or a short step beside it.
 * Anything that would have to float is left off the map. The yardage panel still has the number.
 */
export function layoutHoleLabels(input: HoleLabelLayoutInput): HoleLabelLayout {
  const visible: LabelBox = {
    x: input.pad.left,
    y: input.pad.top,
    w: Math.max(24, input.width - input.pad.left - input.pad.right),
    h: Math.max(36, input.height - input.pad.top - input.pad.bottom),
  };
  const axis = holeAxis(input.line);
  const green = boundsOf(input.greenPoints);
  const dots: GreenDot[] = [];
  if (input.front) dots.push({ id: 'front', at: input.front });
  if (input.center) dots.push({ id: 'center', at: input.center });
  if (input.back) dots.push({ id: 'back', at: input.back });

  const labels: PlacedMapLabel[] = [];
  const taken: LabelBox[] = [];
  const glow = ovalGlowBox(input.ellipsePoints ?? []);
  const plays = input.labels.filter((label) => !isDistance(label.text) && label.text !== '—' && !label.text.startsWith('Sample'));
  const yards = input.labels.filter((label) => isDistance(label.text));

  for (const label of yards) {
    const size = pillSize(label.text);
    const side = roomierSide(label.at, axis, visible);
    const placed = attachPill(label.at, size, axis, green, taken, visible, [], side, size.w / 2 + 8);
    if (!placed) continue;
    taken.push(placed.box);
    labels.push({
      id: `yard-${label.text}`,
      text: label.text,
      kind: 'pill',
      box: placed.box,
      at: { x: placed.box.x + placed.box.w / 2, y: placed.box.y + 20 },
      anchor: label.at,
      leader: placed.leader,
    });
  }

  for (const label of plays) {
    const size = pillSize(label.text);
    const side = playsSide(label.at, size, axis, green, taken, visible);
    const placed = attachPill(label.at, size, axis, green, taken, visible, glow ? [glow] : [], side);
    if (!placed) continue;
    taken.push(placed.box);
    labels.push({
      id: `plays-${label.text}`,
      text: label.text,
      kind: 'pill',
      box: placed.box,
      at: { x: placed.box.x + placed.box.w / 2, y: placed.box.y + 20 },
      anchor: label.at,
      leader: placed.leader,
    });
  }

  return { labels, dots };
}

const SAMPLE_CAPTION_W = 72;
const SAMPLE_CAPTION_H = 20;
const SAMPLE_CAPTION_GAP = 8;

export function boundsBox(points: readonly { x: number; y: number }[], pad = 0): LabelBox | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function captionBox(
  at: { x: number; y: number; anchor: 'middle' | 'start' | 'end' },
  width = SAMPLE_CAPTION_W,
  height = SAMPLE_CAPTION_H,
): LabelBox {
  const x = at.anchor === 'start' ? at.x : at.anchor === 'end' ? at.x - width : at.x - width / 2;
  return { x, y: at.y - height, w: width, h: height };
}

/** The painted "Sample" word. Tests use the same box the map clears. */
export function sampleCaptionBox(at: { x: number; y: number; anchor: 'middle' | 'start' | 'end' }): LabelBox {
  return captionBox(at);
}

/** Positive when the boxes are apart. Negative is how far they overlap. */
function axisGap(a: LabelBox, b: LabelBox): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  return Math.max(dx, dy);
}

/**
 * The sample tag sits beside the oval. It stays clear of yardage pills, the
 * flag, and the green outline. A known overlap is never the fallback.
 */
function insideView(box: LabelBox, view: LabelBox): boolean {
  return box.x >= view.x && box.y >= view.y && box.x + box.w <= view.x + view.w && box.y + box.h <= view.y + view.h;
}

export function sampleCaptionAt(
  oval: { cx: number; cy: number; halfW: number; halfH: number },
  pin: { x: number; y: number } | null,
  obstacles: readonly LabelBox[] = [],
  green: LabelBox | null = null,
  view: LabelBox | null = null,
): { x: number; y: number; anchor: 'middle' | 'start' | 'end' } | null {
  const halfW = Math.max(10, oval.halfW);
  const halfH = Math.max(10, oval.halfH);
  const candidates: { x: number; y: number; anchor: 'middle' | 'start' | 'end' }[] = [
    { x: oval.cx, y: oval.cy - halfH - 18, anchor: 'middle' },
    { x: oval.cx - halfW - 16, y: oval.cy - 4, anchor: 'end' },
    { x: oval.cx + halfW + 16, y: oval.cy - 4, anchor: 'start' },
    { x: oval.cx, y: oval.cy + halfH + 28, anchor: 'middle' },
    { x: oval.cx - halfW - 20, y: oval.cy - halfH - 8, anchor: 'end' },
    { x: oval.cx + halfW + 20, y: oval.cy - halfH - 8, anchor: 'start' },
    { x: oval.cx - halfW - 40, y: oval.cy + halfH + 10, anchor: 'end' },
    { x: oval.cx + halfW + 40, y: oval.cy + halfH + 10, anchor: 'start' },
    { x: oval.cx, y: oval.cy - halfH - 48, anchor: 'middle' },
  ];
  if (view && view.w > SAMPLE_CAPTION_W && view.h > SAMPLE_CAPTION_H) {
    candidates.push(
      { x: view.x + 12, y: view.y + SAMPLE_CAPTION_H + 10, anchor: 'start' },
      { x: view.x + view.w - 12, y: view.y + SAMPLE_CAPTION_H + 10, anchor: 'end' },
    );
  }
  const blocks = [...obstacles];
  if (pin) blocks.push({ x: pin.x - 8, y: pin.y - 40, w: 32, h: 44 });
  if (green) blocks.push(green);
  for (const candidate of candidates) {
    const box = captionBox(candidate);
    if (view && !insideView(box, view)) continue;
    const gap = blocks.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...blocks.map((block) => axisGap(box, block)));
    if (gap >= SAMPLE_CAPTION_GAP) return candidate;
  }
  return null;
}
