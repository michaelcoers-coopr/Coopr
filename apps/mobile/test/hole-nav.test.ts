import { describe, expect, it } from 'vitest';
import { loadHighCedarsPilot } from '@coopr/course';
import type { LatLon } from '@coopr/domain';
import { holeOverlay, ringCentroid } from '@coopr/engine';
import { acceptHoleGesture, flushDeskNav, HOLE_BUTTON_LOCK_MS, pressDeskHole, type DeskNav } from '../src/design/hole-nav';

const pilot = loadHighCedarsPilot();

function teeOf(hole: number): LatLon {
  const tee = holeOverlay(pilot.features, pilot.record.scorecard, hole).line[0];
  if (!tee) throw new Error(`hole ${hole} has no tee`);
  return tee;
}

function greenOf(hole: number): LatLon | null {
  const ring = holeOverlay(pilot.features, pilot.record.scorecard, hole).green?.rings[0];
  return ring ? ringCentroid(ring) : null;
}

function flush(state: DeskNav): DeskNav {
  return flushDeskNav(state, teeOf, greenOf);
}

describe('hole navigation', () => {
  it('does not undo Previous once when the desk fix is still the tee just left', () => {
    let state: DeskNav = { hole: 1, standingOn: 1, manual: false, advancedFrom: null };
    state = flush(pressDeskHole(state, 'next'));
    state = flush(pressDeskHole(state, 'next'));
    expect(state.hole).toBe(3);
    expect(state.standingOn).toBe(3);

    state = flush(pressDeskHole(state, 'prev'));
    expect(state.hole).toBe(2);
    expect(state.standingOn).toBe(2);

    state = flush(pressDeskHole(state, 'prev'));
    expect(state.hole).toBe(1);

    const undone = flush({ hole: 2, standingOn: 3, manual: false, advancedFrom: null });
    expect(undone.hole).toBe(3);
  });

  it('still advances when the player walks onto the next tee', () => {
    const walked = flush({ hole: 2, standingOn: 3, manual: false, advancedFrom: null });
    expect(walked.hole).toBe(3);
    const again = flush(walked);
    expect(again.hole).toBe(3);
  });

  it('drops a same-direction swipe that follows the chevron, and keeps the other direction', () => {
    expect(acceptHoleGesture({ dir: 'next', lastDir: 'next', elapsedMs: 40 })).toBe(false);
    expect(acceptHoleGesture({ dir: 'next', lastDir: 'next', elapsedMs: HOLE_BUTTON_LOCK_MS + 1 })).toBe(true);
    expect(acceptHoleGesture({ dir: 'prev', lastDir: 'next', elapsedMs: 40 })).toBe(true);
    expect(acceptHoleGesture({ dir: null, lastDir: 'next', elapsedMs: 10 })).toBe(false);
  });
});
