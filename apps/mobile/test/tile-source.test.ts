import { describe, expect, it } from 'vitest';
import { tileSourceDrawsVectors, VECTOR_TILE_SOURCE } from '../src/tile-source';

describe('tile source', () => {
  it('keeps a vector fallback and does not name an imagery provider', () => {
    expect(VECTOR_TILE_SOURCE.kind).toBe('vector');
    expect(VECTOR_TILE_SOURCE.provider).toBeNull();
    expect(tileSourceDrawsVectors(VECTOR_TILE_SOURCE)).toBe(true);
    expect(tileSourceDrawsVectors(null)).toBe(true);
    expect(tileSourceDrawsVectors({ id: 'later', provider: 'unpicked', kind: 'raster' })).toBe(false);
  });
});
