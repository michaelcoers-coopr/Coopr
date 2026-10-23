import type { LatLon } from '@coopr/domain';
import { projectAlongHole, type MapProjection } from '@coopr/engine';

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
