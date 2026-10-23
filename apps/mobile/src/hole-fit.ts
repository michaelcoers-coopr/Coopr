import type { LatLon } from '@coopr/domain';

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
