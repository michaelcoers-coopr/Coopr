import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SHEET_BALL,
  SHEET_BALL_BODY,
  SHEET_BALL_BODY_EDGE,
  SHEET_BALL_BODY_LIT,
  SHEET_BALL_CLEAR_Y,
  SHEET_BALL_GLOW_ELLIPSE,
  SHEET_BALL_LIME,
  SHEET_BALL_LIME_ON_TYPE,
  SHEET_BALL_PAINT_TOP,
  SHEET_BALL_SHADOW,
  SHEET_BALL_STAGE,
  SHEET_BALL_TEXT,
  SHEET_BALL_WELL,
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
  it('packs dimples on a hex lattice and crops the ball at the sheet edge', () => {
    const seeds = hexDimpleSeeds(SHEET_BALL.spacing);
    const offset = seeds[4];
    expect(offset).toBeTruthy();
    expect(Math.hypot(offset!.x, offset!.y)).toBeCloseTo(SHEET_BALL.spacing, 5);
    expect(SHEET_BALL.ball.cy).toBeGreaterThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.ball.cy - SHEET_BALL.ball.r).toBeLessThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.dimple * 2).toBeLessThan(SHEET_BALL.spacing);
    expect(SHEET_BALL.viewBox.h).toBe(SHEET_BALL_STAGE);
  });

  it('keeps a readable cap under the type, with dimples in the lime rim', () => {
    const crown = ballCrownFromBottom();
    expect(crown).toBeGreaterThanOrEqual(55);
    expect(crown).toBeLessThanOrEqual(70);
    expect(crown).toBeLessThanOrEqual(SHEET_BALL_TEXT.closedPx);
    expect(crown).toBeLessThanOrEqual(SHEET_BALL_TEXT.openPx);
    expect(SHEET_BALL_PAINT_TOP).toBeLessThan(SHEET_BALL_TEXT.closedPx);
    expect(SHEET_BALL_PAINT_TOP).toBeLessThan(SHEET_BALL_TEXT.openPx);
    expect(SHEET_BALL_CLEAR_Y).toBe(SHEET_BALL_STAGE - SHEET_BALL_PAINT_TOP);
    expect(SHEET_BALL_STAGE - SHEET_BALL_CLEAR_Y).toBeLessThanOrEqual(SHEET_BALL_TEXT.openPx);
    const glowTop = SHEET_BALL_STAGE - (SHEET_BALL_GLOW_ELLIPSE.cy - SHEET_BALL_GLOW_ELLIPSE.ry);
    expect(glowTop).toBeLessThanOrEqual(SHEET_BALL_PAINT_TOP);
    expect(glowTop).toBeLessThan(crown);
    expect(SHEET_BALL.dimple * 2).toBeGreaterThanOrEqual(9);
    const row = SHEET_BALL.spacing * Math.sqrt(3);
    expect(crown / row).toBeGreaterThanOrEqual(2);
    expect(SHEET_BALL_PAINT_TOP / row).toBeGreaterThanOrEqual(1);
  });

  it('keeps white type above AA on the ball, the well, and a lime catch', () => {
    for (const fill of [SHEET_BALL_BODY, SHEET_BALL_BODY_LIT, SHEET_BALL_BODY_EDGE, SHEET_BALL_WELL, SHEET_BALL_SHADOW]) {
      expect(contrastRatio('#FFFFFF', fill)).toBeGreaterThanOrEqual(4.5);
    }
    const catchFill = mixHex(SHEET_BALL_LIME, SHEET_BALL_WELL, SHEET_BALL_LIME_ON_TYPE);
    const lift = mixHex(SHEET_BALL_LIME, SHEET_BALL_BODY, SHEET_BALL_LIME_ON_TYPE);
    expect(contrastRatio('#FFFFFF', catchFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', lift)).toBeGreaterThanOrEqual(4.5);
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
    expect(html).toContain(SHEET_BALL_WELL);
    expect(html).toContain(SHEET_BALL_SHADOW);
    expect(html).not.toContain('#FFFFFF');
    expect(html).not.toContain('#6E685E');
    expect(html).not.toContain('#E6E1D6');
    expect(html).not.toContain('#040A18');
    expect(html.match(/<circle/g)?.length).toBeGreaterThan(12);
    expect(html).toContain('<ellipse');
    expect(html).not.toContain('data:image');
    expect(html.length).toBeLessThan(12000);
  });
});
