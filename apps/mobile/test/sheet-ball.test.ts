import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SHEET_BALL_CAP_HEIGHT,
  SHEET_BALL_CROWN,
  SHEET_BALL_OLIVE_OPEN,
  SHEET_BALL_SCROLL_FADE,
  SHEET_BALL_SCROLL_FADE_BOTTOM,
  SHEET_BALL_TEXT,
  oliveHeight,
} from '../src/design/sheet-ball-geometry';

const here = dirname(fileURLToPath(import.meta.url));

/** Canvas size of a VP8X WebP (the alpha photo uses that container). */
function webpSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('VP8X');
  const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
  const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
  return { width, height };
}

describe('sheet ball', () => {
  it('uses the doubled photo cap and keeps the crown under the type', () => {
    const asset = readFileSync(join(here, '../assets/images/ball-lime.webp'));
    expect(webpSize(asset)).toEqual({ width: 720, height: 154 });
    expect(SHEET_BALL_CROWN).toBe(78);
    expect(SHEET_BALL_CAP_HEIGHT).toBe(80);
    expect(oliveHeight(176)).toBe(176);
    expect(oliveHeight(540)).toBe(SHEET_BALL_OLIVE_OPEN);
    expect(oliveHeight(200)).toBe(200);
    expect(oliveHeight(400)).toBe(310);
    expect(SHEET_BALL_TEXT.openPx).toBeGreaterThanOrEqual(98);
    expect(SHEET_BALL_TEXT.openPx).toBeGreaterThan(SHEET_BALL_CROWN + 8);
    expect(SHEET_BALL_TEXT.closedPx).toBeGreaterThanOrEqual(6);
  });

  it('keeps the mic, the tab gap, and the open-sheet fades', () => {
    expect(SHEET_BALL_SCROLL_FADE).toBe(48);
    expect(SHEET_BALL_SCROLL_FADE_BOTTOM).toBe(8);
    expect(SHEET_BALL_SCROLL_FADE_BOTTOM).toBeLessThan(12);
    const play = readFileSync(join(here, '../app/play.tsx'), 'utf8');
    expect(play).toContain('marginTop: SHEET_BALL_TEXT.closedPx');
    expect(play).not.toContain('!sheetOpen ? { marginTop: SHEET_BALL_TEXT.closedPx }');
    expect(play).toContain('marginBottom: SHEET_BALL_TEXT.openPx');
    expect(play).toContain('paddingBottom: 48');
    expect(play).toContain('paddingTop: SHEET_BALL_SCROLL_FADE');
    expect(play).toContain('maskImage:');
    expect(play).toContain('SHEET_BALL_SCROLL_FADE}px');
    expect(play).toContain('SHEET_BALL_SCROLL_FADE_BOTTOM}px');
    expect(play).toContain('styles.micButton');
    expect(play).toContain('Dictate to caddie');
    expect(play).toContain('width: 44');
    expect(play).toContain('width: 28');
    expect(play).toContain('zIndex: 6');
    expect(play).toContain('pointerEvents="box-none"');
    expect(play).not.toContain('Talk to the caddie');
    expect(play).not.toContain('styles.micRow');
    const source = readFileSync(join(here, '../src/design/sheet-ball.tsx'), 'utf8');
    expect(source).toContain('ball-lime.webp');
    expect(source).toContain('#0A0E04');
    expect(source).toContain('#243008');
    expect(source).toContain('#3C4E0C');
    expect(source).toContain('#A4CC3A');
    expect(source).toContain('#BEF546');
    expect(source).toContain('stopOpacity="1"');
    expect(source).toContain('#8AC926');
    expect(source).toContain('#A0E132');
    expect(source).toContain('stopOpacity="0.88"');
    expect(source).toContain('resizeMode="stretch"');
    expect(source).toContain('fadeDuration={0}');
    expect(source).toContain('pointerEvents="none"');
    expect(source).not.toContain('projectedDimples');
    expect(source).not.toContain('BallShimmer');
    expect(source).not.toContain('SheetCap');
    expect(source).not.toContain('mixBlendMode');
  });
});
