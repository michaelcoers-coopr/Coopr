import { describe, expect, it } from 'vitest';
import { clubFigure, clubWhy, holeEnter, holeShift, scoreCommit, scoreDrag, scoreGlance, scoreGlow, sheetSnap } from '../src/design/play-polish';

describe('club card copy', () => {
  it('shows plays-like on the card and leaves a live GPS number off it', () => {
    expect(clubFigure(154, 160, true)).toEqual({ label: 'Plays like', yards: 154 });
    expect(clubFigure(null, 160, true)).toBeNull();
    expect(clubFigure(null, 160, false)).toEqual({ label: 'Shot', yards: 160 });
    expect(clubFigure(null, null, false)).toBeNull();
  });

  it('says the gap in plain words and does not invent one', () => {
    expect(
      clubWhy({ layupReason: 'Lay up short of the hazard.', stockYards: 170, targetYards: 160, playsLike: true, unit: 'yd' }),
    ).toBe('Lay up short of the hazard.');
    expect(clubWhy({ layupReason: null, stockYards: 170, targetYards: 164, playsLike: true, unit: 'yd' })).toBe('6 yards long.');
    expect(clubWhy({ layupReason: null, stockYards: 163.4, targetYards: 163.2, playsLike: false, unit: 'm' })).toBe('Dead on your number.');
    expect(clubWhy({ layupReason: null, stockYards: 163, targetYards: 164, playsLike: false, unit: 'm' })).toBe('1 meter short.');
    expect(clubWhy({ layupReason: null, stockYards: null, targetYards: 160, playsLike: true, unit: 'yd' })).toBeNull();
    expect(clubWhy({ layupReason: '  ', stockYards: 150, targetYards: 150, playsLike: true, unit: 'yd' })).toBe('Dead on your number.');
    expect(clubWhy({ layupReason: null, stockYards: 170, targetYards: 164, playsLike: true, unit: 'yd' })).not.toMatch(/plays-like/i);
  });
});

describe('score glance', () => {
  it('rewards a confirmed par or birdie and leaves the grey default still', () => {
    expect(scoreGlance(4, 4, false)).toEqual({ motion: null, name: null, versus: null });
    expect(scoreGlance(4, 4, true)).toEqual({ motion: 'par', name: 'Par', versus: 'E' });
    expect(scoreGlance(3, 4, true)).toEqual({ motion: 'birdie', name: 'Birdie', versus: '-1' });
    expect(scoreGlance(2, 4, true)).toEqual({ motion: 'birdie', name: 'Eagle', versus: '-2' });
    expect(scoreGlance(1, 4, true)).toEqual({ motion: 'birdie', name: null, versus: '-3' });
    expect(scoreGlance(5, 4, true)).toEqual({ motion: null, name: null, versus: '+1' });
    expect(scoreGlance(null, 4, true).versus).toBeNull();
    expect(scoreGlow('birdie')).toBe('#C8102E');
    expect(scoreGlow('par')).toBe('#FFFFFF');
    expect(scoreGlow(null)).toBeNull();
  });
});

describe('hole entrance', () => {
  it('slides the map farther than the sheet', () => {
    expect(holeShift(3, 4)).toBe('forward');
    expect(holeShift(4, 3)).toBe('back');
    expect(holeShift(4, 4)).toBe('none');
    expect(holeEnter('forward')).toEqual({ map: 64, sheet: 22 });
    expect(holeEnter('back')).toEqual({ map: -64, sheet: -22 });
    expect(holeEnter('none')).toEqual({ map: 0, sheet: 0 });
    expect(Math.abs(holeEnter('forward').sheet)).toBeLessThan(Math.abs(holeEnter('forward').map));
  });
});

describe('one-thumb score', () => {
  it('treats a short press as keep, an upward drag as one more stroke, and a sideways drag as not a score', () => {
    expect(scoreDrag(4, 2)).toBe('tap');
    expect(scoreDrag(-40, 6)).toBe('up');
    expect(scoreDrag(40, 6)).toBe('down');
    expect(scoreDrag(-12, 48)).toBeNull();
    expect(scoreDrag(Number.NaN, 0)).toBeNull();
    expect(scoreCommit(5, 'tap', 1)).toBe(5);
    expect(scoreCommit(5, 'up', 1)).toBe(6);
    expect(scoreCommit(1, 'down', 1)).toBe(1);
    expect(scoreCommit(0, 'down', 0)).toBe(0);
  });

  it('opens the club sheet on an upward swipe and leaves a short drag alone', () => {
    expect(sheetSnap(false, -64, 0)).toBe(true);
    expect(sheetSnap(true, 64, 0)).toBe(false);
    expect(sheetSnap(false, -8, -0.9)).toBe(true);
    expect(sheetSnap(true, 8, 0)).toBe(true);
    expect(sheetSnap(false, Number.NaN, 0)).toBe(false);
  });
});
