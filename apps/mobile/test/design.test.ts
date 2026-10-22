import { describe, expect, it } from 'vitest';
import { colors, font, motion, play, radius, space, touch, type } from '@coopr/tokens';
import { bagGlance, resumeLine } from '../src/design/home-copy';
import { RESULT_ICONS } from '../src/design/icons';
import { holeSwipe, rollSteps } from '../src/design/motion';

describe('design tokens', () => {
  it('keeps navy, white, and crest red, and reserves ice for a live number', () => {
    expect(colors.navy).toBe('#0B1F3A');
    expect(colors.white).toBe('#FFFFFF');
    expect(colors.red).toBe('#C8102E');
    expect(play.live).toBe('#5CE1FF');
    expect(play.bg).toBe('#070B10');
    expect(Object.values(space).every((value) => value % 8 === 0)).toBe(true);
    expect(touch).toBeGreaterThanOrEqual(56);
    expect(type.hero).toBeGreaterThanOrEqual(64);
    expect(radius.card).toBeGreaterThanOrEqual(16);
    expect(font.family).toMatch(/SF Pro|apple-system/);
    expect(motion.rollFrames).toBeGreaterThan(2);
  });
});

describe('yardage roll', () => {
  it('lands on the real number and stays between the two yardages', () => {
    const steps = rollSteps(140, 160, 8);
    expect(steps[steps.length - 1]).toBe(160);
    expect(steps[0]).toBeGreaterThan(140);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(140);
    expect(Math.max(...steps)).toBeLessThanOrEqual(160);
    expect(rollSteps(160, 160, 8)).toEqual([160]);
    expect(rollSteps(Number.NaN, 10, 8)).toEqual([]);
  });
});

describe('hole swipe', () => {
  it('turns a sideways drag into the next or previous hole and ignores a scroll', () => {
    expect(holeSwipe(-80, 10, 4)).toBe('next');
    expect(holeSwipe(80, 10, 4)).toBe('prev');
    expect(holeSwipe(-80, 10, 18)).toBeNull();
    expect(holeSwipe(80, 4, 1)).toBeNull();
    expect(holeSwipe(-20, 4, 4)).toBeNull();
    expect(holeSwipe(-40, 80, 4)).toBeNull();
  });
});

describe('home glance', () => {
  it('resumes a started round and does not invent a handicap or a bag count', () => {
    expect(resumeLine({ hole: 1, holesEntered: 0, gross: null }).title).toBe('Play High Cedars');
    expect(resumeLine({ hole: 7, holesEntered: 6, gross: 28 })).toEqual({ title: 'Resume hole 7', detail: 'Gross 28' });
    expect(bagGlance(14)).toBe('14 of 14');
    expect(RESULT_ICONS).toEqual({ fairway: 'flag', left: 'left', right: 'right', short: 'down', hazard: 'hazard' });
  });
});
