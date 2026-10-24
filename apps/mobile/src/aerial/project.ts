import type { LatLon } from '@coopr/domain';
import type { MapProjection } from '@coopr/engine';

/** Same radius as `localMeters()` in hole-fit.ts. */
const EARTH_RADIUS_M = 6_371_000;

/** Affine residual at the image corners stays inside this. A fix past it is off the picture. */
const ON_IMAGE_SLACK_PX = 1;

export const AERIAL_TOLERANCE_PX = 0.25;

/** Shown on More and the course screen. The picture is stylized NAIP, not current conditions. */
export const AERIAL_CREDIT = 'Imagery: USDA NAIP, stylized. Outlines © OpenStreetMap contributors';

/**
 * One line on the map. ODbL wants the contributors named, and this is the
 * line that fits above Score and Mark. NAIP and "stylized" stay on More
 * and the course screen, in AERIAL_CREDIT.
 */
export const AERIAL_CREDIT_SHORT = '© OpenStreetMap contributors';

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
  hole: 1 | 2;
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

const HOLE_1_TESTS: readonly AerialTestPoint[] = [
  { name: 'tee', lat: 47.1162422, lng: -122.2383395, expectedPx: [411.135, 1165.22] },
  { name: 'green_center', lat: 47.11234509, lng: -122.23777439, expectedPx: [411.135, 397.18] },
  { name: 'pin', lat: 47.1123305, lng: -122.2377775, expectedPx: [411.83, 394.374] },
  { name: 'image_top_left_corner', lat: 47.11053621, lng: -122.23442652, expectedPx: [0.019, -0.009] },
  { name: 'image_bottom_right_corner', lat: 47.11870951, lng: -122.24146613, expectedPx: [780.019, 1687.991] },
];

const HOLE_2_TESTS: readonly AerialTestPoint[] = [
  { name: 'tee', lat: 47.1121898, lng: -122.23713, expectedPx: [393.863, 1165.22] },
  { name: 'green_center', lat: 47.11123312, lng: -122.2390419, expectedPx: [393.861, 397.18] },
  { name: 'pin', lat: 47.1112259, lng: -122.239029, expectedPx: [388.625, 398.524] },
  { name: 'image_top_left_corner', lat: 47.11006904, lng: -122.23931196, expectedPx: [-0.008, 0.003] },
  { name: 'image_bottom_right_corner', lat: 47.11349719, lng: -122.23653311, expectedPx: [779.992, 1688.003] },
];

/** High Cedars holes 1 and 2. `matrix_px_per_meter` is copied verbatim from aerials.json. */
export const HIGH_CEDARS_AERIALS: readonly AerialGeoref[] = [
  {
    hole: 1,
    widthPx: 780,
    heightPx: 1688,
    centerLat: 47.114622914,
    centerLng: -122.237946056,
    m00: -1.7606567382416216,
    m01: -0.17374298157126253,
    m10: -0.17428527541260733,
    m11: 1.7551784120775813,
    teePx: [411.135, 1165.22],
    greenPx: [411.135, 397.18],
    tests: HOLE_1_TESTS,
  },
  {
    hole: 2,
    widthPx: 780,
    heightPx: 1688,
    centerLat: 47.111783122,
    centerLng: -122.237922578,
    m00: -2.5310340211743463,
    m01: 3.4424974229156238,
    m10: 3.453243427659924,
    m11: 2.5231578036393865,
    teePx: [393.863, 1165.22],
    greenPx: [393.861, 397.18],
    tests: HOLE_2_TESTS,
  },
];

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

/** One scale and one origin, shared by the JPEG and every overlay point. */
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
