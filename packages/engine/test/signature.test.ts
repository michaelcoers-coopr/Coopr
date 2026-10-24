import { describe, expect, it } from 'vitest';
import { closestPointOnSegment, destinationPoint, distanceYards } from '../src/geo';
import {
  PATTERN_INVITE,
  SAMPLE_PATTERN,
  caddieLine,
  componentChip,
  confidencePercent,
  dispersionOval,
  feelFor,
  flightAlongLine,
  flightArc,
  nudgeLabels,
  visibleLabels,
  patternColor,
  patternSafety,
  playsLikeChips,
  riskCall,
  roundProgress,
  sampleStdDev,
  thruScore,
} from '../src/signature';
import { playsLike } from '../src/phase2';

const tee = { lat: 41.6, lon: -87.8 };

describe('dispersion oval', () => {
  it('stays blank below five paired shots and does not invent a side', () => {
    expect(dispersionOval([])).toBeNull();
    expect(
      dispersionOval([
        { carryYards: 150, lateralYards: 2 },
        { carryYards: 151, lateralYards: 3 },
        { carryYards: 149, lateralYards: 1 },
        { carryYards: 152, lateralYards: 4 },
      ]),
    ).toBeNull();
    expect(dispersionOval(Array.from({ length: 8 }, () => ({ carryYards: 150, lateralYards: null })))).toBeNull();
    expect(PATTERN_INVITE).toBe('Hit 10 shots with this club to see your pattern');
  });

  it('uses the sample standard deviation of carry and side', () => {
    const carries = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(sampleStdDev(carries)).toBeCloseTo(Math.sqrt(32 / 7), 6);
    const oval = dispersionOval(SAMPLE_PATTERN);
    expect(oval).not.toBeNull();
    expect(oval!.sampleSize).toBe(12);
    expect(oval!.carryStdYards).toBeGreaterThan(0);
    expect(oval!.lateralStdYards).toBeGreaterThan(0);
    expect(oval!.biasDeg).toBeGreaterThan(0);
    expect(oval!.meanLateralYards).toBeGreaterThan(0);
  });

  it('colors a clear oval green, a near miss amber, and a hit red', () => {
    const oval = dispersionOval(SAMPLE_PATTERN)!;
    const center = destinationPoint(tee, 0, 160);
    const far = [destinationPoint(destinationPoint(center, 90, 200), 0, 10), destinationPoint(destinationPoint(center, 90, 220), 0, 10), destinationPoint(destinationPoint(center, 90, 220), 0, 30), destinationPoint(destinationPoint(center, 90, 200), 0, 30)];
    expect(patternSafety(center, 0, oval, [far])).toBe('clear');
    expect(patternColor('clear')).toBe('#8AC926');

    const hit = [destinationPoint(center, 0, -8), destinationPoint(center, 90, 8), destinationPoint(center, 0, 8), destinationPoint(center, 90, -8)];
    expect(patternSafety(center, 0, { carryStdYards: 12, lateralStdYards: 8, biasDeg: 0 }, [hit])).toBe('hazard');
    expect(patternColor('hazard')).toBe('#C8102E');

    const beside = [destinationPoint(center, 90, 10), destinationPoint(center, 90, 22), destinationPoint(destinationPoint(center, 90, 22), 0, 12), destinationPoint(destinationPoint(center, 90, 10), 0, 12)];
    expect(patternSafety(center, 0, { carryStdYards: 6, lateralStdYards: 6, biasDeg: 0 }, [beside])).toBe('near');
    expect(patternColor('near')).toBe('#E6A317');
  });
});

describe('confidence and plays-like chips', () => {
  it('follows the documented mix of sample, spread, and conditions', () => {
    expect(
      confidencePercent({
        sampleSize: 30,
        iqr: 0,
        stockYards: 160,
        dispersionKnown: true,
        windKnown: true,
        elevationKnown: true,
        temperatureKnown: true,
      }),
    ).toBe(100);
    expect(
      confidencePercent({
        sampleSize: 15,
        iqr: 0,
        stockYards: 160,
        dispersionKnown: true,
        windKnown: false,
        elevationKnown: false,
        temperatureKnown: false,
      }),
    ).toBe(55);
    expect(confidencePercent({ sampleSize: 30, iqr: 0, stockYards: 160, dispersionKnown: false, windKnown: true, elevationKnown: true, temperatureKnown: true })).toBeNull();
    expect(confidencePercent({ sampleSize: 0, iqr: 0, stockYards: 160, dispersionKnown: true, windKnown: true, elevationKnown: true, temperatureKnown: true })).toBeNull();
  });

  it('shows a question mark when a plays-like term is missing', () => {
    expect(componentChip('Temp', null)).toBe('Temp ?');
    expect(componentChip('Wind', 3.24)).toBe('Wind +3.2');
    expect(componentChip('Elev', -2)).toBe('Elev \u22122');
    const partial = playsLike({ rawYards: 160, headwindMph: -4, elevationFeet: null, temperatureF: null });
    expect('error' in partial).toBe(false);
    if ('error' in partial) return;
    const chips = playsLikeChips(partial);
    expect(chips.wind).toMatch(/^Wind /);
    expect(chips.elevation).toBe('Elev ?');
    expect(chips.temperature).toBe('Temp ?');
    expect(chips.temperature).not.toMatch(/cold/i);
  });
});

describe('caddie line and risk', () => {
  it('speaks only about factors that were measured', () => {
    expect(
      caddieLine({
        personality: 'funny_knowledgeable',
        clubLabel: '7-iron',
        windYards: -4,
        stockYards: 160,
        targetYards: 150,
        lowConfidence: false,
      }),
    ).toBe("Wind's helping, 7-iron's plenty. Don't be a hero.");
    const quiet = caddieLine({
      personality: 'direct_analytical',
      clubLabel: '7-iron',
      windYards: null,
      stockYards: 160,
      targetYards: 150,
      lowConfidence: false,
    });
    expect(quiet).toBe('7-iron covers the number.');
    expect(quiet).not.toMatch(/wind/i);
    expect(caddieLine({ personality: 'funny_knowledgeable', clubLabel: null, windYards: -4, stockYards: 160, targetYards: 150, lowConfidence: false })).toBeNull();
    expect(
      caddieLine({
        personality: 'funny_knowledgeable',
        clubLabel: '3H',
        windYards: -3,
        stockYards: 110,
        targetYards: 160,
        lowConfidence: false,
      }),
    ).toBe("You're 160 out. 3H gets you to about 110, so you'll need another shot.");
    expect(
      caddieLine({
        personality: 'funny_knowledgeable',
        clubLabel: '3H',
        windYards: 4,
        stockYards: 110,
        targetYards: 160,
        lowConfidence: false,
      }),
    ).toBe("Wind's in your face. You're 160 out. 3H gets you to about 110, so you'll need another shot.");
    expect(
      caddieLine({
        personality: 'funny_knowledgeable',
        clubLabel: '3H',
        windYards: -4,
        stockYards: null,
        targetYards: 160,
        lowConfidence: false,
      }),
    ).not.toMatch(/160|short of|yards short/);
    expect(
      caddieLine({
        personality: 'encouraging_coach',
        clubLabel: '7-iron',
        windYards: null,
        stockYards: null,
        targetYards: null,
        lowConfidence: true,
      }),
    ).toMatch(/thin/i);
  });

  it('names the dead side from the hazard, and stays quiet when nothing is close', () => {
    const landing = destinationPoint(tee, 0, 160);
    const short = [destinationPoint(landing, 180, 15), destinationPoint(landing, 180, 25), destinationPoint(destinationPoint(landing, 180, 25), 90, 8)];
    expect(riskCall(landing, 0, [short])?.line).toBe("Miss long here, short's dead");
    const far = [destinationPoint(landing, 90, 80), destinationPoint(landing, 90, 90), destinationPoint(destinationPoint(landing, 90, 90), 0, 8)];
    expect(riskCall(landing, 0, [far])).toBeNull();
  });
});

describe('score, labels, and feel', () => {
  it('counts only kept scores and invites a trend without a made-up handicap', () => {
    const thru = thruScore([
      { par: 5, strokes: 7, kept: true },
      { par: 4, strokes: 4, kept: false },
      { par: 3, strokes: 3, kept: true },
    ]);
    expect(thru.label).toBe('+2 thru 2');
    expect(thru.pips[0]).toBe('over');
    expect(thru.pips[1]).toBe('open');
    expect(thru.pips[2]).toBe('even');
    expect(thru.pips).toHaveLength(18);
    expect(thruScore([{ par: 4, strokes: 4, kept: false }]).label).toBeNull();
    const progress = roundProgress(1);
    expect(progress.filled).toBe(1);
    expect(progress.handicap).toBe('Play 3 rounds to see your handicap trend');
    expect(progress.gross).toBe('Play 3 rounds to see your gross');
    expect(roundProgress(Number.NaN).filled).toBe(0);
  });

  it('separates overlapping aim labels without changing their words', () => {
    const moved = nudgeLabels(
      [
        { x: 100, y: 40, w: 52, h: 28, label: '450' },
        { x: 120, y: 48, w: 52, h: 28, label: '154' },
      ],
      8,
      390,
    );
    expect(moved[0]!.label).toBe('450');
    expect(moved[1]!.label).toBe('154');
    expect(moved[1]!.x).toBeGreaterThan(120);
    const kept = visibleLabels([
      { x: 100, y: 40, w: 52, h: 28, label: '450', priority: 0 },
      { x: 108, y: 44, w: 52, h: 28, label: '158', priority: 2 },
      { x: 20, y: 200, w: 52, h: 28, label: '150', priority: 0 },
    ]);
    expect(kept.map((item) => item.label)).toEqual(['158', '150']);
    const end = destinationPoint(tee, 45, 160);
    const arc = flightArc(tee, end);
    expect(arc.length).toBeGreaterThan(2);
    expect(arc[0]).toEqual(tee);
    expect(arc[arc.length - 1]).toEqual(end);
    const crest = arc[Math.floor(arc.length / 2)]!;
    expect(distanceYards(crest, closestPointOnSegment(crest, tee, end))).toBeLessThanOrEqual(4.5);
    const bend = destinationPoint(destinationPoint(tee, 10, 120), 50, 90);
    const hole = [tee, destinationPoint(tee, 10, 120), bend];
    const offline = destinationPoint(tee, 100, 40);
    const along = flightAlongLine(hole, offline, bend);
    expect(along[along.length - 1]).toEqual(bend);
    expect(distanceYards(along[0]!, closestPointOnSegment(along[0]!, hole[0]!, hole[1]!))).toBeLessThan(1);
    for (const point of along) {
      const off = Math.min(
        ...hole.slice(1).map((vertex, index) => distanceYards(point, closestPointOnSegment(point, hole[index]!, vertex))),
      );
      expect(off).toBeLessThanOrEqual(4.5);
    }
    expect(feelFor('club')).toBe('pulse');
    expect(feelFor('mark')).toBe('celebrate');
    expect(feelFor('hole')).toBe('hole');
    expect(feelFor('score')).toBe('tick');
  });
});
