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
  SHEET_BALL_LIME,
  SHEET_BALL_LIME_BAND,
  SHEET_BALL_LINE,
  SHEET_BALL_LINE_OPACITY,
  SHEET_BALL_LOBE_RADIUS,
  SHEET_BALL_OLIVE,
  SHEET_BALL_OLIVE_DEEP,
  SHEET_BALL_OLIVE_PORTION,
  SHEET_BALL_RIM_OPACITY,
  SHEET_BALL_SCRIM,
  SHEET_BALL_SCRIM_ALPHA,
  SHEET_BALL_SCRIM_TOP,
  SHEET_BALL_SCROLL_FADE,
  SHEET_BALL_STROKE,
  SHEET_BALL_TEXT,
  ballChordWidth,
  ballCrownFromBottom,
  contrastRatio,
  mixHex,
  oliveHeight,
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
  it('projects latitude arcs on a cap wider than the sheet', () => {
    const dimples = projectedDimples();
    const { ball, viewBox } = SHEET_BALL;
    expect(dimples.length).toBeGreaterThan(40);
    expect(ball.r).toBeGreaterThanOrEqual(230);
    expect(ball.r).toBeLessThanOrEqual(280);
    expect(ball.cy).toBeGreaterThan(viewBox.h);
    expect(ball.cy - ball.r).toBeLessThan(viewBox.h);
    expect(ballChordWidth()).toBeGreaterThan(viewBox.w);
    expect(ballCrownFromBottom()).toBe(SHEET_BALL_DOME);
    expect(SHEET_BALL_STROKE).toBe(1);
    expect(SHEET_BALL_LINE_OPACITY).toBeGreaterThanOrEqual(0.35);
    expect(SHEET_BALL_LINE_OPACITY).toBeLessThanOrEqual(0.5);
    expect(SHEET_BALL_RIM_OPACITY).toBeCloseTo(0.6, 5);
    const top = dimples.reduce((best, dimple) => (dimple.cy < best.cy ? dimple : best));
    expect(Math.abs(top.cx - ball.cx)).toBeLessThan(50);
    const side = dimples.filter((dimple) => Math.abs(dimple.cx - ball.cx) > 130).reduce((best, dimple) => (dimple.cy < best.cy ? dimple : best));
    expect(side.cy).toBeGreaterThan(top.cy + 8);
    const lats = [...new Set(dimples.map((dimple) => dimple.lat.toFixed(3)))];
    const bowed = lats
      .map((lat) => dimples.filter((dimple) => dimple.lat.toFixed(3) === lat))
      .filter((row) => Math.max(...row.map((dimple) => dimple.cx)) - Math.min(...row.map((dimple) => dimple.cx)) > 200)
      .find((row) => {
        const mid = row.reduce((best, dimple) => (Math.abs(dimple.cx - ball.cx) < Math.abs(best.cx - ball.cx) ? dimple : best));
        const edge = row.reduce((best, dimple) => (Math.abs(dimple.cx - ball.cx) > Math.abs(best.cx - ball.cx) ? dimple : best));
        return edge.cy > mid.cy + 12;
      });
    expect(bowed).toBeTruthy();
    const face = dimples.reduce((best, dimple) => {
      const score = Math.abs(dimple.cx - ball.cx) + Math.abs(dimple.cy - (viewBox.h - 60));
      const bestScore = Math.abs(best.cx - ball.cx) + Math.abs(best.cy - (viewBox.h - 60));
      return score < bestScore ? dimple : best;
    });
    const limb = dimples.reduce((best, dimple) => (Math.abs(dimple.cx - ball.cx) > Math.abs(best.cx - ball.cx) ? dimple : best));
    expect(face.opacity).toBeGreaterThanOrEqual(0.35);
    expect(face.opacity).toBeLessThanOrEqual(0.5);
    expect(limb.opacity).toBeLessThan(face.opacity);
    expect(limb.ry).toBeLessThan(limb.rx);
    expect(Math.max(...dimples.map((dimple) => dimple.opacity))).toBeLessThanOrEqual(0.5);
  });

  it('fills the bottom of the sheet with lime and keeps type clear of the tabs', () => {
    expect(SHEET_BALL_LIME_BAND).toBeGreaterThanOrEqual(100);
    expect(SHEET_BALL_LIME_BAND).toBeLessThanOrEqual(120);
    expect(SHEET_BALL_LOBE_RADIUS * 2).toBeLessThan(SHEET_BALL.viewBox.w);
    expect(SHEET_BALL_OLIVE).toBe('#2e4a12');
    expect(SHEET_BALL_OLIVE_DEEP).toBe('#1c2e0f');
    expect(SHEET_BALL_OLIVE_PORTION).toBeCloseTo(0.45, 5);
    expect(oliveHeight(540)).toBeGreaterThanOrEqual(Math.round(540 * 0.45));
    expect(oliveHeight(176)).toBeGreaterThan(SHEET_BALL_LIME_BAND);
    expect(SHEET_BALL_TEXT.closedPx).toBeGreaterThanOrEqual(6);
    expect(SHEET_BALL_TEXT.openPx + SHEET_BALL_SCROLL_FADE).toBeGreaterThan(SHEET_BALL_SCRIM_TOP);
    expect(SHEET_BALL_TEXT.openPx).toBeGreaterThan(SHEET_BALL_LIME_BAND - SHEET_BALL_SCROLL_FADE);
    expect(SHEET_BALL_SCROLL_FADE).toBe(48);
    const play = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/play.tsx'), 'utf8');
    expect(play).toContain('marginTop: SHEET_BALL_TEXT.closedPx');
    expect(play).not.toContain('!sheetOpen ? { marginTop: SHEET_BALL_TEXT.closedPx }');
    expect(play).not.toContain("justifyContent: 'flex-end'");
    expect(play).toContain('paddingBottom: 96');
    expect(play).toContain('paddingTop: SHEET_BALL_SCROLL_FADE');
    expect(play).toContain('maskImage:');
    expect(play).toContain('SHEET_BALL_SCROLL_FADE}px');
  });

  it('keeps white type at 7:1 on the scrim over the brightest crest', () => {
    for (const under of [SHEET_BALL_CREST, SHEET_BALL_LIME, SHEET_BALL_OLIVE, SHEET_BALL_OLIVE_DEEP]) {
      const ink = mixHex(SHEET_BALL_SCRIM, under, SHEET_BALL_SCRIM_ALPHA);
      expect(contrastRatio('#FFFFFF', ink)).toBeGreaterThanOrEqual(7);
    }
    expect(contrastRatio('#FFFFFF', SHEET_BALL_OLIVE)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio('#FFFFFF', SHEET_BALL_OLIVE_DEEP)).toBeGreaterThanOrEqual(7);
  });

  it('renders a full-width lime hill, corner crests, a rim, and hairline dimples', () => {
    const marks = sheetBallMarks();
    const html = renderToStaticMarkup(
      createElement(
        'svg',
        { viewBox: `0 0 ${SHEET_BALL.viewBox.w} ${SHEET_BALL.viewBox.h}`, role: 'img', 'aria-label': 'Golf ball' },
        marks.map((mark) => markElement(mark)),
      ),
    );
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/design/sheet-ball.tsx'), 'utf8');
    expect(html).toContain(SHEET_BALL_LIME);
    expect(html).toContain(SHEET_BALL_CREST);
    expect(html).toContain(SHEET_BALL_OLIVE);
    expect(html).toContain(SHEET_BALL_OLIVE_DEEP);
    expect(html).toContain(SHEET_BALL_LINE);
    expect(html).toContain('fill="none"');
    expect(html).not.toContain('#173024');
    expect(html).not.toContain('#07140E');
    expect(html).not.toContain('#6E685E');
    expect(html).not.toContain('data:image');
    expect(html.match(/<ellipse/g)?.length ?? 0).toBeGreaterThan(12);
    expect(html.match(/<circle/g)?.length ?? 0).toBeGreaterThan(0);
    expect(html.length).toBeLessThan(120000);
    expect(source).not.toContain('mixBlendMode');
    expect(source).toContain('SHEET_BALL_LOBE_RADIUS');
    expect(source).toContain('stopOpacity="1"');
    expect(source).toContain('projectedDimples');
    expect(source).toContain('SHEET_BALL_OLIVE_DEEP');
    expect(source).toContain('gradientUnits="userSpaceOnUse"');
    expect(source).toContain('SHEET_BALL_RIM_OPACITY');
    expect(source).toContain('rotate(');
    expect(source).not.toContain('Pattern');
    expect(source).toContain('fill="none"');
    expect(source).not.toContain('data:image');
  });
});
