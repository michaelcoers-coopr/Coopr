import { describe, expect, it } from 'vitest';
import { destinationPoint, distanceYards, holeOverlay, projectAlongHole, shotBearing } from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';
import { colors, font, motion, play, radius, signal, space, touch, type } from '@coopr/tokens';
import { caddieLine } from '@coopr/engine';
import { DEFAULT_VOICE, caddieVoiceLine } from '../src/design/caddie-voice';
import { bagGlance, courseCall, holeSubline, hypeHero, resumeLine, skyLine, TEE_IT_UP } from '../src/design/home-copy';
import { HOLE_BLEED_PAD, holeFitPoints, lineLengthYards, playCamera, pointAtYards, projectHoleFill, projectPlayFrame, TEE_SHOT_MARKS, teeWindowYards } from '../src/hole-fit';
import { CLOSED_CARD, CONSOLATION, holeFrame, mapHudInset, scoreMoment, scoreStamp } from '../src/design/play-polish';
import { marksAt } from '../src/map-labels';
import { RESULT_ICONS } from '../src/design/icons';
import { holeSwipe, rollSteps } from '../src/design/motion';
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
    expect(resumeLine({ hole: 1, holesEntered: 0, gross: null }).detail).toBe('White tees · Hole 1');
    expect(resumeLine({ hole: 1, holesEntered: 0, gross: null, par: 5 }).detail).toBe('White tees · Hole 1 · Par 5');
    expect(holeSubline({ hole: 1, par: 5, tee: 'Blue tees' })).toBe('Blue tees · Hole 1 · Par 5');
    expect(resumeLine({ hole: 1, holesEntered: 0, gross: null, par: 5 }).detail).not.toMatch(/waiting/i);
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
    expect(caddieVoiceLine({ ...measured, voice: 'chirpy', windYards: 5.5, targetYards: 159, playsLikeYards: 159 })).toBe(
      'Wind 5.5 yards in your face. Grip it and rip it. 7-iron, 159.',
    );
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
    const tee = {
      ...measured,
      clubLabel: 'Driver',
      stockYards: 213,
      targetYards: 442,
      playsLikeYards: 442,
      par: 5,
      atTee: true,
    };
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy' })).toBe("Par 5. Nobody's getting home. Driver, find the short grass.");
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy', par: 4 })).toBe("Par 4. Nobody's getting home. Driver, find the short grass.");
    expect(caddieVoiceLine({ ...tee, voice: 'chill' })).toBe('Par 5. Driver will not reach the green.');
    expect(caddieVoiceLine({ ...tee, voice: 'chill', atTee: false })).toBe(
      "You're 442 out. Driver gets you to about 213, so you'll need another shot.",
    );
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy', atTee: false })).toBe('Short is dead. Driver is 229 yards short of 442.');
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy', par: 3 })).toBe('Short is dead. Driver is 229 yards short of 442.');
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy', stockYards: 420 })).toBe('Short is dead. Driver is 22 yards short of 442.');
    expect(caddieVoiceLine({ ...tee, voice: 'chirpy', stockYards: null })).toBe('Grip it and rip it. Driver, 442.');
  });
});

describe('hole fit', () => {
  it('fits the hole polygon into the map so a par 5 fairway is not a sliver', () => {
    const pilot = loadHighCedarsPilot();
    const hole = holeOverlay(pilot.features, pilot.record.scorecard, 1);
    const fairways = hole.fairways.flatMap((feature) => feature.rings);
    const green = hole.green ? hole.green.rings : [];
    const points = holeFitPoints({ line: hole.line, fairways, green, bunkers: [], hazards: [] });
    const bearing = shotBearing(hole.line);
    const origin = hole.line[0];
    expect(bearing).not.toBeNull();
    expect(origin).toBeTruthy();
    const projection = projectHoleFill(points, 390, 844, HOLE_BLEED_PAD, bearing!, origin!);
    const xy = points.map((point) => projection.toXY(point));
    const onScreen = xy.filter((point) => point.y >= 180 && point.y <= 520);
    const width = Math.max(...onScreen.map((point) => point.x)) - Math.min(...onScreen.map((point) => point.x));
    expect(onScreen.length).toBeGreaterThan(4);
    expect(width).toBeGreaterThan(280);
    expect(Math.min(...xy.map((point) => point.y))).toBeLessThan(80);
    const holeTwo = holeOverlay(pilot.features, pilot.record.scorecard, 2);
    const second = holeFitPoints({
      line: holeTwo.line,
      fairways: holeTwo.fairways.flatMap((feature) => feature.rings),
      green: holeTwo.green ? holeTwo.green.rings : [],
      bunkers: [],
      hazards: [],
    });
    const secondBearing = shotBearing(holeTwo.line);
    const secondOrigin = holeTwo.line[0];
    const greenFit = projectHoleFill(second, 390, 844, HOLE_BLEED_PAD, secondBearing!, secondOrigin!);
    const greenXY = (holeTwo.green?.rings.flat() ?? []).map((point) => greenFit.toXY(point));
    expect(greenXY.every((point) => point.y >= 0 && point.y <= 844)).toBe(true);
  });
});

describe('play camera', () => {
  it('frames the tee shot in the open band and the full hole from tee to green', () => {
    const pilot = loadHighCedarsPilot();
    const hole = holeOverlay(pilot.features, pilot.record.scorecard, 1);
    const fairway = hole.fairways.flatMap((feature) => feature.rings).flat();
    const green = hole.green ? hole.green.rings.flat() : [];
    const around = [...fairway, ...green, ...hole.line];
    const bearing = shotBearing(hole.line);
    const origin = hole.line[0];
    const pin = hole.line[hole.line.length - 1];
    expect(bearing).not.toBeNull();
    expect(origin).toBeTruthy();
    expect(pin).toBeTruthy();
    const holeYards = lineLengthYards(hole.line);
    const stock = 186.3;
    const reach = teeWindowYards(stock, holeYards);
    expect(reach).not.toBeNull();
    expect(reach!).toBeGreaterThanOrEqual(250);
    expect(reach!).toBeLessThan(stock + 40 + 80);
    const view = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 100, sheetClosed: CLOSED_CARD });
    const height = 844;
    const openTop = view.top;
    const openBottom = height - view.bottom;
    const side = destinationPoint(origin!, bearing! + 90, 20);
    let fairwayStart = fairway[0]!;
    let nearestFairway = Number.POSITIVE_INFINITY;
    for (const point of fairway) {
      const yards = distanceYards(origin!, point);
      if (yards < nearestFairway) {
        nearestFairway = yards;
        fairwayStart = point;
      }
    }
    const teeShot = projectPlayFrame({
      line: hole.line,
      around,
      fairway,
      width: 390,
      height,
      view,
      bearing: bearing!,
      origin: origin!,
      kind: 'tee',
      reachYards: reach,
      from: null,
    });
    const teeXY = teeShot.toXY(origin!);
    const pinXY = teeShot.toXY(pin!);
    const sideXY = teeShot.toXY(side);
    const fairwayPx = Math.hypot(sideXY.x - teeXY.x, sideXY.y - teeXY.y);
    const fairwayXY = teeShot.toXY(fairwayStart);
    expect(fairwayXY.y).toBeGreaterThan(openTop);
    expect(fairwayXY.y).toBeLessThan(teeXY.y);
    expect(teeXY.y).toBeGreaterThan(openBottom - 24);
    expect(teeXY.y).toBeLessThanOrEqual(openBottom + 2);
    expect(pinXY.y).toBeLessThan(openTop);
    for (const yards of TEE_SHOT_MARKS) {
      const at = pointAtYards(hole.line, yards);
      const mark = teeShot.toXY(at!);
      expect(mark.y).toBeGreaterThan(openTop);
      expect(mark.y).toBeLessThan(teeXY.y);
    }
    expect(marksAt(hole.line, TEE_SHOT_MARKS, 'yd').map((mark) => mark.label)).toEqual(['150', '200', '250']);
    const whole = projectPlayFrame({
      line: hole.line,
      around,
      fairway,
      width: 390,
      height,
      view,
      bearing: bearing!,
      origin: origin!,
      kind: 'hole',
      reachYards: null,
      from: null,
    });
    const wholeSide = whole.toXY(side);
    const wholeOrigin = whole.toXY(origin!);
    const holePx = Math.hypot(wholeSide.x - wholeOrigin.x, wholeSide.y - wholeOrigin.y);
    expect(fairwayPx).toBeGreaterThan(holePx * 1.4);
    const wholeTee = whole.toXY(origin!);
    const wholePin = whole.toXY(pin!);
    expect(wholeTee.y).toBeLessThanOrEqual(openBottom + 2);
    expect(wholeTee.y).toBeGreaterThan(openTop);
    expect(wholePin.y).toBeGreaterThanOrEqual(openTop - 2);
    expect(wholePin.y).toBeLessThan(wholeTee.y);
    const from = pointAtYards(hole.line, 300);
    const approach = projectPlayFrame({
      line: hole.line,
      around,
      fairway,
      width: 390,
      height,
      view,
      bearing: bearing!,
      origin: origin!,
      kind: 'green',
      reachYards: null,
      from,
    });
    const ball = approach.toXY(from!);
    const approachPin = approach.toXY(pin!);
    expect(ball.y).toBeGreaterThan(approachPin.y);
    expect(ball.y).toBeGreaterThan(openBottom - 30);
    expect(approach.toXY(origin!).y).toBeGreaterThan(openBottom);
    expect(distanceYards(origin!, pointAtYards(hole.line, 0)!)).toBeLessThan(1);
    const second = holeOverlay(pilot.features, pilot.record.scorecard, 2);
    const secondBearing = shotBearing(second.line);
    const secondOrigin = second.line[0];
    const secondPin = second.line[second.line.length - 1];
    const secondFairway = second.fairways.flatMap((feature) => feature.rings).flat();
    const secondAround = [...secondFairway, ...(second.green?.rings.flat() ?? []), ...second.line];
    const secondFrame = projectPlayFrame({
      line: second.line,
      around: secondAround,
      fairway: secondFairway,
      width: 390,
      height,
      view,
      bearing: secondBearing!,
      origin: secondOrigin!,
      kind: 'hole',
      reachYards: null,
      from: null,
    });
    const secondTee = secondFrame.toXY(secondOrigin!);
    const secondPinXY = secondFrame.toXY(secondPin!);
    const secondGrass = secondFairway.map((point) => secondFrame.toXY(point));
    expect(secondTee.y).toBeGreaterThan(openTop);
    expect(secondTee.y).toBeLessThanOrEqual(openBottom + 2);
    expect(secondPinXY.y).toBeGreaterThanOrEqual(openTop - 2);
    expect(secondPinXY.y).toBeLessThan(secondTee.y);
    expect(Math.max(...secondGrass.map((point) => point.y)) - Math.min(...secondGrass.map((point) => point.y))).toBeGreaterThan(80);
    expect(playCamera({ onTee: false, fullHole: false, reachYards: 220, onThisHole: false, player: true })).toBe('hole');
    expect(playCamera({ onTee: true, fullHole: false, reachYards: 220, onThisHole: true, player: true })).toBe('hole');
    expect(playCamera({ onTee: true, fullHole: true, reachYards: 220, onThisHole: true, player: true })).toBe('tee');
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
    expect(teeXY.y + 6).toBeLessThanOrEqual(height - sheet);
    expect(pinXY.y).toBeLessThan(teeXY.y);
    expect(holeFrame({ hudHeight: Number.NaN, dockHeight: Number.NaN, sheetClosed: Number.NaN }).top).toBeGreaterThan(0);
  });
});
