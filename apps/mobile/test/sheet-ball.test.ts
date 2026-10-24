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
  SHEET_BALL_OLIVE,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_SCRIM_TOP,
  SHEET_BALL_STAGE,
  SHEET_BALL_STROKE,
  SHEET_BALL_TEXT,
  ballCrownFromBottom,
  contrastRatio,
  mixHex,
  projectedDimples,
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
  it('projects hairline dimples on the cap and crops the ball at the sheet edge', () => {
    const dimples = projectedDimples();
    expect(dimples.length).toBeGreaterThan(40);
    expect(SHEET_BALL.ball.cy).toBeGreaterThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.ball.cy - SHEET_BALL.ball.r).toBeLessThan(SHEET_BALL.viewBox.h);
    expect(SHEET_BALL.dimple * 2).toBeLessThan(SHEET_BALL.spacing);
    expect(SHEET_BALL.viewBox.h).toBe(SHEET_BALL_STAGE);
    expect(SHEET_BALL_STROKE).toBe(1);
    expect(SHEET_BALL_LINE_OPACITY).toBeGreaterThanOrEqual(0.35);
    expect(SHEET_BALL_LINE_OPACITY).toBeLessThanOrEqual(0.45);
    const nearest = (cy: number) =>
      dimples.reduce((best, dimple) => {
        const score = Math.abs(dimple.cx - SHEET_BALL.ball.cx) + Math.abs(dimple.cy - cy);
        const bestScore = Math.abs(best.cx - SHEET_BALL.ball.cx) + Math.abs(best.cy - cy);
        return score < bestScore ? dimple : best;
      });
    const face = nearest(80);
    const crown = dimples.reduce((best, dimple) => (dimple.cy < best.cy ? dimple : best));
    const limb = dimples.reduce((best, dimple) => (Math.abs(dimple.cx - SHEET_BALL.ball.cx) > Math.abs(best.cx - SHEET_BALL.ball.cx) ? dimple : best));
    expect(face.opacity).toBeGreaterThanOrEqual(0.35);
    expect(face.opacity).toBeLessThanOrEqual(0.45);
    expect(crown.ry).toBeLessThan(face.ry);
    expect(limb.opacity).toBeLessThan(face.opacity);
    expect(limb.rx * limb.ry).toBeLessThan(face.rx * face.ry);
    expect(Math.max(...dimples.map((dimple) => dimple.opacity))).toBeLessThanOrEqual(0.45);
  });

  it('raises a curved lime dome wider than the sheet, and keeps type clear of the tabs and the scrim', () => {
    const crown = ballCrownFromBottom();
    expect(SHEET_BALL_DOME).toBeGreaterThanOrEqual(70);
    expect(SHEET_BALL_DOME).toBeLessThanOrEqual(90);
    expect(SHEET_BALL_FEATHER).toBeGreaterThanOrEqual(28);
    expect(SHEET_BALL_FEATHER).toBeLessThanOrEqual(34);
    expect(crown).toBe(SHEET_BALL_DOME);
    expect(SHEET_BALL_STAGE).toBe(SHEET_BALL_DOME + SHEET_BALL_FEATHER);
    expect(SHEET_BALL_GLOW_ELLIPSE.rx * 2).toBeGreaterThan(SHEET_BALL.viewBox.w);
    expect(SHEET_BALL_GLOW_ELLIPSE.cy - SHEET_BALL_GLOW_ELLIPSE.ry).toBeLessThan(0);
    expect(SHEET_BALL_TEXT.closedPx).toBeGreaterThanOrEqual(6);
    expect(SHEET_BALL_TEXT.openPx).toBeGreaterThan(SHEET_BALL_SCRIM_TOP);
    const play = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/play.tsx'), 'utf8');
    expect(play).toContain('marginTop: SHEET_BALL_TEXT.closedPx');
    expect(play).not.toContain("justifyContent: 'flex-end'");
    expect(play).toContain('paddingBottom: 64');
    const row = SHEET_BALL.spacing * Math.sqrt(3);
    expect(crown / row).toBeGreaterThanOrEqual(3);
  });

  it('keeps white type at 7:1 on the scrim over the brightest crest', () => {
    for (const under of [SHEET_BALL_CREST, SHEET_BALL_LIME, SHEET_BALL_OLIVE]) {
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
    expect(html.match(/<ellipse/g)?.length ?? 0).toBeGreaterThan(12);
    expect(html.length).toBeLessThan(60000);
    expect(source).toContain('mixBlendMode: SHEET_BALL_GLOW_BLEND');
    expect(SHEET_BALL_GLOW_BLEND).toBe('screen');
    expect(source).toContain('projectedDimples');
    expect(source).toContain('SHEET_BALL_OLIVE');
    expect(source).toContain('gradientUnits="userSpaceOnUse"');
    expect(source).not.toContain('Pattern');
    expect(source).toContain('fill="none"');
    expect(source).not.toContain('data:image');
  });
});
