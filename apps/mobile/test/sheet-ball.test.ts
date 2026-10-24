import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SHEET_BALL, SHEET_BALL_LIME, hexDimpleSeeds, sheetBallMarks, type BallMark } from '../src/design/sheet-ball-geometry';

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
  it('packs dimples on a hex lattice and crops the ball at the sheet edge', () => {
    const seeds = hexDimpleSeeds(SHEET_BALL.spacing);
    const offset = seeds[4];
    expect(offset).toBeTruthy();
    expect(Math.hypot(offset!.x, offset!.y)).toBeCloseTo(SHEET_BALL.spacing, 5);
    expect(SHEET_BALL.ball.cy).toBeGreaterThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.ball.cy - SHEET_BALL.ball.r).toBeLessThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.dimple * 2).toBeLessThan(SHEET_BALL.spacing);
  });

  it('renders the glow, the lime rim, and a dimple with a shadow and a highlight', () => {
    const marks = sheetBallMarks();
    const html = renderToStaticMarkup(
      createElement(
        'svg',
        { viewBox: `0 0 ${SHEET_BALL.viewBox.w} ${SHEET_BALL.viewBox.h}`, role: 'img', 'aria-label': 'Golf ball' },
        marks.map((mark) => markElement(mark)),
      ),
    );
    expect(html).toContain('<svg');
    expect(html).toContain(SHEET_BALL_LIME);
    expect(html).toContain('#6E685E');
    expect(html).toContain('#FFFFFF');
    expect(html.match(/<circle/g)?.length).toBeGreaterThan(12);
    expect(html).toContain('<ellipse');
    expect(html).not.toContain('data:image');
    expect(html.length).toBeLessThan(12000);
  });
});
