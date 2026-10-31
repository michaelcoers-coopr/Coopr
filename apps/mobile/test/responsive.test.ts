import { describe, expect, it } from 'vitest';
import { actionDockHeight, homeSheetHeights, PHONE_SIZES, scorePanelBudget, snapHomeSheet, stickerHeight, tierFor } from '../src/design/responsive';

describe('responsive phone sizes', () => {
  it('names the four portrait tiers and treats landscape as short', () => {
    expect(tierFor(375)).toBe('se');
    expect(tierFor(390)).toBe('standard');
    expect(tierFor(393)).toBe('pro');
    expect(tierFor(430)).toBe('large');
    expect(PHONE_SIZES.map((size) => size.name)).toEqual(['se', 'standard', 'pro', 'large', 'short']);
  });

  it.each(PHONE_SIZES)('keeps the score panel and the home sheet on $name', ({ width, height }) => {
    const dock = actionDockHeight(width, height);
    const panel = scorePanelBudget(height, width);
    expect(dock).toBe(128);
    expect(panel).toBeGreaterThanOrEqual(140);
    expect(panel + dock).toBeLessThanOrEqual(height);
    const sheets = homeSheetHeights(width, height, 0);
    expect(sheets.closed).toBe(sheets.peek);
    expect(sheets.open).toBe(sheets.full);
    expect(sheets.peek).toBeGreaterThanOrEqual(96);
    expect(sheets.peek).toBeLessThan(sheets.half);
    expect(sheets.half).toBeLessThan(sheets.full);
    expect(sheets.full).toBeLessThanOrEqual(height);
    expect(sheets.peek).toBeLessThan(height * 0.5);
    expect(snapHomeSheet(sheets.peek + 4, sheets, 0)).toBe('peek');
    expect(snapHomeSheet(sheets.half, sheets, 0)).toBe('half');
    expect(snapHomeSheet(sheets.full - 4, sheets, 0)).toBe('full');
    expect(stickerHeight(width, height)).toBeGreaterThanOrEqual(44);
  });
});
