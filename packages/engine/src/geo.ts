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

/**
 * Area-weighted centroid on a local meter plane.
 * Degree-space shoelace drifts off a green at mid latitudes.
 */
export function ringCentroid(ring: readonly LatLon[]): LatLon | null {
  const closed = closeRing(ring);
  if (closed.length < 4) return null;
  const origin = closed[0]!;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const first = toLocal(origin, closed[i]!);
    const second = toLocal(origin, closed[i + 1]!);
    const cross = first.x * second.y - second.x * first.y;
    twiceArea += cross;
    cx += (first.x + second.x) * cross;
    cy += (first.y + second.y) * cross;
  }
  if (Math.abs(twiceArea) < 1e-4) return null;
  return fromLocal(origin, cx / (3 * twiceArea), cy / (3 * twiceArea));
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

export interface GreenTargets {
  front: LatLon;
  center: LatLon;
  back: LatLon;
}

/**
 * Front is the nearest boundary point, back is the farthest vertex, center is the centroid.
 * The same three points feed the yardages. None of them is a carry.
 */
export function greenTargets(from: LatLon, ring: readonly LatLon[]): GreenTargets | null {
  const closed = closeRing(ring);
  const center = ringCentroid(closed);
  if (!center || closed.length < 4) return null;
  let frontYards = Number.POSITIVE_INFINITY;
  let front: LatLon | null = null;
  let backYards = 0;
  let back: LatLon | null = null;
  for (let i = 0; i < closed.length - 1; i++) {
    const nearest = closestPointOnSegment(from, closed[i]!, closed[i + 1]!);
    const near = distanceYards(from, nearest);
    if (near < frontYards) {
      frontYards = near;
      front = nearest;
    }
    const far = distanceYards(from, closed[i]!);
    if (far > backYards) {
      backYards = far;
      back = closed[i]!;
    }
  }
  if (!front || !back || !Number.isFinite(frontYards)) return null;
  return { front, center, back };
}

/** Ground distances from `from` to the front, center, and back of the green. */
export function greenYardsFrom(from: LatLon, ring: readonly LatLon[]): GreenYards | null {
  const targets = greenTargets(from, ring);
  if (!targets) return null;
  return {
    frontYards: distanceYards(from, targets.front),
    centerYards: distanceYards(from, targets.center),
    backYards: distanceYards(from, targets.back),
  };
}

/** Degrees clockwise from north, 0 to 360. */
export function bearingDegrees(from: LatLon, to: LatLon): number | null {
  if (from.lat === to.lat && from.lon === to.lon) return null;
  const phi1 = radians(from.lat);
  const phi2 = radians(to.lat);
  const dLambda = radians(to.lon - from.lon);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** Ground point reached by walking `yards` on the bearing. Not a carry. */
export function destinationPoint(from: LatLon, bearing: number, yards: number): LatLon {
  const delta = (yards * METERS_PER_YARD) / EARTH_RADIUS_M;
  const theta = radians(bearing);
  const phi1 = radians(from.lat);
  const lambda1 = radians(from.lon);
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return { lat: (phi2 * 180) / Math.PI, lon: (((lambda2 * 180) / Math.PI + 540) % 360) - 180 };
}

/** A ring around `center`. `alongYards` follows the bearing. `acrossYards` is perpendicular. */
export function ellipseRing(center: LatLon, bearing: number, alongYards: number, acrossYards: number, steps = 24): LatLon[] {
  const count = Math.max(12, steps);
  const points: LatLon[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * Math.PI * 2;
    const along = alongYards * Math.cos(t);
    const across = acrossYards * Math.sin(t);
    const moved = destinationPoint(center, bearing, along);
    points.push(destinationPoint(moved, bearing + 90, across));
  }
  const first = points[0];
  if (first) points.push(first);
  return points;
}

export interface MapProjection {
  toXY: (point: LatLon) => { x: number; y: number };
  toLatLon: (x: number, y: number) => LatLon;
}

/** Fits points into a rectangle. Y grows downward so a map on screen matches north-up. */
export function projectPoints(points: readonly LatLon[], width: number, height: number, pad = 16): MapProjection {
  const usable = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
  const lats = usable.map((point) => point.lat);
  const lons = usable.map((point) => point.lon);
  const minLat = lats.length ? Math.min(...lats) : 0;
  const maxLat = lats.length ? Math.max(...lats) : 1;
  const minLon = lons.length ? Math.min(...lons) : 0;
  const maxLon = lons.length ? Math.max(...lons) : 1;
  const spanLat = maxLat - minLat || 0.0001;
  const spanLon = maxLon - minLon || 0.0001;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const scale = Math.min(innerW / spanLon, innerH / spanLat);
  const offsetX = pad + (innerW - spanLon * scale) / 2;
  const offsetY = pad + (innerH - spanLat * scale) / 2;
  return {
    toXY: (point) => ({
      x: offsetX + (point.lon - minLon) * scale,
      y: offsetY + (maxLat - point.lat) * scale,
    }),
    toLatLon: (x, y) => ({
      lon: minLon + (x - offsetX) / scale,
      lat: maxLat - (y - offsetY) / scale,
    }),
  };
}
