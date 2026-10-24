import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AERIAL_CREDIT, AERIAL_CREDIT_SHORT, AERIAL_CREDIT_TIGHT, aerialMapCredit } from '../src/aerial/project';
import { MAP_LAYER, aerialLayerTree } from '../src/aerial/map-layers';

function zIndexOf(html: string, layer: string): number {
  const tag = html.match(new RegExp(`<(?:div|svg)[^>]*data-layer="${layer}"[^>]*>`));
  expect(tag, layer).toBeTruthy();
  const value = tag?.[0].match(/z-index:(\d+)/);
  expect(value, layer).toBeTruthy();
  return Number(value?.[1]);
}

describe('aerial layer order', () => {
  it('paints the vector overlay above the photo', () => {
    const html = renderToStaticMarkup(aerialLayerTree());
    expect(html).toContain('data-layer="photo"');
    expect(html).toContain('data-layer="overlay"');
    expect(html.indexOf('data-layer="photo"')).toBeLessThan(html.indexOf('data-layer="overlay"'));
    const photo = zIndexOf(html, 'photo');
    const overlay = zIndexOf(html, 'overlay');
    expect(photo).toBe(MAP_LAYER.photo);
    expect(overlay).toBe(MAP_LAYER.overlay);
    expect(overlay).toBeGreaterThan(photo);
    expect(MAP_LAYER.credit).toBeGreaterThan(overlay);
    expect(html).toContain('position:relative');
    expect(html).toContain('position:absolute');
  });

  it('keeps the hole map on those same layers', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/hole-map-canvas.tsx'), 'utf8');
    expect(source).toContain('zIndex: MAP_LAYER.photo');
    expect(source).toContain('zIndex: MAP_LAYER.overlay');
    expect(source).toContain("position: 'relative'");
    expect(source).toContain('styles.photoLayer');
    expect(source).toContain('styles.vectorOverlay');
    expect(source).toContain('aerialMapCredit');
    expect(source).not.toContain(AERIAL_CREDIT);
    expect(source).toContain('MAP_CREDIT_LEFT = 116');
    expect(source).toContain("backgroundColor: 'rgba(2,6,14,0.92)'");
    expect(source).toContain('borderRadius: 7');
    expect(source).toContain('zIndex: MAP_LAYER.credit');
    expect(source).not.toContain('right: 10, maxWidth');
    const flag = source.indexOf("fill={colors.red}");
    const oval = source.lastIndexOf('ovalfill');
    expect(flag).toBeGreaterThan(oval);
  });
});

describe('map credit', () => {
  it('keeps the full sentence for More and the course screen, and a single map line', () => {
    expect(AERIAL_CREDIT).toBe('Imagery: USDA NAIP, stylized. Outlines © OpenStreetMap contributors');
    expect(AERIAL_CREDIT_SHORT).toBe('© OpenStreetMap contributors');
    expect(AERIAL_CREDIT_TIGHT).toBe('© OpenStreetMap');
    expect(AERIAL_CREDIT_SHORT).not.toContain('\n');
    expect(AERIAL_CREDIT_TIGHT).not.toContain('\n');
    expect(AERIAL_CREDIT_SHORT.length).toBeLessThan(AERIAL_CREDIT.length);
    expect(AERIAL_CREDIT).toContain('NAIP');
    expect(AERIAL_CREDIT).toContain('stylized');
    expect(AERIAL_CREDIT).toContain(AERIAL_CREDIT_SHORT);
    expect(aerialMapCredit(390 - 116 - 104 - 12)).toBe(AERIAL_CREDIT_SHORT);
    expect(aerialMapCredit(120)).toBe(AERIAL_CREDIT_TIGHT);
    const rendered = renderToStaticMarkup(createElement('span', null, aerialMapCredit(200)));
    expect(rendered).toBe(`<span>${AERIAL_CREDIT_SHORT}</span>`);
  });
});
