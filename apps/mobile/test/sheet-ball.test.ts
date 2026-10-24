import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SHEET_BALL,
  SHEET_BALL_CREST,
  SHEET_BALL_DOME,
  SHEET_BALL_FEATHER,
  SHEET_BALL_GLOW_BLEND,
  SHEET_BALL_GLOW_ELLIPSE,
  SHEET_BALL_LIME,
  SHEET_BALL_LINE,
  SHEET_BALL_LINE_OPACITY,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_STAGE,
  SHEET_BALL_STROKE,
  SHEET_BALL_TEXT,
  ballCrownFromBottom,
  contrastRatio,
  hexDimpleSeeds,
  mixHex,
  sheetBallMarks,
  type BallMark,
} from '../src/design/sheet-ball-geometry';

function markElement(mark: BallMark) {
  return createElement(mark.tag, {
    key: `${mark.tag}-${mark.cx}-${mark.cy}-${mark.r ?? mark.rx}`,
    cx: mark.cx,
    cy: mark.cy,
    r: mark.r,
    rx: mark.rx,
    ry: mark.ry,
    fill: mark.fill,
    stroke: mark.stroke,
    strokeWidth: mark.strokeWidth,
    strokeOpacity: mark.strokeOpacity,
    fillOpacity: mark.fillOpacity,
  });
}

describe('sheet ball', () => {
  it('packs hairline dimples on a hex lattice and crops the ball at the sheet edge', () => {
    const seeds = hexDimpleSeeds(SHEET_BALL.spacing);
    const offset = seeds[4];
    expect(offset).toBeTruthy();
    expect(Math.hypot(offset!.x, offset!.y)).toBeCloseTo(SHEET_BALL.spacing, 5);
    expect(SHEET_BALL.ball.cy).toBeGreaterThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.ball.cy - SHEET_BALL.ball.r).toBeLessThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.dimple * 2).toBeLessThan(SHEET_BALL.spacing);
    expect(SHEET_BALL.viewBox.h).toBe(SHEET_BALL_STAGE);
    expect(SHEET_BALL_STROKE).toBe(1);
    expect(SHEET_BALL_LINE_OPACITY).toBeGreaterThanOrEqual(0.35);
    expect(SHEET_BALL_LINE_OPACITY).toBeLessThanOrEqual(0.55);
  });

  it('raises a lime dome with a feather, and keeps the cap on that dome', () => {
    const crown = ballCrownFromBottom();
    expect(SHEET_BALL_DOME).toBeGreaterThanOrEqual(70);
    expect(SHEET_BALL_DOME).toBeLessThanOrEqual(90);
    expect(SHEET_BALL_FEATHER).toBeGreaterThanOrEqual(28);
    expect(SHEET_BALL_FEATHER).toBeLessThanOrEqual(34);
    expect(crown).toBe(SHEET_BALL_DOME);
    expect(SHEET_BALL_STAGE).toBe(SHEET_BALL_DOME + SHEET_BALL_FEATHER);
    expect(SHEET_BALL_GLOW_ELLIPSE.ry).toBe(SHEET_BALL_DOME);
    const ellipseTop = SHEET_BALL_GLOW_ELLIPSE.cy - SHEET_BALL_GLOW_ELLIPSE.ry;
    expect(ellipseTop).toBe(SHEET_BALL_FEATHER);
    expect(SHEET_BALL_TEXT.openPx).toBeGreaterThanOrEqual(SHEET_BALL_DOME);
    expect(SHEET_BALL_TEXT.closedPx).toBeGreaterThan(40);
    expect(SHEET_BALL_TEXT.closedPx).toBeLessThan(SHEET_BALL_DOME);
    const row = SHEET_BALL.spacing * Math.sqrt(3);
    expect(crown / row).toBeGreaterThanOrEqual(3);
  });

  it('keeps white type at 7:1 on the scrim over the brightest crest', () => {
    for (const under of [SHEET_BALL_CREST, SHEET_BALL_LIME]) {
      const ink = mixHex(SHEET_BALL_SCRIM, under, SHEET_BALL_SCRIM_ALPHA);
      expect(contrastRatio('#FFFFFF', ink)).toBeGreaterThanOrEqual(7);
    }
  });

  it('renders a lime hill, a crest highlight, and hairline dimples', () => {
    const marks = sheetBallMarks();
    const html = renderToStaticMarkup(
      createElement(
        'svg',
        { viewBox: `0 0 ${SHEET_BALL.viewBox.w} ${SHEET_BALL.viewBox.h}`, role: 'img', 'aria-label': 'Golf ball' },
        marks.map((mark) => markElement(mark)),
      ),
    );
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/design/sheet-ball.tsx'), 'utf8');
    expect(html).toContain('<svg');
    expect(html).toContain(SHEET_BALL_LIME);
    expect(html).toContain(SHEET_BALL_CREST);
    expect(html).toContain(SHEET_BALL_LINE);
    expect(html).toContain('fill="none"');
    expect(html).not.toContain('#173024');
    expect(html).not.toContain('#07140E');
    expect(html).not.toContain('#6E685E');
    expect(html).not.toContain('data:image');
    expect(html.match(/<circle/g)?.length).toBeGreaterThan(4);
    expect(html).toContain('<ellipse');
    expect(html.length).toBeLessThan(12000);
    expect(source).toContain('mixBlendMode: SHEET_BALL_GLOW_BLEND');
    expect(SHEET_BALL_GLOW_BLEND).toBe('screen');
    expect(source).toContain('Pattern');
    expect(source).toContain('hexDimpleSeeds');
    expect(source).toContain('fill="none"');
    expect(source).not.toContain('data:image');
  });
});
