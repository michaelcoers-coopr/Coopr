import { describe, expect, it } from 'vitest';
import { touch } from '@coopr/tokens';
import { SCORE_GROUP_MIN, clubFigure, clubWhy, holeShift, scoreGlance, scorePairFits } from '../src/design/play-polish';

describe('club card copy', () => {
  it('shows plays-like on the card and leaves a live GPS number off it', () => {
    expect(clubFigure(154, 160, true)).toEqual({ label: 'Plays like', yards: 154 });
    expect(clubFigure(null, 160, true)).toBeNull();
    expect(clubFigure(null, 160, false)).toEqual({ label: 'Shot', yards: 160 });
    expect(clubFigure(null, null, false)).toBeNull();
  });

  it('keeps a single why line and does not invent a gap', () => {
    expect(
      clubWhy({ layupReason: 'Lay up short of the hazard.', stockYards: 170, targetYards: 160, playsLike: true, unit: 'yd' }),
    ).toBe('Lay up short of the hazard.');
    expect(clubWhy({ layupReason: null, stockYards: 170, targetYards: 164, playsLike: true, unit: 'yd' })).toBe(
      '6 yards long of the plays-like.',
    );
    expect(clubWhy({ layupReason: null, stockYards: 163.4, targetYards: 163.2, playsLike: false, unit: 'm' })).toBe(
      'Even with the shot.',
    );
    expect(clubWhy({ layupReason: null, stockYards: 163, targetYards: 164, playsLike: false, unit: 'm' })).toBe(
      '1 meter short of the shot.',
    );
    expect(clubWhy({ layupReason: null, stockYards: null, targetYards: 160, playsLike: true, unit: 'yd' })).toBeNull();
    expect(clubWhy({ layupReason: '  ', stockYards: 150, targetYards: 150, playsLike: true, unit: 'yd' })).toBe('Even with the plays-like.');
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
  });
});

describe('hole entrance', () => {
  it('slides forward to the next hole and back to the previous', () => {
    expect(holeShift(3, 4)).toBe('forward');
    expect(holeShift(4, 3)).toBe('back');
    expect(holeShift(4, 4)).toBe('none');
  });
});

describe('score dock', () => {
  it('wraps the steppers on a small phone instead of clipping them', () => {
    expect(SCORE_GROUP_MIN).toBeGreaterThanOrEqual(touch);
    expect(scorePairFits(320 - 24)).toBe(false);
    expect(scorePairFits(375 - 24)).toBe(true);
  });
});
