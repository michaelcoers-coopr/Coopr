import { createElement, type CSSProperties, type ReactElement } from 'react';

/**
 * Paint order inside the hole map.
 * The photo is position:absolute. On the web that paints above an in-flow SVG
 * even when the SVG comes later, so the overlay has to be positioned too,
 * with a higher z-index. The frame stays a stacking context so neither layer
 * covers the HUD.
 */
export const MAP_LAYER = {
  photo: 0,
  overlay: 2,
  hits: 3,
  credit: 4,
} as const;

/** The photo and the vector overlay, in the same order the hole map draws them. */
export function aerialLayerTree(): ReactElement {
  const photo: CSSProperties = { position: 'absolute', inset: 0, zIndex: MAP_LAYER.photo };
  const overlay: CSSProperties = { position: 'relative', zIndex: MAP_LAYER.overlay };
  return createElement(
    'div',
    { 'data-map': 'frame', style: { position: 'relative', zIndex: 0 } },
    createElement('div', { 'data-layer': 'photo', style: photo }),
    createElement('svg', { 'data-layer': 'overlay', style: overlay }),
  );
}
