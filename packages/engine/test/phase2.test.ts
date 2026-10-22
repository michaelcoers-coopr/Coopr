import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  debriefNote,
  debriefTarget,
  destinationPoint,
  dispersionShape,
  distanceYards,
  elevationChangeFeet,
  headwindMph,
  holeOverlay,
  lateralSpreadYards,
  missReport,
  parseOpenMeteoCurrent,
  parseOpenMeteoElevation,
  playsLike,
  wedgeCarry,
} from '@coopr/engine';
import { loadHighCedarsPilot } from '@coopr/course';

describe('plays-like', () => {
  it('shows each input and withholds the total adjustment until all three are known', () => {
    const partial = playsLike({ rawYards: 160, headwindMph: 10, elevationFeet: null, temperatureF: 75 });
    if ('error' in partial) throw new Error(partial.error);
    expect(partial.playsLikeYards).toBeNull();
    expect(partial.missing).toEqual(['elevation']);
    expect(partial.wind?.yards).toBeCloseTo(16, 5);
    expect(partial.temperature?.yards).toBe(0);

    const full = playsLike({ rawYards: 160, headwindMph: 10, elevationFeet: 30, temperatureF: 65 });
    if ('error' in full) throw new Error(full.error);
    expect(full.elevation?.yards).toBeCloseTo(10, 5);
    expect(full.temperature?.yards).toBeCloseTo(-1.3, 1);
    expect(full.playsLikeYards).toBeCloseTo(160 + 16 + 10 - 1.3, 1);
    expect(full.wind?.note).toMatch(/headwind/);
    expect(full.elevation?.note).toMatch(/not a survey/);
  });

  it('treats a tailwind and a crosswind differently and does not invent a unit conversion', () => {
    const tail = playsLike({ rawYards: 150, headwindMph: -10, elevationFeet: 0, temperatureF: 75 });
    if ('error' in tail) throw new Error(tail.error);
    expect(tail.wind?.yards).toBeCloseTo(-15, 5);
    expect(tail.playsLikeYards).toBeCloseTo(135, 5);
    const cross = playsLike({ rawYards: 150, headwindMph: 0, elevationFeet: 0, temperatureF: 75 });
    if ('error' in cross) throw new Error(cross.error);
    expect(cross.wind?.yards).toBe(0);
    expect(cross.playsLikeYards).toBe(150);
  });

  it('reads a headwind from a bearing and leaves a bad weather payload empty', () => {
    expect(headwindMph({ windFromDeg: 0, windMph: 10, shotBearingDeg: 0 })).toBeCloseTo(10, 5);
    expect(headwindMph({ windFromDeg: 180, windMph: 10, shotBearingDeg: 0 })).toBeCloseTo(-10, 5);
    expect(headwindMph({ windFromDeg: 90, windMph: 10, shotBearingDeg: 0 })).toBeCloseTo(0, 5);
    expect('error' in parseOpenMeteoCurrent({})).toBe(true);
    const parsed = parseOpenMeteoCurrent({ current: { temperature_2m: 62, wind_speed_10m: 8, wind_direction_10m: 200 } });
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.temperatureF).toBe(62);
    expect('error' in parseOpenMeteoElevation({ elevation: [100, null] })).toBe(true);
    expect(elevationChangeFeet(100, 109.144)).toBeCloseTo(30, 0);
  });
});

describe('miss side, wedges, and debrief', () => {
  it('names a miss side from counts and withholds an aim offset without five measured sides', () => {
    const thin = missReport([
      { side: 'left', sideYards: null },
      { side: 'left', sideYards: null },
      { side: 'right', sideYards: 4 },
    ]);
    expect(thin.side).toBe('left');
    expect(thin.aimOffsetYards).toBeNull();
    expect(thin.note).toMatch(/No yard offset/);
    const measured = missReport([
      { side: 'right', sideYards: 8 },
      { side: 'right', sideYards: 6 },
      { side: 'right', sideYards: 4 },
      { side: 'left', sideYards: -2 },
      { side: 'fairway', sideYards: 2 },
    ]);
    expect(measured.side).toBe('right');
    expect(measured.aimOffsetYards).toBeLessThan(0);
    expect(measured.note).toMatch(/not a new measurement/);
    expect(lateralSpreadYards([1, 2, 3, 4])).toBeNull();
    expect(lateralSpreadYards([0, 2, 4, 6, 8])).toBeGreaterThan(0);
  });

  it('keeps an unreadable wedge carry empty', () => {
    expect(wedgeCarry(null)).toBeNull();
    expect(wedgeCarry(0)).toEqual({ error: expect.stringMatching(/empty/) });
    expect(wedgeCarry(90)).toBe(90);
  });

  it('picks the worst hole and does not rewrite the score', () => {
    const strokes = [4, null, 6];
    const target = debriefTarget([
      { hole: 1, strokes: 4, par: 4 },
      { hole: 2, strokes: null, par: 5 },
      { hole: 3, strokes: 6, par: 4 },
    ]);
    expect(target).toEqual({ hole: 3, strokes: 6, par: 4, over: 2 });
    expect(debriefNote('swing', target!).includes('score was not changed')).toBe(true);
    expect(strokes).toEqual([4, null, 6]);
    expect(debriefTarget([{ hole: 1, strokes: null, par: 4 }])).toBeNull();
  });

  it('refuses a dispersion ellipse when the spread was not measured', () => {
    expect(dispersionShape(null)).toBeNull();
    expect(
      dispersionShape({ metric: 'carry', dispersionKnown: false, p20: 140, p80: 140, stockYards: 140, sampleSize: 12 }),
    ).toBeNull();
    const shape = dispersionShape({ metric: 'carry', dispersionKnown: true, p20: 150, p80: 170, stockYards: 160, sampleSize: 10 });
    expect(shape?.alongYards).toBe(10);
    expect(shape?.metric).toBe('carry');
  });
});

describe('hole map geometry', () => {
  it('draws only shapes that meet the hole and keeps a tap distance off the shot record', () => {
    const pilot = loadHighCedarsPilot();
    const overlay = holeOverlay(pilot.features, pilot.record.scorecard, 1);
    expect(overlay.line.length).toBeGreaterThan(1);
    expect(overlay.green).not.toBeNull();
    const start = overlay.line[0]!;
    const end = overlay.line[overlay.line.length - 1]!;
    const yards = distanceYards(start, end);
    expect(yards).toBeGreaterThan(100);
    const back = destinationPoint(start, bearingDegrees(start, end)!, 10);
    expect(distanceYards(start, back)).toBeCloseTo(10, 0);
    expect(overlay.hazards.every((feature) => feature.kind === 'hazard')).toBe(true);
  });
});
