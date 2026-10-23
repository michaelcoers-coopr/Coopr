import { describe, expect, it } from 'vitest';
import { projectAlongHole } from '@coopr/engine';
import { colors, font, motion, play, radius, signal, space, touch, type } from '@coopr/tokens';
import { caddieLine } from '@coopr/engine';
import { DEFAULT_VOICE, caddieVoiceLine } from '../src/design/caddie-voice';
import { bagGlance, courseCall, hypeHero, resumeLine, skyLine, TEE_IT_UP } from '../src/design/home-copy';
import { CONSOLATION, scoreMoment, scoreStamp } from '../src/design/play-polish';
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
    expect(glassTheme.grain).toBeGreaterThan(0);
    expect(glassTheme.overlay).toBe('rgba(4,10,24,0.9)');
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
    expect(courseCall('Cedars At High Cedars Golf Club')).toBe('High Cedars');
    expect(hypeHero({ name: 'Mike Coers', course: 'Cedars At High Cedars Golf Club' })).toBe("Let's go, Mike. High Cedars is waiting.");
    expect(hypeHero({ name: '', course: 'Cedars At High Cedars Golf Club' })).toBe('High Cedars is waiting.');
    expect(hypeHero({ name: '', course: '' })).toBe("Let's go.");
    expect(TEE_IT_UP).toBe('TEE IT UP');
  });
});

describe('caddie voice', () => {
  it('keeps chirpy loud and grounded, and chill on the measured line', () => {
    expect(DEFAULT_VOICE).toBe('chirpy');
    const measured = {
      personality: 'funny_knowledgeable' as const,
      clubLabel: '7-iron',
      windYards: null,
      stockYards: 160,
      targetYards: 152,
      playsLikeYards: 152,
      lowConfidence: false,
      unit: 'yd' as const,
    };
    expect(caddieVoiceLine({ ...measured, voice: 'chirpy' })).toBe('Grip it and rip it. 7-iron, 152.');
    expect(caddieVoiceLine({ ...measured, voice: 'chirpy', stockYards: 140, targetYards: 160, playsLikeYards: 160 })).toBe(
      'Short is dead. 7-iron is 20 yards short of 160.',
    );
    expect(caddieVoiceLine({ ...measured, voice: 'chirpy', stockYards: 180, targetYards: 152, playsLikeYards: 152 })).toBe(
      "That's a lot of club. 7-iron covers 152 by 28 yards.",
    );
    const chill = caddieVoiceLine({ ...measured, voice: 'chill', windYards: -4, stockYards: 160, targetYards: 150 });
    expect(chill).toBe(
      caddieLine({
        personality: 'funny_knowledgeable',
        clubLabel: '7-iron',
        windYards: -4,
        stockYards: 160,
        targetYards: 150,
        lowConfidence: false,
      }),
    );
    const ungrounded = caddieVoiceLine({ ...measured, voice: 'chirpy', playsLikeYards: null, targetYards: null, stockYards: null });
    expect(ungrounded ?? '').not.toMatch(/\d/);
    expect(caddieVoiceLine({ ...measured, voice: 'chirpy', clubLabel: null })).toBeNull();
  });
});

describe('score moments', () => {
  it('celebrates birdie or better and consoles a double', () => {
    expect(scoreMoment(3, 4)).toBe('celebrate');
    expect(scoreStamp(3, 4)).toBe('BIRDIE');
    expect(scoreStamp(2, 4)).toBe('EAGLE');
    expect(scoreStamp(1, 4)).toBe('ALBATROSS');
    expect(scoreMoment(4, 4)).toBeNull();
    expect(scoreMoment(5, 4)).toBeNull();
    expect(scoreMoment(6, 4)).toBe('consolation');
    expect(scoreStamp(6, 4)).toBeNull();
    expect(CONSOLATION).toBe('Shake it off. Next tee.');
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
