import { describe, expect, it } from 'vitest';
import { projectAlongHole } from '@coopr/engine';
import { colors, font, motion, play, radius, signal, space, touch, type } from '@coopr/tokens';
import { bagGlance, resumeLine, skyLine } from '../src/design/home-copy';
import { RESULT_ICONS } from '../src/design/icons';
import { holeSwipe, rollSteps } from '../src/design/motion';
import { holeFrame } from '../src/design/play-polish';
import { glassTheme } from '../src/design/theme';

describe('design tokens', () => {
  it('keeps navy, white, and crest red, and reserves ice for a live number', () => {
    expect(colors.navy).toBe('#0B1F3A');
    expect(colors.white).toBe('#FFFFFF');
    expect(colors.red).toBe('#C8102E');
    expect(play.live).toBe('#5CE1FF');
    expect(signal.go).toBe('#8AC926');
    expect(signal.caution).toBe('#E6A317');
    expect(signal.hazard).toBe('#C8102E');
    expect(play.bg).toBe('#070B10');
    expect(Object.values(space).every((value) => value % 8 === 0)).toBe(true);
    expect(touch).toBeGreaterThanOrEqual(56);
    expect(type.hero).toBe(56);
    expect(type.title).toBe(34);
    expect(type.club).toBe(22);
    expect(type.body).toBe(17);
    expect(type.caption).toBe(13);
    expect(radius.card).toBeGreaterThanOrEqual(16);
    expect(font.family).toMatch(/SF Pro|apple-system/);
    expect(font.semibold).toBe('600');
    expect(glassTheme.blur).toBeGreaterThan(0);
    expect(glassTheme.overlay).toMatch(/^rgba/);
    expect(glassTheme.border).toMatch(/^rgba/);
    expect(glassTheme.shadowOpacity).toBeGreaterThan(0);
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
    expect(skyLine(null)).toBeNull();
    expect(skyLine({ temperatureF: 64.2, windMph: 8.4, headwindMph: null })).toBe('64° · Wind 8 mph');
    expect(skyLine({ temperatureF: 64, windMph: 9, headwindMph: 6.2 })).toBe('64° · Wind 9 mph · 6 in your face');
    expect(skyLine({ temperatureF: 64, windMph: 9, headwindMph: -3.4 })).toBe('64° · Wind 9 mph · 3 helping');
  });
});

describe('hole frame', () => {
  it('keeps the pin flag under the yardage pill and the tee above the sheet', () => {
    const height = 844;
    const hud = 188;
    const dock = 108;
    const sheet = 128;
    const frame = holeFrame({ hudHeight: hud, dockHeight: dock, sheetClosed: sheet });
    const tee = { lat: 41.6, lon: -87.8 };
    const pin = { lat: 41.604, lon: -87.8 };
    const projection = projectAlongHole([tee, pin], 390, height, frame, 0, tee);
    const teeXY = projection.toXY(tee);
    const pinXY = projection.toXY(pin);
    expect(pinXY.y - 30).toBeGreaterThanOrEqual(hud);
    expect(teeXY.y + 6).toBeLessThanOrEqual(height - dock - 8 - sheet);
    expect(pinXY.y).toBeLessThan(teeXY.y);
    expect(holeFrame({ hudHeight: Number.NaN, dockHeight: Number.NaN, sheetClosed: Number.NaN }).top).toBeGreaterThan(0);
  });
});
