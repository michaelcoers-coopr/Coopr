import { describe, expect, it } from 'vitest';
import { boxesOverlap, coachOpenHeight, coachPeekHeight, homeWordmark, insideFrame, playChrome, SCORE_TOAST_MS, type Insets } from '../src/design/round-chrome';

const phones: { width: number; height: number; safe: Insets }[] = [
  { width: 393, height: 852, safe: { top: 59, right: 0, bottom: 34, left: 0 } },
  { width: 375, height: 667, safe: { top: 20, right: 0, bottom: 0, left: 0 } },
];

describe('hole chrome', () => {
  it.each(phones)('keeps the pill, plate, toast, and menu apart at $width x $height', ({ width, height, safe }) => {
    const chrome = playChrome({ screenWidth: width, screenHeight: height, safe });
    for (const box of [chrome.pill, chrome.plate, chrome.toast, chrome.menu]) {
      expect(insideFrame(box, width, height, safe)).toBe(true);
    }
    expect(boxesOverlap(chrome.pill, chrome.plate)).toBe(false);
    expect(boxesOverlap(chrome.pill, chrome.toast)).toBe(false);
    expect(boxesOverlap(chrome.plate, chrome.toast)).toBe(false);
    expect(boxesOverlap(chrome.menu, chrome.pill)).toBe(false);
    expect(boxesOverlap(chrome.menu, chrome.plate)).toBe(false);
    expect(chrome.toast.w * chrome.toast.h).toBeLessThan(5000);
    expect(chrome.toast.y + chrome.toast.h / 2).toBeLessThan(height * 0.36);
    expect(chrome.menu.w).toBeGreaterThanOrEqual(44);
    expect(chrome.menu.h).toBeGreaterThanOrEqual(44);
    expect(chrome.coachPeek / height).toBeGreaterThanOrEqual(0.15);
    expect(chrome.coachPeek / height).toBeLessThanOrEqual(0.18);
    expect(chrome.coachOpen / height).toBeGreaterThan(0.4);
    expect(chrome.coachOpen / height).toBeLessThan(0.5);
    const word = homeWordmark({ screenWidth: width, safeTop: safe.top, safeLeft: safe.left });
    const pill = { x: safe.left + 12, y: safe.top + 12, w: width - 84, h: 44 };
    const wordBox = { x: word.left, y: word.top, w: Math.min(180, word.maxWidth), h: word.lineHeight * 2 };
    expect(boxesOverlap(pill, wordBox)).toBe(false);
    expect(word.lineHeight).toBeGreaterThanOrEqual(word.fontSize);
    expect(word.left).toBeGreaterThanOrEqual(safe.left);
  });

  it('sizes the coach sheet from the screen', () => {
    expect(coachPeekHeight(852)).toBe(136);
    expect(coachOpenHeight(852)).toBe(383);
    expect(SCORE_TOAST_MS).toBe(4000);
    expect(coachPeekHeight(667)).toBe(107);
  });
});
