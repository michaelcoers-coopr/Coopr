import type { LabelBox } from '@coopr/engine';

/** Minimum space between any two map labels, in points. */
export const LABEL_GAP = 6;

const OVAL_FLOOR = 14;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PlacedMapLabel {
  id: string;
  text: string;
  kind: 'pill' | 'letter' | 'caption';
  box: LabelBox;
  at: ScreenPoint;
}

export interface HoleLabelLayoutInput {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  line: readonly ScreenPoint[];
  flight: readonly ScreenPoint[];
  front: ScreenPoint | null;
  center: ScreenPoint | null;
  back: ScreenPoint | null;
  pin: ScreenPoint | null;
  greenPoints: readonly ScreenPoint[];
  ellipsePoints: readonly ScreenPoint[];
  labels: readonly { text: string; at: ScreenPoint }[];
  /** The oval's yard caption. Omitted when the oval is hidden. */
  caption: string | null;
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

function dist2(a: ScreenPoint, b: ScreenPoint): number {
  return (a.x - b.x) ** 2 + (b.y - a.y) ** 2;
}

function alongOf(point: ScreenPoint, origin: ScreenPoint, axis: Axis): number {
  return (point.x - origin.x) * axis.dir.x + (point.y - origin.y) * axis.dir.y;
}

function acrossOf(point: ScreenPoint, origin: ScreenPoint, axis: Axis): number {
  return (point.x - origin.x) * axis.perp.x + (point.y - origin.y) * axis.perp.y;
}

function at(origin: ScreenPoint, axis: Axis, along: number, across: number): ScreenPoint {
  return {
    x: origin.x + axis.dir.x * along + axis.perp.x * across,
    y: origin.y + axis.dir.y * along + axis.perp.y * across,
  };
}

/** Tee-to-green direction at the green. Screen y grows downward. */
function greenAxis(front: ScreenPoint, back: ScreenPoint, line: readonly ScreenPoint[]): Axis {
  let dx = back.x - front.x;
  let dy = back.y - front.y;
  if (Math.hypot(dx, dy) < 8 && line.length >= 2) {
    const start = line[0]!;
    const end = line[line.length - 1]!;
    dx = end.x - start.x;
    dy = end.y - start.y;
  }
  const length = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / length, y: dy / length };
  return { dir, perp: { x: -dir.y, y: dir.x } };
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

function strokeBoxes(points: readonly ScreenPoint[], pad = 7): LabelBox[] {
  const boxes: LabelBox[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 14));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      boxes.push({ x: start.x + dx * t - pad, y: start.y + dy * t - pad, w: pad * 2, h: pad * 2 });
    }
  }
  return boxes;
}

function pillSize(text: string): { w: number; h: number } {
  return { w: Math.max(44, text.length * 12 + 16), h: 28 };
}

function captionSize(text: string, maxW: number): { w: number; h: number } {
  return { w: Math.min(maxW, Math.max(44, Math.ceil(text.length * 7.6) + 16)), h: 22 };
}

function letterBox(spot: ScreenPoint): LabelBox {
  return { x: spot.x - 12, y: spot.y - 28, w: 24, h: 36 };
}

function boundsOf(points: readonly ScreenPoint[], pad = 0): LabelBox | null {
  if (points.length === 0) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function isDistance(text: string): boolean {
  return text === '150' || text === '300' || text === '450';
}

function clearOf(box: LabelBox, obstacles: readonly LabelBox[]): boolean {
  return obstacles.every((other) => boxesSeparated(box, other, LABEL_GAP));
}

function overlapAmount(box: LabelBox, obstacles: readonly LabelBox[]): number {
  let score = 0;
  for (const other of obstacles) {
    if (boxesSeparated(box, other, LABEL_GAP)) continue;
    const overlapW = Math.min(box.x + box.w, other.x + other.w + LABEL_GAP) - Math.max(box.x, other.x - LABEL_GAP);
    const overlapH = Math.min(box.y + box.h, other.y + other.h + LABEL_GAP) - Math.max(box.y, other.y - LABEL_GAP);
    score += Math.max(0, overlapW) * Math.max(0, overlapH);
  }
  return score;
}

/** Best box that stays on the open map and keeps LABEL_GAP from everything already placed. */
function chooseBox(
  candidates: readonly LabelBox[],
  obstacles: readonly LabelBox[],
  visible: LabelBox,
  rank: (box: LabelBox) => number,
): LabelBox | null {
  let best: { box: LabelBox; score: number } | null = null;
  let fallback: { box: LabelBox; score: number; overlap: number } | null = null;
  for (const box of candidates) {
    if (!contains(visible, box)) continue;
    const score = rank(box);
    const overlap = overlapAmount(box, obstacles);
    if (overlap === 0 && clearOf(box, obstacles) && (!best || score < best.score)) best = { box, score };
    if (!fallback || overlap < fallback.overlap || (overlap === fallback.overlap && score < fallback.score)) {
      fallback = { box, score, overlap };
    }
  }
  return best?.box ?? fallback?.box ?? null;
}

function gridBoxes(visible: LabelBox, w: number, h: number, step: number): LabelBox[] {
  const boxes: LabelBox[] = [];
  const maxX = visible.x + visible.w - w;
  const maxY = visible.y + visible.h - h;
  if (maxX < visible.x || maxY < visible.y) return boxes;
  for (let y = visible.y; y <= maxY + 0.1; y += step) {
    for (let x = visible.x; x <= maxX + 0.1; x += step) {
      boxes.push({ x, y, w, h });
    }
  }
  return boxes;
}

function nudgeBoxes(ideal: LabelBox, visible: LabelBox, shifts: readonly ScreenPoint[]): LabelBox[] {
  return shifts.map((shift) => ({ x: ideal.x + shift.x, y: ideal.y + shift.y, w: ideal.w, h: ideal.h })).filter((box) => contains(visible, box));
}

function letterCandidates(visible: LabelBox, spots: readonly ScreenPoint[]): LabelBox[] {
  const seen = new Set<string>();
  const boxes: LabelBox[] = [];
  for (const spot of spots) {
    const box = letterBox(spot);
    const key = `${Math.round(box.x)}:${Math.round(box.y)}`;
    if (seen.has(key) || !contains(visible, box)) continue;
    seen.add(key);
    boxes.push(box);
  }
  return boxes;
}

function letterSpots(visible: LabelBox): ScreenPoint[] {
  const spots: ScreenPoint[] = [];
  const step = 8;
  const minX = visible.x + 12;
  const maxX = visible.x + visible.w - 12;
  const minY = visible.y + 28;
  const maxY = visible.y + visible.h - 8;
  for (let y = minY; y <= maxY + 0.1; y += step) {
    for (let x = minX; x <= maxX + 0.1; x += step) spots.push({ x, y });
  }
  return spots;
}

function xOverlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

/**
 * One placement of every hole label.
 * F sits short of the green, toward the tee. B sits past the green.
 * When that line is crowded they take opposite sides of the line of play.
 * Nothing already on the map — pills, the caption, the oval — is placed again later.
 */
export function layoutHoleLabels(input: HoleLabelLayoutInput): PlacedMapLabel[] {
  const visible: LabelBox = {
    x: input.pad.left,
    y: input.pad.top,
    w: Math.max(24, input.width - input.pad.left - input.pad.right),
    h: Math.max(36, input.height - input.pad.top - input.pad.bottom),
  };
  const ellipse = fittedEllipse(input.ellipsePoints);
  const ovalBox: LabelBox | null = ellipse
    ? { x: ellipse.cx - ellipse.halfW, y: ellipse.cy - ellipse.halfH, w: ellipse.halfW * 2, h: ellipse.halfH * 2 }
    : null;
  const greenBox = boundsOf(input.greenPoints, 2);
  const placed: PlacedMapLabel[] = [];
  const taken = (): LabelBox[] => placed.map((item) => item.box);

  const pillObstacles = (): LabelBox[] => [...(ovalBox ? [ovalBox] : []), ...taken()];

  const distanceLabels = input.labels.filter((label) => isDistance(label.text));
  const playLabels = input.labels.filter((label) => !isDistance(label.text) && label.text !== '—');

  for (const label of playLabels) {
    const size = pillSize(label.text);
    const beside = ellipse
      ? { x: ellipse.cx + ellipse.halfW + LABEL_GAP + 4, y: ellipse.cy - size.h / 2, w: size.w, h: size.h }
      : { x: label.at.x - size.w / 2, y: label.at.y - 16, w: size.w, h: size.h };
    const otherSide = ellipse
      ? { x: ellipse.cx - ellipse.halfW - LABEL_GAP - 4 - size.w, y: ellipse.cy - size.h / 2, w: size.w, h: size.h }
      : beside;
    const below = ellipse
      ? { x: ellipse.cx - size.w / 2, y: ellipse.cy + ellipse.halfH + LABEL_GAP + 2, w: size.w, h: size.h }
      : beside;
    const candidates = [
      beside,
      otherSide,
      below,
      ...nudgeBoxes(beside, visible, [
        { x: 0, y: -36 },
        { x: 0, y: 36 },
        { x: 0, y: -64 },
        { x: 0, y: 64 },
        { x: 28, y: 0 },
        { x: -28, y: 0 },
      ]),
      ...gridBoxes(visible, size.w, size.h, 10),
    ];
    const box = chooseBox(candidates, pillObstacles(), visible, (item) => dist2({ x: item.x, y: item.y }, { x: beside.x, y: beside.y }));
    if (box) placed.push({ id: `plays-${label.text}`, text: label.text, kind: 'pill', box, at: { x: box.x + box.w / 2, y: box.y + 20 } });
  }

  for (const label of distanceLabels) {
    const size = pillSize(label.text);
    const ideal = { x: label.at.x - size.w / 2, y: label.at.y - 16, w: size.w, h: size.h };
    const shifts: ScreenPoint[] = [];
    for (const across of [0, 22, -22, 44, -44, 66, -66]) {
      for (const along of [0, -20, 20, -40, 40]) shifts.push({ x: across, y: along });
    }
    const candidates = [ideal, ...nudgeBoxes(ideal, visible, shifts), ...gridBoxes(visible, size.w, size.h, 12)];
    const box = chooseBox(candidates, pillObstacles(), visible, (item) => dist2({ x: item.x, y: item.y }, { x: ideal.x, y: ideal.y }));
    if (box) placed.push({ id: `yard-${label.text}`, text: label.text, kind: 'pill', box, at: { x: box.x + box.w / 2, y: box.y + 20 } });
  }

  if (input.front && input.center && input.back) {
    const axis = greenAxis(input.front, input.back, input.line);
    const clippedFlight = ellipse ? clipPolylineAtOval(input.flight, ellipse.cx, ellipse.cy, ellipse.halfW, ellipse.halfH) : input.flight;
    const ball = input.flight[0] ?? input.line[0] ?? null;
    const aim =
      ellipse && ball && !insideEllipse(ball, ellipse.cx, ellipse.cy, ellipse.halfW, ellipse.halfH)
        ? [ball, ellipseEdge(ball, ellipse.cx, ellipse.cy, ellipse.halfW, ellipse.halfH)]
        : [];
    const pinBox: LabelBox | null = input.pin ? { x: input.pin.x - 10, y: input.pin.y - 40, w: 32, h: 46 } : null;
    const letterObstacles = (): LabelBox[] => [
      ...taken(),
      ...(greenBox ? [greenBox] : []),
      ...(ovalBox ? [ovalBox] : []),
      ...(pinBox ? [pinBox] : []),
      ...strokeBoxes(input.line, 7),
      ...strokeBoxes(clippedFlight, 8),
      ...strokeBoxes(aim, 8),
    ];
    const spots = letterSpots(visible);
    const playsBox = placed.find((item) => item.kind === 'pill' && !isDistance(item.text))?.box ?? null;

    const frontIdeal = at(input.front, axis, -36, 30);
    const frontBox = chooseBox(letterCandidates(visible, [frontIdeal, ...spots]), letterObstacles(), visible, (box) => {
      const spot = { x: box.x + 12, y: box.y + 28 };
      const along = alongOf(spot, input.front!, axis);
      const across = acrossOf(spot, input.front!, axis);
      let score = Math.abs(along + 36) * 4 + Math.abs(across - 30) * 2;
      if (across < -8) score += 100000;
      if (along > -16) score += 12000;
      return score;
    });
    if (frontBox) {
      const spot = { x: frontBox.x + 12, y: frontBox.y + 28 };
      placed.push({ id: 'front', text: 'F', kind: 'letter', box: frontBox, at: spot });
    }

    const backIdeal = at(input.back, axis, 40, -30);
    const backBox = chooseBox(letterCandidates(visible, [backIdeal, ...spots]), letterObstacles(), visible, (box) => {
      const spot = { x: box.x + 12, y: box.y + 28 };
      const along = alongOf(spot, input.back!, axis);
      const across = acrossOf(spot, input.back!, axis);
      let score = Math.abs(along - 40) * 4 + Math.abs(across + 30) * 2;
      if (across > 8) score += 100000;
      if (along < 16) score += 8000;
      return score;
    });
    if (backBox) {
      const spot = { x: backBox.x + 12, y: backBox.y + 28 };
      placed.push({ id: 'back', text: 'B', kind: 'letter', box: backBox, at: spot });
    }

    const playsAcross = playsBox ? acrossOf({ x: playsBox.x + playsBox.w / 2, y: playsBox.y + playsBox.h / 2 }, input.center, axis) : 24;
    const centerSide = playsAcross >= 0 ? -1 : 1;
    const centerIdeal = at(input.center, axis, -8, centerSide * 42);
    const centerBox = chooseBox(letterCandidates(visible, [centerIdeal, ...spots]), letterObstacles(), visible, (box) => {
      const spot = { x: box.x + 12, y: box.y + 28 };
      const across = acrossOf(spot, input.center!, axis);
      let score = dist2(spot, centerIdeal);
      if (centerSide > 0 && across < -8) score += 100000;
      if (centerSide < 0 && across > 8) score += 100000;
      if (playsBox && xOverlaps(box, playsBox)) score += 4000;
      return score;
    });
    if (centerBox) {
      const spot = { x: centerBox.x + 12, y: centerBox.y + 28 };
      placed.push({ id: 'center', text: 'C', kind: 'letter', box: centerBox, at: spot });
    }
  }

  if (input.caption && ellipse) {
    const size = captionSize(input.caption, Math.max(44, visible.w - 8));
    const below = { x: ellipse.cx - size.w / 2, y: ellipse.cy + ellipse.halfH + LABEL_GAP + 2, w: size.w, h: size.h };
    const above = { x: ellipse.cx - size.w / 2, y: ellipse.cy - ellipse.halfH - LABEL_GAP - size.h - 2, w: size.w, h: size.h };
    const left = { x: Math.max(visible.x, ellipse.cx - ellipse.halfW - LABEL_GAP - 4 - size.w), y: ellipse.cy - size.h / 2, w: size.w, h: size.h };
    const candidates = [
      below,
      above,
      left,
      ...nudgeBoxes(below, visible, [
        { x: 0, y: 36 },
        { x: 0, y: 72 },
        { x: 0, y: 108 },
        { x: -24, y: 48 },
        { x: 24, y: 48 },
      ]),
      ...gridBoxes(visible, size.w, size.h, 12),
    ];
    const box = chooseBox(candidates, pillObstacles(), visible, (item) => dist2({ x: item.x, y: item.y }, { x: below.x, y: below.y }));
    if (box) placed.push({ id: 'caption', text: input.caption, kind: 'caption', box, at: { x: box.x + box.w / 2, y: box.y + 16 } });
  }

  return placed;
}
