import { actionDockHeight } from './responsive';

/** Layout for the hole screen and the home wordmark. Pure numbers, no view. */

export const MARKED_TOAST_MS = 1500;
export const MIN_TAP = 44;
export const COACH_PEEK_RATIO = 0.16;
export const COACH_OPEN_RATIO = 0.45;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function insideFrame(box: Box, width: number, height: number, safe: Insets): boolean {
  return (
    box.w > 0 &&
    box.h > 0 &&
    box.x >= safe.left - 0.5 &&
    box.y >= safe.top - 0.5 &&
    box.x + box.w <= width - safe.right + 0.5 &&
    box.y + box.h <= height - safe.bottom + 0.5
  );
}

/** Running score against par for the holes that have a stroke and a par. */
export function thruHud(strokes: readonly (number | null)[], pars: readonly (number | null)[]): string | null {
  let count = 0;
  let diff = 0;
  for (let index = 0; index < strokes.length; index += 1) {
    const score = strokes[index];
    const par = pars[index];
    if (score == null || par == null) continue;
    count += 1;
    diff += score - par;
  }
  if (count === 0) return null;
  const versus = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : String(diff);
  return `Thru ${count} · ${versus}`;
}

export function coachPeekHeight(screenHeight: number): number {
  const height = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 852;
  return Math.round(height * COACH_PEEK_RATIO);
}

export function coachOpenHeight(screenHeight: number): number {
  const height = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 852;
  return Math.round(height * COACH_OPEN_RATIO);
}

export function homeWordmark(input: { screenWidth: number; screenHeight?: number; safeTop: number; safeLeft: number }): {
  top: number;
  left: number;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
} {
  const left = Math.max(16, (Number.isFinite(input.safeLeft) ? input.safeLeft : 0) + 12);
  const width = Number.isFinite(input.screenWidth) && input.screenWidth > 0 ? input.screenWidth : 393;
  const height = Number.isFinite(input.screenHeight) && (input.screenHeight ?? 0) > 0 ? (input.screenHeight as number) : 852;
  const landscape = width > height;
  const top = (Number.isFinite(input.safeTop) ? input.safeTop : 0) + (landscape ? 52 : 68);
  const fontSize = landscape ? 28 : width < 390 ? 44 : 52;
  return { top, left, fontSize, lineHeight: fontSize + 6, maxWidth: Math.max(140, width - left - 16) };
}

export interface PlayChrome {
  pill: Box;
  plate: Box;
  toast: Box;
  menu: Box;
  yardageFont: number;
  coachPeek: number;
  coachOpen: number;
  actionHeight: number;
}

/**
 * Hole pill and yardage plate sit in the safe area and do not share a pixel.
 * The marked toast is a short chip under that row, not a card over the middle of the map.
 */
export function playChrome(input: { screenWidth: number; screenHeight: number; safe: Insets }): PlayChrome {
  const width = Number.isFinite(input.screenWidth) && input.screenWidth > 0 ? input.screenWidth : 393;
  const height = Number.isFinite(input.screenHeight) && input.screenHeight > 0 ? input.screenHeight : 852;
  const safe = input.safe;
  const gap = 8;
  const menu: Box = { x: width - safe.right - 12 - MIN_TAP, y: safe.top + 8, w: MIN_TAP, h: MIN_TAP };
  const pillH = MIN_TAP;
  const maxPill = menu.x - gap - (safe.left + 12);
  const pill: Box = { x: safe.left + 12, y: safe.top + 8, w: Math.max(160, Math.min(236, maxPill)), h: pillH };
  const plate: Box = {
    x: pill.x,
    y: pill.y + pill.h + gap,
    w: Math.min(168, width - safe.left - safe.right - 24),
    h: 118,
  };
  let toast: Box = { x: safe.left + 12, y: plate.y + plate.h + gap, w: 128, h: 32 };
  if (boxesOverlap(toast, plate) || boxesOverlap(toast, pill) || boxesOverlap(toast, menu)) {
    const beside = plate.x + plate.w + gap;
    if (beside + toast.w <= width - safe.right - 8 && beside >= menu.x + menu.w) {
      toast = { ...toast, x: beside, y: plate.y };
    } else {
      toast = { ...toast, y: Math.max(pill.y + pill.h, plate.y + plate.h) + gap };
    }
  }
  return {
    pill,
    plate,
    toast,
    menu,
    yardageFont: width < 380 ? 28 : 32,
    coachPeek: coachPeekHeight(height),
    coachOpen: coachOpenHeight(height),
    actionHeight: actionDockHeight(width, height),
  };
}
