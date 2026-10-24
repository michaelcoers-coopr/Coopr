import type { LatLon } from '@coopr/domain';
import { arrivedAtNextTee } from '@coopr/engine';

/** A swipe that repeats the button just pressed is dropped. The other direction still counts. */
export const HOLE_BUTTON_LOCK_MS = 320;

/**
 * Walk-up to the next tee advances the hole.
 * A button press sets `manual` for one flush. The desk GPS preset is still the tee
 * just left, and that tee is the next tee of the hole just entered, so the walk-up
 * check would undo Previous once. The flag eats that one flush and then clears.
 */
export function shouldAutoAdvance(input: {
  manual: boolean;
  player: LatLon | null;
  currentHole: number;
  nextTee: LatLon | null;
  currentGreen: LatLon | null;
  alreadyAdvanced: boolean;
}): boolean {
  if (input.manual || input.alreadyAdvanced) return false;
  if (!input.player || input.currentHole >= 18) return false;
  return arrivedAtNextTee({
    player: input.player,
    nextTee: input.nextTee,
    currentGreen: input.currentGreen,
  });
}

/** True when a map swipe should change the hole. A same-direction flick right after a chevron does not. */
export function acceptHoleGesture(input: {
  dir: 'next' | 'prev' | null;
  lastDir: 'next' | 'prev' | null;
  elapsedMs: number;
  lockMs?: number;
}): boolean {
  if (input.dir == null) return false;
  const lock = input.lockMs ?? HOLE_BUTTON_LOCK_MS;
  if (input.lastDir === input.dir && input.elapsedMs >= 0 && input.elapsedMs < lock) return false;
  return true;
}

export interface DeskNav {
  hole: number;
  /** Hole whose tee the stored preset still resolves to. */
  standingOn: number;
  manual: boolean;
  advancedFrom: number | null;
}

/** Previous or Next. The preset is not retargeted until the next flush. */
export function pressDeskHole(state: DeskNav, dir: 'next' | 'prev'): DeskNav {
  const hole = dir === 'next' ? Math.min(18, state.hole + 1) : Math.max(1, state.hole - 1);
  if (hole === state.hole) return state;
  return { ...state, hole, manual: true, advancedFrom: null };
}

/**
 * One commit after a hole change: the walk-up effect, then the preset resolving onto the current hole.
 * `teeOf` is that hole's tee. The player is still `standingOn` when the effect runs.
 */
export function flushDeskNav(state: DeskNav, teeOf: (hole: number) => LatLon, greenOf: (hole: number) => LatLon | null): DeskNav {
  const nextTee = state.hole < 18 ? teeOf(state.hole + 1) : null;
  const advance = shouldAutoAdvance({
    manual: state.manual,
    player: teeOf(state.standingOn),
    currentHole: state.hole,
    nextTee,
    currentGreen: greenOf(state.hole),
    alreadyAdvanced: state.advancedFrom === state.hole,
  });
  if (!advance) return { ...state, manual: false, standingOn: state.hole };
  const hole = state.hole + 1;
  return { ...state, hole, standingOn: hole, manual: false, advancedFrom: state.hole };
}
