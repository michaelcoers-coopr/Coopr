import type { LatLon } from '@coopr/domain';

const EARTH_RADIUS_M = 6_371_000;
export const METERS_PER_YARD = 0.9144;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Ground distance. This is not a carry and not a total. */
export function distanceYards(a: LatLon, b: LatLon): number {
  const phi1 = radians(a.lat);
  const phi2 = radians(b.lat);
  const dPhi = radians(b.lat - a.lat);
  const dLambda = radians(b.lon - a.lon);
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const meters = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  return meters / METERS_PER_YARD;
}

export function closeRing(ring: readonly LatLon[]): LatLon[] {
  if (ring.length === 0) return [];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first.lat === last.lat && first.lon === last.lon) return [...ring];
  return [...ring, first];
}

/** Ray cast. Points on the boundary are not guaranteed; use distanceToRing for that. */
export function pointInRing(point: LatLon, ring: readonly LatLon[]): boolean {
  if (ring.length < 3) return false;
  const x = point.lon;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i]!.lat;
    const xi = ring[i]!.lon;
    const yj = ring[j]!.lat;
    const xj = ring[j]!.lon;
    const denom = yj - yi || 1e-15;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function toLocal(origin: LatLon, point: LatLon): { x: number; y: number } {
  const lat0 = radians(origin.lat);
  return {
    x: radians(point.lon - origin.lon) * Math.cos(lat0) * EARTH_RADIUS_M,
    y: radians(point.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

function fromLocal(origin: LatLon, x: number, y: number): LatLon {
  const lat0 = radians(origin.lat);
  return {
    lat: origin.lat + (y / EARTH_RADIUS_M) * (180 / Math.PI),
    lon: origin.lon + (x / (EARTH_RADIUS_M * Math.cos(lat0) || 1e-15)) * (180 / Math.PI),
  };
}

export function closestPointOnSegment(point: LatLon, a: LatLon, b: LatLon): LatLon {
  const p = toLocal(point, point);
  const start = toLocal(point, a);
  const end = toLocal(point, b);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - start.x) * dx + (p.y - start.y) * dy) / length2));
  return fromLocal(point, start.x + dx * t, start.y + dy * t);
}

export function distanceToRingYards(point: LatLon, ring: readonly LatLon[]): number | null {
  if (ring.length === 0) return null;
  let best = distanceYards(point, ring[0]!);
  const closed = closeRing(ring);
  for (let i = 0; i < closed.length - 1; i++) {
    const onSegment = closestPointOnSegment(point, closed[i]!, closed[i + 1]!);
    best = Math.min(best, distanceYards(point, onSegment));
  }
  return best;
}

export function pointInOrOnRing(point: LatLon, ring: readonly LatLon[], edgeMeters = 1): boolean {
  if (pointInRing(point, ring)) return true;
  const yards = distanceToRingYards(point, ring);
  return yards != null && yards * METERS_PER_YARD <= edgeMeters;
}

/** Area-weighted centroid in geographic degrees. Suitable for a green, not a continent. */
export function ringCentroid(ring: readonly LatLon[]): LatLon | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const x1 = closed[i]!.lon;
    const y1 = closed[i]!.lat;
    const x2 = closed[i + 1]!.lon;
    const y2 = closed[i + 1]!.lat;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) < 1e-14) return null;
  return { lon: cx / (3 * twiceArea), lat: cy / (3 * twiceArea) };
}

function segmentsCross(a: LatLon, b: LatLon, c: LatLon, d: LatLon): boolean {
  const cross = (p: LatLon, q: LatLon, r: LatLon) => (q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon);
  const on = (p: LatLon, q: LatLon, r: LatLon) =>
    Math.min(p.lon, r.lon) - 1e-12 <= q.lon &&
    q.lon <= Math.max(p.lon, r.lon) + 1e-12 &&
    Math.min(p.lat, r.lat) - 1e-12 <= q.lat &&
    q.lat <= Math.max(p.lat, r.lat) + 1e-12 &&
    Math.abs(cross(p, q, r)) < 1e-14;
  const c1 = cross(a, b, c);
  const c2 = cross(a, b, d);
  const c3 = cross(c, d, a);
  const c4 = cross(c, d, b);
  if (c1 === 0 && on(a, c, b)) return true;
  if (c2 === 0 && on(a, d, b)) return true;
  if (c3 === 0 && on(c, a, d)) return true;
  if (c4 === 0 && on(c, b, d)) return true;
  return c1 > 0 !== c2 > 0 && c3 > 0 !== c4 > 0;
}

export function lineIntersectsRing(line: readonly LatLon[], ring: readonly LatLon[]): boolean {
  if (line.length === 0 || ring.length < 2) return false;
  if (line.some((point) => pointInRing(point, ring))) return true;
  const closed = closeRing(ring);
  for (let i = 0; i < line.length - 1; i++) {
    for (let j = 0; j < closed.length - 1; j++) {
      if (segmentsCross(line[i]!, line[i + 1]!, closed[j]!, closed[j + 1]!)) return true;
    }
  }
  return false;
}

export interface GreenYards {
  frontYards: number;
  centerYards: number;
  backYards: number;
}

/**
 * Front is the nearest boundary point, back is the farthest vertex, center is the centroid.
 * All three are ground distances from `from`. None of them is a carry.
 */
export function greenYardsFrom(from: LatLon, ring: readonly LatLon[]): GreenYards | null {
  const closed = closeRing(ring);
  const center = ringCentroid(closed);
  if (!center || closed.length < 4) return null;
  let front = Number.POSITIVE_INFINITY;
  let back = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const nearest = closestPointOnSegment(from, closed[i]!, closed[i + 1]!);
    front = Math.min(front, distanceYards(from, nearest));
    back = Math.max(back, distanceYards(from, closed[i]!));
  }
  if (!Number.isFinite(front)) return null;
  return { frontYards: front, centerYards: distanceYards(from, center), backYards: back };
}
