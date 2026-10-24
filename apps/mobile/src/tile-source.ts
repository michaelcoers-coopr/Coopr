/**
 * Imagery sits behind the hole drawing.
 * The vector source is the fallback. A provider stays unset until satellite
 * research picks a licensed one. This module does not fetch tiles.
 */
export interface MapTileSource {
  id: string;
  /** Null while no imagery vendor is chosen. */
  provider: string | null;
  kind: 'vector' | 'raster';
}

export const VECTOR_TILE_SOURCE: MapTileSource = {
  id: 'vector',
  provider: null,
  kind: 'vector',
};

/** True when the map should draw its own shapes. A named raster provider is not implemented here. */
export function tileSourceDrawsVectors(source: MapTileSource | null | undefined): boolean {
  if (source == null) return true;
  return source.provider == null || source.kind === 'vector';
}
