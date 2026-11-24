import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  acceptShotYards,
  debriefNote,
  debriefTarget,
  rememberDebrief,
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
  recommend,
  shortShotCall,
  taggedHazardLine,
  wedgeCarry,
  type DistanceProfile,
} from '@coopr/engine';
import type { MapFeature } from '@coopr/domain';
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
    expect(parsed.surfacePressureHpa).toBeNull();
    const withPressure = parseOpenMeteoCurrent({ current: { temperature_2m: 62, wind_speed_10m: 8, wind_direction_10m: 200, surface_pressure: 1014 } });
    if ('error' in withPressure) throw new Error(withPressure.error);
    expect(withPressure.surfacePressureHpa).toBe(1014);
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
    const first = { hole: 1, choice: 'swing' as const, note: 'Hole 1 was 1 over par. You called it the swing. The score was not changed.' };
    const second = { hole: 4, choice: 'plan' as const, note: 'Hole 4 was 2 over par. You called it the plan. The score was not changed.' };
    const kept = rememberDebrief(rememberDebrief([], first), second);
    expect(kept.map((item) => item.hole)).toEqual([1, 4]);
    expect(rememberDebrief(kept, { ...first, choice: 'plan' })).toEqual([
      { ...first, choice: 'plan' },
      second,
    ]);
    expect(strokes).toEqual([4, null, 6]);
  });

  it('rejects a shot of zero or less and still accepts a long number', () => {
    expect(acceptShotYards(0)).toEqual({ error: expect.stringMatching(/more than 0/) });
    expect(acceptShotYards(-8)).toEqual({ error: expect.stringMatching(/more than 0/) });
    expect(acceptShotYards(Number.NaN)).toEqual({ error: expect.stringMatching(/needs a number/) });
    expect(acceptShotYards(600)).toBe(600);
    expect(acceptShotYards(18)).toBe(18);
    expect(shortShotCall(0, []).clubId).toBeNull();
    expect(shortShotCall(0, []).reason).not.toMatch(/past 40/);
    expect(shortShotCall(-4, []).reason).toMatch(/not a shot distance/);
    const tooFar = playsLike({ rawYards: 600, headwindMph: 8, elevationFeet: 12, temperatureF: 59 });
    expect(tooFar).toEqual({ error: expect.stringMatching(/500/) });
    expect('playsLikeYards' in tooFar).toBe(false);
    const zero = playsLike({ rawYards: 0, headwindMph: 8, elevationFeet: 12, temperatureF: 59 });
    expect(zero).toEqual({ error: expect.stringMatching(/above 0/) });
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

describe('round calls', () => {
  const stock = (partial: Partial<DistanceProfile>): DistanceProfile => ({
    clubId: 'driver',
    clubLabel: 'Driver',
    environment: 'simulator',
    swingMode: 'unknown',
    metric: 'total',
    sampleSize: 8,
    p20: 190,
    p50: 213,
    p80: 230,
    iqr: 40,
    mad: 10,
    shortMissCount: 0,
    longMissCount: 0,
    shortMissShare: 0,
    longMissShare: 0,
    confidence: 'moderate',
    longestYards: 253,
    stockYards: 213,
    lateralMiss: 'none',
    blended: false,
    reported: false,
    dispersionKnown: true,
    sampleWarning: null,
    ...partial,
  });

  it('declines a club that is not within 15 yards of the shot', () => {
    const card = recommend({
      targetDistanceYards: 484,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [stock({})],
    });
    expect(card.posture).toBe('decline');
    expect(card.clubId).toBeNull();
    expect(card.lines.reason).not.toMatch(/No club/);
    expect(card.lines.reason).toMatch(/213/);
    expect(card.lines.club).toBe('—');
    const close = recommend({
      targetDistanceYards: 210,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [stock({})],
    });
    expect(close.clubLabel).toBe('Driver');
    expect(close.posture).not.toBe('decline');
    expect(close.passedCloser).toBeNull();
    const easy = recommend({
      targetDistanceYards: 40,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [stock({}), stock({ clubId: 'pw', clubLabel: 'Pitching wedge', stockYards: 90, p20: 82, p50: 90, p80: 98, longestYards: 104 })],
    });
    expect(easy.posture).toBe('conservative');
    expect(easy.clubId).toBe('pw');
    expect(easy.swingMode).toBe('partial');
    expect(easy.lines.reason).toMatch(/Pitching wedge/);
    expect(easy.lines.reason).toMatch(/90/);
    expect(easy.lines.reason).toMatch(/40/);
    expect(easy.lines.reason).not.toMatch(/No club/);
    expect(easy.lines.reason).not.toMatch(/\d+\.\d/);
  });

  it('names a closer club that lost on scatter and still calls the tighter stock', () => {
    const card = recommend({
      targetDistanceYards: 160,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [
        stock({ clubId: '5i', clubLabel: '5-iron', stockYards: 162, p20: 80, p50: 162, p80: 185, iqr: 40, confidence: 'limited', longestYards: 185, sampleSize: 10 }),
        stock({ clubId: '7i', clubLabel: '7-iron', stockYards: 154, p20: 148, p50: 154, p80: 160, iqr: 8, confidence: 'moderate', longestYards: 166, sampleSize: 10 }),
      ],
    });
    expect(card.clubId).toBe('7i');
    expect(card.clubLabel).toBe('7-iron');
    expect(card.passedCloser).toMatch(/5-iron/);
    expect(card.passedCloser).toMatch(/scatter/);
    expect(card.passedCloser).toMatch(/162/);
    expect(card.lines.reason).toMatch(/5-iron/);
    expect(card.lines.reason).toMatch(/scatter/);
  });

  it('names a closer club with too few shots and does not call it', () => {
    const card = recommend({
      targetDistanceYards: 160,
      targetMetric: 'total',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [
        stock({ clubId: '6i', clubLabel: '6-iron', stockYards: 158, sampleSize: 3, confidence: 'insufficient', iqr: 4, longestYards: 160 }),
        stock({ clubId: '7i', clubLabel: '7-iron', stockYards: 154, p20: 148, p50: 154, p80: 160, iqr: 8, confidence: 'moderate', longestYards: 166, sampleSize: 10 }),
      ],
    });
    expect(card.clubId).toBe('7i');
    expect(card.passedCloser).toMatch(/6-iron/);
    expect(card.passedCloser).toMatch(/only 3 shots/);
    expect(card.lines.club).not.toMatch(/6-iron/);
  });

  it('uses a stored wedge carry inside 40 yards and ignores a full-swing stock', () => {
    const empty = shortShotCall(18, []);
    expect(empty.clubId).toBeNull();
    expect(empty.reason).toMatch(/full-swing stock is not used/);
    const far = shortShotCall(18, [{ clubId: 'sw', clubLabel: '56°', length: 'full', carryYards: 91 }]);
    expect(far.clubId).toBeNull();
    expect(far.reason).toMatch(/56°/);
    const pitch = shortShotCall(18, [
      { clubId: 'sw', clubLabel: '56°', length: 'full', carryYards: 91 },
      { clubId: 'sw', clubLabel: '56°', length: 'half', carryYards: 20 },
    ]);
    expect(pitch.clubId).toBe('sw');
    expect(pitch.length).toBe('half');
    expect(pitch.carryYards).toBe(20);
    expect(pitch.reason).not.toMatch(/total/);
  });

  it('sets a carry line only from a tagged hazard and a real position', () => {
    const ring = [
      { lat: 0.001, lon: -0.0002 },
      { lat: 0.001, lon: 0.0002 },
      { lat: 0.0014, lon: 0.0002 },
      { lat: 0.0014, lon: -0.0002 },
    ];
    const hazard = {
      osmType: 'way',
      osmId: 1,
      kind: 'hazard',
      holeRef: 1,
      par: null,
      handicap: null,
      tags: {},
      rings: [ring],
      provenance: {
        provider: 'openstreetmap',
        externalId: 'way/1',
        license: 'ODbL-1.0',
        attribution: '© OpenStreetMap contributors',
        retrievedOn: '2026-10-22',
        datasetClass: 'open',
        upstreamTimestamp: null,
      },
    } as MapFeature;
    const untagged = { ...hazard, osmId: 2, holeRef: null };
    const from = { lat: 0, lon: 0 };
    const line = taggedHazardLine([hazard], 1, from);
    expect(line?.kind).toBe('hazard');
    expect(line?.yards).toBeGreaterThan(50);
    expect(line?.note).toMatch(/Not a carry/);
    expect(taggedHazardLine([untagged], 1, from)).toBeNull();
    expect(taggedHazardLine([hazard], 1, null)).toBeNull();
    expect(taggedHazardLine([hazard], 2, from)).toBeNull();
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
