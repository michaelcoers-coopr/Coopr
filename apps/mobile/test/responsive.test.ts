import { describe, expect, it } from 'vitest';
import { actionDockHeight, homeSheetHeights, PHONE_SIZES, scorePanelBudget, stickerHeight, tierFor } from '../src/design/responsive';

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
    expect(dock).toBeGreaterThanOrEqual(44);
    expect(panel).toBeGreaterThanOrEqual(140);
    expect(panel + dock).toBeLessThanOrEqual(height);
    const sheets = homeSheetHeights(width, height, 0);
    expect(sheets.closed).toBeGreaterThanOrEqual(96);
    expect(sheets.open).toBeLessThanOrEqual(height);
    expect(sheets.closed).toBeLessThan(sheets.open);
    expect(sheets.closed).toBeLessThan(height * 0.5);
    expect(stickerHeight(width, height)).toBeGreaterThanOrEqual(44);
  });
});
