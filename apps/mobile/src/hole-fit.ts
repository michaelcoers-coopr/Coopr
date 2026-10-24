import type { LatLon } from '@coopr/domain';
import { distanceYards, projectAlongHole, type MapProjection } from '@coopr/engine';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Padding for a full-bleed hole.
 * The pin flag hangs above the green, so the top inset is taller than the sides.
 */
export const HOLE_BLEED_PAD = { top: 48, right: 18, bottom: 28, left: 18 };

/**
 * Points that decide the camera.
 * Fairway, green, bunkers, and hazards are the hole. The centerline is left out
 * so a long tee shot does not shrink that shape into a sliver.
 * A hole with no polygon falls back to the line.
 */
export function holeFitPoints(input: {
  line: readonly LatLon[];
  fairways: readonly (readonly LatLon[])[];
  green: readonly (readonly LatLon[])[];
  bunkers: readonly (readonly LatLon[])[];
  hazards: readonly (readonly LatLon[])[];
}): LatLon[] {
  const polygons = [...input.fairways, ...input.green, ...input.bunkers, ...input.hazards].flat();
  if (polygons.length > 0) return [...polygons];
  return [...input.line];
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function localMeters(origin: LatLon, point: LatLon): { east: number; north: number } {
  const meanLat = radians((origin.lat + point.lat) / 2);
  return {
    north: radians(point.lat - origin.lat) * EARTH_RADIUS_M,
    east: radians(point.lon - origin.lon) * EARTH_RADIUS_M * Math.cos(meanLat),
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Fits the hole so the fairway fills the map.
 * A dogleg's bounding box is wider than the grass, and a long hole is much taller than the screen.
 * The camera uses the fairway's own width. A hole that already fits stays whole.
 * A longer hole is anchored at the tee end of the polygon and runs up the screen.
 */
export function projectHoleFill(
  points: readonly LatLon[],
  width: number,
  height: number,
  pad: { top: number; right: number; bottom: number; left: number },
  bearingDeg: number,
  origin: LatLon,
): MapProjection {
  const contain = () => projectAlongHole(points, width, height, pad, bearingDeg, origin);
  const usable = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (usable.length === 0) return contain();
  const theta = radians(bearingDeg);
  const frame = (point: LatLon) => {
    const { east, north } = localMeters(origin, point);
    return {
      along: east * Math.sin(theta) + north * Math.cos(theta),
      across: east * Math.cos(theta) - north * Math.sin(theta),
    };
  };
  const framed = usable.map(frame);
  const minAlong = Math.min(...framed.map((item) => item.along));
  const maxAlong = Math.max(...framed.map((item) => item.along));
  const spanAlong = maxAlong - minAlong || 1;
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  const bins = 8;
  const slices: { width: number; center: number; along: number }[] = [];
  for (let index = 0; index < bins; index += 1) {
    const low = minAlong + (spanAlong * index) / bins;
    const high = low + spanAlong / bins;
    const slice = framed.filter((item) => item.along >= low && item.along < high + (index === bins - 1 ? 1 : 0));
    if (slice.length < 2) continue;
    const left = Math.min(...slice.map((item) => item.across));
    const right = Math.max(...slice.map((item) => item.across));
    slices.push({ width: right - left, center: (left + right) / 2, along: (low + high) / 2 });
  }
  const playing = median(slices.map((slice) => slice.width));
  if (playing < 8 || slices.length === 0) return contain();
  const spanAcross = Math.max(...framed.map((item) => item.across)) - Math.min(...framed.map((item) => item.across)) || 1;
  const containScale = Math.min(innerW / spanAcross, innerH / spanAlong);
  // A hole whose grass is already half the map stays whole, green included.
  if (playing * containScale >= innerW * 0.5) return contain();
  const scale = innerW / playing;
  const windowAlong = innerH / scale;
  const start = minAlong;
  const end = start + windowAlong;
  const visible = slices.filter((slice) => slice.along >= start && slice.along <= end);
  const center = median((visible.length > 0 ? visible : slices).map((slice) => slice.center));
  const across0 = center - playing / 2;
  const toEn = (along: number, across: number) => ({
    east: along * Math.sin(theta) + across * Math.cos(theta),
    north: along * Math.cos(theta) - across * Math.sin(theta),
  });
  const toLatLonMeters = (east: number, north: number): LatLon => {
    const lat = origin.lat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
    const cosLat = Math.cos(radians(origin.lat)) || 1;
    return { lat, lon: origin.lon + (east / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI) };
  };
  return {
    toXY: (point) => {
      const { along, across } = frame(point);
      return {
        x: pad.left + (across - across0) * scale,
        y: pad.top + (end - along) * scale,
      };
    },
    toLatLon: (x, y) => {
      const across = across0 + (x - pad.left) / scale;
      const along = end - (y - pad.top) / scale;
      const { east, north } = toEn(along, across);
      return toLatLonMeters(east, north);
    },
  };
}

/** How far past a measured stock carry the tee camera looks, before the width rule crops it. */
export const PAST_STOCK_YARDS = 40;

/** Tee-shot fairway width as a fraction of the screen width. The width rule wins over the far yard marks. */
export const TEE_WIDTH_FRACTION = 0.35;

/**
 * Median fairway cross-section, in meters.
 * A dogleg's bounding box is wider than the grass, so the camera uses the grass.
 */
export function playingWidthMeters(points: readonly LatLon[], bearingDeg: number, origin: LatLon): number | null {
  const usable = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  if (usable.length < 2 || !Number.isFinite(bearingDeg)) return null;
  const theta = radians(bearingDeg);
  const framed = usable.map((point) => {
    const { east, north } = localMeters(origin, point);
    return {
      along: east * Math.sin(theta) + north * Math.cos(theta),
      across: east * Math.cos(theta) - north * Math.sin(theta),
    };
  });
  const minAlong = Math.min(...framed.map((item) => item.along));
  const maxAlong = Math.max(...framed.map((item) => item.along));
  const spanAlong = maxAlong - minAlong;
  if (spanAlong < 8) return null;
  const bins = 8;
  const widths: number[] = [];
  for (let index = 0; index < bins; index += 1) {
    const low = minAlong + (spanAlong * index) / bins;
    const high = low + spanAlong / bins;
    const slice = framed.filter((item) => item.along >= low && item.along < high + (index === bins - 1 ? 1 : 0));
    if (slice.length < 2) continue;
    const width = Math.max(...slice.map((item) => item.across)) - Math.min(...slice.map((item) => item.across));
    if (width >= 8) widths.push(width);
  }
  if (widths.length === 0) return null;
  return median(widths);
}

/** Yard marks drawn on the tee shot. */
export const TEE_SHOT_MARKS = [150, 200, 250] as const;

/**
 * Tee shot only when the player is on this hole and asked for it.
 * Someone still standing on the previous tee gets the whole hole, not a green zoom
 * that shrinks the next hole into a corner.
 */
export function playCamera(input: {
  onTee: boolean;
  fullHole: boolean;
  reachYards: number | null;
  onThisHole: boolean;
  player: boolean;
}): 'tee' | 'hole' | 'green' {
  if (input.onTee && input.fullHole && input.reachYards != null && input.onThisHole) return 'tee';
  if (input.onTee || input.fullHole || !input.player || !input.onThisHole) return 'hole';
  return 'green';
}

/** A point this many yards from the start of the hole line. Past the end, the last point. */
export function pointAtYards(line: readonly LatLon[], yards: number): LatLon | null {
  if (line.length === 0 || !Number.isFinite(yards) || yards < 0) return null;
  const first = line[0];
  if (!first || line.length === 1 || yards === 0) return first ?? null;
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1]!;
    const end = line[index]!;
    const span = distanceYards(start, end);
    if (span <= 0) continue;
    if (walked + span >= yards - 1e-6) {
      const t = Math.min(1, Math.max(0, (yards - walked) / span));
      return {
        lat: start.lat + (end.lat - start.lat) * t,
        lon: start.lon + (end.lon - start.lon) * t,
      };
    }
    walked += span;
  }
  return line[line.length - 1] ?? null;
}

export function lineLengthYards(line: readonly LatLon[]): number {
  let walked = 0;
  for (let index = 1; index < line.length; index += 1) walked += distanceYards(line[index - 1]!, line[index]!);
  return walked;
}

/**
 * How far down the hole the tee camera looks.
 * The far end is the stock carry plus 40 yards. A 150, 200, or 250 mark
 * just past that still gets into the frame. A short hole stops at the green.
 */
export function teeWindowYards(stockCarry: number | null, holeYards: number, fairwayStartYards: number | null = null): number | null {
  if (!Number.isFinite(holeYards) || holeYards <= 0) return null;
  const fromStock = stockCarry != null && Number.isFinite(stockCarry) && stockCarry > 0 ? stockCarry + PAST_STOCK_YARDS : null;
  const fromGrass =
    fairwayStartYards != null && Number.isFinite(fairwayStartYards) && fairwayStartYards > 0 ? fairwayStartYards + PAST_STOCK_YARDS : null;
  // A missing stock is a camera crop from the grass, or the 250 mark on a long hole. It is not a carry.
  const base = fromStock ?? fromGrass ?? (holeYards > 266 ? 250 : null);
  if (base == null) return null;
  const marks = TEE_SHOT_MARKS.filter((yards) => yards <= base + PAST_STOCK_YARDS && yards < holeYards);
  const far = Math.max(base, ...marks);
  const window = Math.min(holeYards, far + 16);
  return window >= holeYards - 8 ? null : window;
}

export interface PlayView {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Frames the hole in the open band between the yardage HUD and the sheet.
 * The tee shot pins the tee to the bottom and looks out to the stock window.
 * A wider zoom is used only when the fairway polygon still starts inside that view.
 * Full hole and ball-to-green fit their span in the band.
 */
export function projectPlayFrame(input: {
  line: readonly LatLon[];
  around: readonly LatLon[];
  fairway?: readonly LatLon[];
  width: number;
  height: number;
  view: PlayView;
  bearing: number;
  origin: LatLon;
  kind: 'tee' | 'green' | 'hole';
  reachYards: number | null;
  from: LatLon | null;
}): MapProjection {
  const contain = () => projectAlongHole(input.around.length > 0 ? input.around : input.line, input.width, input.height, input.view, input.bearing, input.origin);
  const tee = input.line[0];
  const pin = input.line[input.line.length - 1];
  if (!tee || !pin) return contain();
  const endPoint =
    input.kind === 'tee' && input.reachYards != null
      ? pointAtYards(input.line, input.reachYards) ?? pin
      : input.kind === 'green' && input.from
        ? pin
        : pin;
  const startPoint = input.kind === 'green' && input.from ? input.from : tee;
  const theta = radians(input.bearing);
  const frame = (point: LatLon) => {
    const { east, north } = localMeters(input.origin, point);
    return {
      along: east * Math.sin(theta) + north * Math.cos(theta),
      across: east * Math.cos(theta) - north * Math.sin(theta),
    };
  };
  const start = frame(startPoint);
  const end = frame(endPoint);
  let near = Math.min(start.along, end.along);
  let far = Math.max(start.along, end.along);
  if (input.kind !== 'tee') {
    const pinAlong = Math.max(start.along, end.along);
    const farCap = pinAlong + 45;
    for (const point of input.around) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      far = Math.max(far, Math.min(frame(point).along, farCap));
    }
  }
  const minSpan = 40 * 0.9144;
  if (far - near < minSpan) near = far - minSpan;
  const spanAlong = far - near || 1;
  const fitTop = input.view.top + 6;
  const fitBottom = input.view.bottom + 4;
  const innerW = Math.max(1, input.width - input.view.left - input.view.right);
  const innerH = Math.max(1, input.height - fitTop - fitBottom);
  if (innerH < 48 || innerW < 48) return contain();
  let scale = innerH / spanAlong;
  if (input.kind === 'tee' && end.along >= start.along) {
    const playing = playingWidthMeters(input.fairway ?? [], input.bearing, input.origin);
    let fairwayNear = Number.POSITIVE_INFINITY;
    for (const point of input.fairway ?? []) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      fairwayNear = Math.min(fairwayNear, frame(point).along);
    }
    if (playing != null && playing >= 8) {
      const widthScale = (input.width * TEE_WIDTH_FRACTION) / playing;
      const visible = innerH / widthScale;
      const croppedFar = start.along + visible;
      const fairwayStays = !Number.isFinite(fairwayNear) || croppedFar >= fairwayNear;
      if (widthScale > scale && fairwayStays && croppedFar >= end.along) {
        scale = widthScale;
        near = start.along;
        far = croppedFar;
      }
    }
  }
  let minAcross = Number.POSITIVE_INFINITY;
  let maxAcross = Number.NEGATIVE_INFINITY;
  for (const point of [...input.line, ...input.around, startPoint, endPoint]) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const framed = frame(point);
    if (framed.along < near - 30 || framed.along > far + 30) continue;
    minAcross = Math.min(minAcross, framed.across);
    maxAcross = Math.max(maxAcross, framed.across);
  }
  if (!Number.isFinite(minAcross) || !Number.isFinite(maxAcross)) {
    minAcross = -18;
    maxAcross = 18;
  }
  // A water hazard much wider than the hole shoves the green off the screen.
  // The camera stays on the tee-to-green corridor, with a little grass either side.
  let corridorMin = Number.POSITIVE_INFINITY;
  let corridorMax = Number.NEGATIVE_INFINITY;
  for (const point of [...input.line, ...(input.fairway ?? [])]) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    const framed = frame(point);
    if (framed.along < near - 30 || framed.along > far + 30) continue;
    corridorMin = Math.min(corridorMin, framed.across);
    corridorMax = Math.max(corridorMax, framed.across);
  }
  if (Number.isFinite(corridorMin) && Number.isFinite(corridorMax)) {
    const corridorSpan = Math.max(18, corridorMax - corridorMin);
    const side = Math.max(14, corridorSpan * 0.45);
    const limitMin = corridorMin - side;
    const limitMax = corridorMax + side;
    if (maxAcross - minAcross > (limitMax - limitMin) * 1.25) {
      minAcross = limitMin;
      maxAcross = limitMax;
    }
  }
  if (maxAcross - minAcross < 18) {
    const mid = (minAcross + maxAcross) / 2;
    minAcross = mid - 18;
    maxAcross = mid + 18;
  }
  let usedW = (maxAcross - minAcross) * scale;
  if (usedW > innerW && maxAcross > minAcross) {
    scale *= innerW / usedW;
    usedW = innerW;
  }
  const offsetX = input.view.left + (innerW - usedW) / 2;
  const toEn = (along: number, across: number) => ({
    east: along * Math.sin(theta) + across * Math.cos(theta),
    north: along * Math.cos(theta) - across * Math.sin(theta),
  });
  const toLatLonMeters = (east: number, north: number): LatLon => {
    const lat = input.origin.lat + (north / EARTH_RADIUS_M) * (180 / Math.PI);
    const cosLat = Math.cos(radians(input.origin.lat)) || 1;
    return { lat, lon: input.origin.lon + (east / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI) };
  };
  return {
    toXY: (point) => {
      const framed = frame(point);
      return {
        x: offsetX + (framed.across - minAcross) * scale,
        y: fitTop + (far - framed.along) * scale,
      };
    },
    toLatLon: (x, y) => {
      const across = minAcross + (x - offsetX) / scale;
      const along = far - (y - fitTop) / scale;
      const { east, north } = toEn(along, across);
      return toLatLonMeters(east, north);
    },
  };
}
