/** Crown of the photo cap, in dp above the sheet bottom. */
export const SHEET_BALL_CROWN = 78;

/** Fixed height of the ball image. The rim sits just inside the top of this box. */
export const SHEET_BALL_CAP_HEIGHT = 80;

/** Open sheet olive stops here. Taller sheets do not grow the wash. */
export const SHEET_BALL_OLIVE_OPEN = 310;

/**
 * Sheets this tall and shorter are filled with olive.
 * Past this, the wash holds at SHEET_BALL_OLIVE_OPEN.
 */
export const SHEET_BALL_OLIVE_FULL_UNTIL = 220;

/** Top of the open scroll. Glyphs dissolve here instead of being cut. */
export const SHEET_BALL_SCROLL_FADE = 48;

/** Bottom of the open scroll. A short feather, so a line at rest is not dissolved in half. */
export const SHEET_BALL_SCROLL_FADE_BOTTOM = 8;

/**
 * Closed: gap under the Course / Coach AI / Stats row.
 * Open: the scroll ends above the photo cap.
 */
export const SHEET_BALL_TEXT = { closedPx: 8, openPx: 98 } as const;

/**
 * Olive wash height for a sheet of `sheetHeight` dp.
 * Closed (176) fills the sheet. Open (540) stops at 310.
 * While the sheet springs through, a short sheet stays full and a tall one caps at 310.
 */
export function oliveHeight(sheetHeight: number): number {
  if (sheetHeight <= SHEET_BALL_OLIVE_FULL_UNTIL) return sheetHeight;
  return Math.min(sheetHeight, SHEET_BALL_OLIVE_OPEN);
}
