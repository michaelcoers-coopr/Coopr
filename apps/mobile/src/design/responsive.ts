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
/** Room for the one-tap Par row plus the mark, ask, and menu row. */
export function actionDockHeight(width: number, height: number): number {
  if (width > height) return 88;
  return 80;
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
  if (height <= 700) return Math.min(room, 260);
  return Math.min(room, 448);
}

export type HomeSheetStop = 'peek' | 'half' | 'full';

export type HomeSheetHeights = {
  peek: number;
  half: number;
  full: number;
  /** Peek. Kept so older callers still read a closed height. */
  closed: number;
  /** Full. Kept so older callers still read an open height. */
  open: number;
};

/**
 * Peek holds the start button. Half and full open the rest of the round sheet.
 * None of the three stops run off the phone, and peek stays under half the screen.
 */
export function homeSheetHeights(width: number, height: number, safeBottom = 0): HomeSheetHeights {
  const screen = Number.isFinite(height) && height > 0 ? height : 852;
  const wide = Number.isFinite(width) && width > 0 ? width : 393;
  const bottom = Math.max(0, safeBottom);
  const usable = Math.max(160, screen - bottom);
  const landscape = wide > screen;
  const peek = landscape
    ? Math.max(128, Math.min(148, Math.round(usable * 0.4)))
    : Math.max(136, Math.min(168, Math.round(usable * 0.22)));
  const full = landscape
    ? Math.round(usable - 16)
    : screen <= 700
      ? Math.round(usable * 0.82)
      : Math.min(620, Math.round(usable * 0.72));
  const half = landscape
    ? Math.round(peek + (full - peek) * 0.78)
    : Math.min(full - 24, Math.max(Math.round((peek + full) / 2), 480));
  return { peek, half, full, closed: peek, open: full };
}

/** Nearest stop after a drag. A fling (positive velocity grows the sheet) can pass the midpoint. */
export function snapHomeSheet(height: number, stops: { peek: number; half: number; full: number }, velocity = 0): HomeSheetStop {
  const projected = height + velocity * 90;
  const order: HomeSheetStop[] = ['peek', 'half', 'full'];
  let best: HomeSheetStop = 'peek';
  let dist = Number.POSITIVE_INFINITY;
  for (const name of order) {
    const next = Math.abs(stops[name] - projected);
    if (next < dist) {
      dist = next;
      best = name;
    }
  }
  return best;
}

export function stickerHeight(width: number, height: number): number {
  return width > height ? MIN_TAP : 52;
}
