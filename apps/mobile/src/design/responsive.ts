/** Phone sizes the layout is built for. Pure numbers, no view. */

export const MIN_TAP = 44;

export const PHONE_SIZES = [
  { name: 'se', width: 375, height: 667 },
  { name: 'standard', width: 390, height: 844 },
  { name: 'pro', width: 393, height: 852 },
  { name: 'large', width: 430, height: 932 },
  { name: 'short', width: 667, height: 375 },
] as const;

export type Tier = 'se' | 'standard' | 'pro' | 'large';

export function tierFor(width: number): Tier {
  const value = Number.isFinite(width) && width > 0 ? width : 393;
  if (value >= 420) return 'large';
  if (value >= 392) return 'pro';
  if (value >= 388) return 'standard';
  return 'se';
}

export function isShortHeight(width: number, height: number): boolean {
  return height <= 700 || width > height;
}

/** The hole action row. Narrow phones wrap to two rows. Landscape stays one row. */
export function actionDockHeight(width: number, height: number): number {
  if (width > height) return 80;
  if (width < 400) return 120;
  return 112;
}

/**
 * Score fields scroll inside this budget. The Save button is pinned under it,
 * and the sum of the budget plus the dock stays on the screen.
 */
export function scorePanelBudget(screenHeight: number, screenWidth = 393): number {
  const height = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 852;
  const width = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 393;
  const dock = actionDockHeight(width, height);
  const room = Math.max(140, height - dock - 16);
  if (width > height) return Math.max(220, Math.min(room, height - dock - 8));
  if (height <= 700) return Math.min(room, 420);
  return Math.min(room, 448);
}

/** Closed sheet leaves the start button on screen. Open sheet never exceeds the phone. */
export function homeSheetHeights(width: number, height: number, safeBottom = 0): { closed: number; open: number } {
  const screen = Number.isFinite(height) && height > 0 ? height : 852;
  const wide = Number.isFinite(width) && width > 0 ? width : 393;
  const bottom = Math.max(0, safeBottom);
  const usable = Math.max(160, screen - bottom);
  if (wide > screen) {
    return { closed: Math.max(96, Math.round(usable * 0.28)), open: Math.round(usable * 0.7) };
  }
  if (screen <= 700) {
    return { closed: Math.min(220, Math.round(usable * 0.32)), open: Math.round(usable * 0.82) };
  }
  return { closed: Math.min(268, Math.round(usable * 0.32)), open: Math.min(620, Math.round(usable * 0.72)) };
}

export function stickerHeight(width: number, height: number): number {
  return width > height ? MIN_TAP : 52;
}
