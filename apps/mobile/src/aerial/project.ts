import type { LatLon } from '@coopr/domain';
import type { MapProjection } from '@coopr/engine';
import { HIGH_CEDARS_AERIAL_ROWS } from './high-cedars-georef';

/** Same radius as `localMeters()` in hole-fit.ts. */
const EARTH_RADIUS_M = 6_371_000;

/** Affine residual at the image corners stays inside this. A fix past it is off the picture. */
const ON_IMAGE_SLACK_PX = 1;

export const AERIAL_TOLERANCE_PX = 0.25;

/** Imagery line on an aerial hole, and on More and the course screen. */
export const AERIAL_IMAGERY_CREDIT = 'Imagery: USDA NAIP, 2023';

/** The picture is enhanced. It is not a live true-colour photo. */
export const AERIAL_DISCLOSURE = 'Stylized and enhanced, not true-colour, not current conditions';

/** Shown on More and the course screen. The picture is stylized NAIP, not current conditions. */
export const AERIAL_CREDIT = `${AERIAL_IMAGERY_CREDIT}. ${AERIAL_DISCLOSURE}. Outlines © OpenStreetMap contributors`;

/**
 * ODbL line on a vector map. The contributors form is used when the gap can
 * hold it. Otherwise the map uses the shorter line. An aerial uses
 * aerialPhotoCredit(), so NAIP and the disclosure sit on the picture.
 */
export const AERIAL_CREDIT_SHORT = '© OpenStreetMap contributors';

/** Shorter ODbL line. Same meaning, for a narrow gap beside the Score tile. */
export const AERIAL_CREDIT_TIGHT = '© OpenStreetMap';

/**
 * Width of the contributors line at the map's 10px face, plus a little spare.
 * On the 390px web export the glyphs ran about 155px before the pill padding.
 */
const MAP_CREDIT_FULL_PX = 156;

/** The on-map credit that fits in `availablePx` on one line. Vector holes use this. */
export function aerialMapCredit(availablePx: number): string {
  if (Number.isFinite(availablePx) && availablePx >= MAP_CREDIT_FULL_PX) return AERIAL_CREDIT_SHORT;
  return AERIAL_CREDIT_TIGHT;
}

/** Three lines on a hole that is showing an aerial. The strings are the required credits. */
export function aerialPhotoCredit(): readonly string[] {
  return [AERIAL_IMAGERY_CREDIT, AERIAL_CREDIT_SHORT, AERIAL_DISCLOSURE];
}

/** quality.json flags green_partly_hidden_by_trees on these holes only. */
const TREE_HIDDEN_HOLES = new Set([3, 7]);

/** Short note for a green the aerial only partly shows. Null on every other hole. */
export function aerialTreeNote(hole: number): string | null {
  if (!TREE_HIDDEN_HOLES.has(hole)) return null;
  return 'Green partly hidden by trees';
}

export interface AerialTestPoint {
  name: string;
  lat: number;
  lng: number;
  expectedPx: readonly [number, number];
}

/**
 * Local equirectangular affine for one stylized aerial.
 * Pixel origin is the top-left corner. The formula already emits RN/CSS pixel centers.
 * Do not add another half pixel, and do not rebuild the matrix from bearing and scale.
 */
export interface AerialGeoref {
  hole: number;
  widthPx: number;
  heightPx: number;
  centerLat: number;
  centerLng: number;
  m00: number;
  m01: number;
  m10: number;
  m11: number;
  teePx: readonly [number, number];
  greenPx: readonly [number, number];
  tests: readonly AerialTestPoint[];
}

/** High Cedars holes 1–18. `matrix_px_per_meter` is copied verbatim from aerials.json. */
export const HIGH_CEDARS_AERIALS: readonly AerialGeoref[] = HIGH_CEDARS_AERIAL_ROWS.map((row) => ({
  hole: row.hole,
  widthPx: row.widthPx,
  heightPx: row.heightPx,
  centerLat: row.centerLat,
  centerLng: row.centerLng,
  m00: row.m00,
  m01: row.m01,
  m10: row.m10,
  m11: row.m11,
  teePx: row.teePx,
  greenPx: row.greenPx,
  tests: row.tests.map((point) => ({
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    expectedPx: point.expectedPx,
  })),
}));

export function aerialGeoref(hole: number): AerialGeoref | null {
  return HIGH_CEDARS_AERIALS.find((item) => item.hole === hole) ?? null;
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function degrees(radiansValue: number): number {
  return (radiansValue * 180) / Math.PI;
}

/** East/north meters. Identical to `localMeters()` in hole-fit.ts. */
function localMeters(lat0: number, lng0: number, lat: number, lng: number): { east: number; north: number } {
  const meanLat = radians((lat0 + lat) / 2);
  return {
    north: radians(lat - lat0) * EARTH_RADIUS_M,
    east: radians(lng - lng0) * EARTH_RADIUS_M * Math.cos(meanLat),
  };
}

/** Image pixels. Top-left corner is (0, 0). Center pixel is (width/2, height/2). */
export function projectAerialPx(geo: AerialGeoref, lat: number, lng: number): { x: number; y: number } {
  const { east, north } = localMeters(geo.centerLat, geo.centerLng, lat, lng);
  return {
    x: geo.m00 * east + geo.m01 * north + geo.widthPx / 2,
    y: geo.m10 * east + geo.m11 * north + geo.heightPx / 2,
  };
}

/** Inverse of `projectAerialPx`. One equirectangular step, then the forward check closes the rest. */
export function invertAerialPx(geo: AerialGeoref, x: number, y: number): { lat: number; lng: number } {
  const det = geo.m00 * geo.m11 - geo.m01 * geo.m10;
  const dx = x - geo.widthPx / 2;
  const dy = y - geo.heightPx / 2;
  const east = (geo.m11 * dx - geo.m01 * dy) / det;
  const north = (-geo.m10 * dx + geo.m00 * dy) / det;
  const lat = geo.centerLat + degrees(north / EARTH_RADIUS_M);
  const lng = geo.centerLng + degrees(east / (EARTH_RADIUS_M * Math.cos(radians((geo.centerLat + lat) / 2))));
  return { lat, lng };
}

/** True when the fix lands on the picture, slack included for the affine residual at the corners. */
export function pointOnAerial(geo: AerialGeoref, point: LatLon): boolean {
  const px = projectAerialPx(geo, point.lat, point.lon);
  return px.x >= -ON_IMAGE_SLACK_PX && px.y >= -ON_IMAGE_SLACK_PX && px.x <= geo.widthPx + ON_IMAGE_SLACK_PX && px.y <= geo.heightPx + ON_IMAGE_SLACK_PX;
}

export type AerialFocus = 'tee' | 'green' | 'hole';

/** One scale and one origin, shared by the picture and every overlay point. */
export interface AerialView {
  scale: number;
  originX: number;
  originY: number;
}

/**
 * Full hole cover-fits the authored frame (tee near 69% of the height, green near 23.5% on a phone).
 * Tee and green zoom in on that same frame, then the pan is clamped so the picture still covers the view.
 */
export function aerialView(input: {
  imageWidth: number;
  imageHeight: number;
  viewWidth: number;
  viewHeight: number;
  focus: AerialFocus;
  tee: { x: number; y: number };
  green: { x: number; y: number };
}): AerialView {
  const cover = Math.max(input.viewWidth / input.imageWidth, input.viewHeight / input.imageHeight);
  const zoom = input.focus === 'hole' ? 1 : 1.55;
  const scale = cover * zoom;
  const drawnW = input.imageWidth * scale;
  const drawnH = input.imageHeight * scale;
  const focus = input.focus === 'tee' ? input.tee : input.focus === 'green' ? input.green : { x: input.imageWidth / 2, y: input.imageHeight / 2 };
  const targetX = input.viewWidth / 2;
  const targetY = input.focus === 'tee' ? input.viewHeight * 0.72 : input.focus === 'green' ? input.viewHeight * 0.38 : input.viewHeight / 2;
  const minX = Math.min(0, input.viewWidth - drawnW);
  const minY = Math.min(0, input.viewHeight - drawnH);
  return {
    scale,
    originX: Math.min(0, Math.max(minX, targetX - focus.x * scale)),
    originY: Math.min(0, Math.max(minY, targetY - focus.y * scale)),
  };
}

/** Screen point for an image pixel. The JPEG box uses this same scale and origin. */
export function aerialScreenPoint(view: AerialView, px: { x: number; y: number }): { x: number; y: number } {
  return { x: view.originX + px.x * view.scale, y: view.originY + px.y * view.scale };
}

/** Overlay projection. `toXY` and the image rectangle cannot disagree. */
export function aerialScreenProjection(geo: AerialGeoref, view: AerialView): MapProjection {
  return {
    toXY: (point) => aerialScreenPoint(view, projectAerialPx(geo, point.lat, point.lon)),
    toLatLon: (x, y) => {
      const hit = invertAerialPx(geo, (x - view.originX) / view.scale, (y - view.originY) / view.scale);
      return { lat: hit.lat, lon: hit.lng };
    },
  };
}
