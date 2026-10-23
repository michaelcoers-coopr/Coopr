import { describe, expect, it } from 'vitest';
import { destinationPoint, distanceYards, greenYardsFrom, lineMarks, projectAlongHole, projectPoints } from '../src/geo';
import {
  arrivedAtNextTee,
  classifyFinish,
  closeMarkedShot,
  gpsPreset,
  nearestHazardYards,
  scoreFace,
  stepCount,
  type WalkPolygons,
} from '../src/walk';
import type { LatLon } from '@coopr/domain';

const tee: LatLon = { lat: 47.1, lon: -122.2 };
const pin = destinationPoint(tee, 0, 420);
const line = [tee, pin];

function corridor(from: LatLon, to: LatLon, half: number): LatLon[] {
  const a = destinationPoint(from, 90, half);
  const b = destinationPoint(to, 90, half);
  const c = destinationPoint(to, 270, half);
  const d = destinationPoint(from, 270, half);
  return [a, b, c, d, a];
}

function box(center: LatLon, yards: number): LatLon[] {
  const north = destinationPoint(center, 0, yards);
  const south = destinationPoint(center, 180, yards);
  const nw = destinationPoint(north, 270, yards);
  const ne = destinationPoint(north, 90, yards);
  const se = destinationPoint(south, 90, yards);
  const sw = destinationPoint(south, 270, yards);
  return [nw, ne, se, sw, nw];
}

const fairwayFrom = destinationPoint(tee, 0, 140);
const fairwayTo = destinationPoint(tee, 0, 300);
const approach = destinationPoint(pin, 180, 160);
const hazardCenter = destinationPoint(destinationPoint(tee, 0, 180), 90, 40);
const polygons: WalkPolygons = {
  line,
  fairways: [corridor(fairwayFrom, fairwayTo, 18)],
  greens: [box(pin, 12)],
  bunkers: [],
  hazards: [box(hazardCenter, 8)],
};

describe('a round walked on simulated GPS', () => {
  it('reads the green from a tee position and never invents a missing finish', () => {
    const start = gpsPreset('tee', line, polygons.greens[0]!);
    const middle = gpsPreset('approach', line, polygons.greens[0]!);
    const green = gpsPreset('green', line, polygons.greens[0]!);
    expect(start).toEqual(tee);
    expect(middle && distanceYards(middle, pin)).toBeCloseTo(160, 0);
    const yards = start && polygons.greens[0] ? greenYardsFrom(start, polygons.greens[0]) : null;
    expect(yards).not.toBeNull();
    expect(yards!.centerYards).toBeGreaterThan(yards!.frontYards);
    expect(yards!.backYards).toBeGreaterThan(yards!.centerYards);
    expect(classifyFinish(approach, polygons)).toBe('fairway');
    expect(classifyFinish(hazardCenter, polygons)).toBe('hazard');
    expect(classifyFinish(pin, polygons)).toBe('green');
    expect(classifyFinish(destinationPoint(approach, 90, 30), polygons)).toBe('right');
    expect(classifyFinish(destinationPoint(approach, 270, 30), polygons)).toBe('left');
    expect(classifyFinish(destinationPoint(tee, 0, 360), polygons)).toBe('rough');
    expect(classifyFinish(approach, { ...polygons, line: [], fairways: [], greens: [], hazards: [], bunkers: [] })).toBeNull();
    expect(nearestHazardYards(tee, polygons.hazards)).toBeGreaterThan(0);
    expect(nearestHazardYards(tee, [])).toBeNull();
    const first = middle ? closeMarkedShot(tee, middle, polygons) : null;
    expect(first?.lie).toBe('fairway');
    expect(first?.yards).toBeGreaterThan(100);
    const blank = closeMarkedShot(tee, tee, polygons);
    expect(blank).toBeNull();
    expect(green && middle ? closeMarkedShot(middle, green, polygons)?.lie : null).toBe('green');
  });

  it('walks eighteen holes with one mark per shot, a confirm, and nothing typed', () => {
    let marks = 0;
    let confirms = 0;
    let typed = 0;
    for (let hole = 1; hole <= 18; hole += 1) {
      const start = destinationPoint(tee, 90, hole * 80);
      const holePin = destinationPoint(start, 0, 380);
      const holeLine = [start, holePin];
      const greenRing = box(holePin, 12);
      const fairway = corridor(destinationPoint(start, 0, 100), destinationPoint(start, 0, 280), 18);
      const shape: WalkPolygons = { line: holeLine, fairways: [fairway], greens: [greenRing], bunkers: [], hazards: [] };
      const atTee = gpsPreset('tee', holeLine, greenRing)!;
      const atBall = gpsPreset('approach', holeLine, greenRing)!;
      const onGreen = gpsPreset('green', holeLine, greenRing)!;
      const teeShot = closeMarkedShot(atTee, atBall, shape);
      const approachShot = closeMarkedShot(atBall, onGreen, shape);
      expect(teeShot?.yards).toBeGreaterThan(0);
      expect(approachShot?.lie).toBe('green');
      marks += 3;
      const face = scoreFace({ par: hole <= 4 || hole >= 15 ? 5 : hole % 3 === 0 ? 3 : 4, storedStrokes: null, storedPutts: null, markCount: 3 });
      expect(face.strokesConfirmed).toBe(false);
      expect(face.putts).toBe(2);
      expect(face.puttsConfirmed).toBe(false);
      expect(face.suggestion).toBe(3);
      expect(face.blowUp).toBe(false);
      const locked = scoreFace({ par: face.strokes, storedStrokes: face.strokes, storedPutts: face.putts, markCount: 3 });
      expect(locked.strokesConfirmed).toBe(true);
      expect(locked.blowUp).toBe(false);
      const blow = scoreFace({ par: 4, storedStrokes: 7, storedPutts: 2, markCount: 5 });
      expect(blow.blowUp).toBe(true);
      expect(scoreFace({ par: 4, storedStrokes: 6, storedPutts: null, markCount: 0 }).blowUp).toBe(false);
      confirms += 1;
      const nextTee = hole < 18 ? destinationPoint(tee, 90, (hole + 1) * 80) : null;
      expect(arrivedAtNextTee({ player: atTee, nextTee, currentGreen: holePin })).toBe(false);
      if (nextTee) expect(arrivedAtNextTee({ player: nextTee, nextTee, currentGreen: holePin })).toBe(true);
      expect(arrivedAtNextTee({ player: holePin, nextTee, currentGreen: holePin })).toBe(false);
    }
    expect(marks).toBe(54);
    expect(confirms).toBe(18);
    expect(typed).toBe(0);
    expect(stepCount(4, 1, 1)).toBe(5);
    expect(stepCount(2, -1, 0)).toBe(1);
    expect(stepCount(0, -1, 0)).toBe(0);
  });
});

describe('map projection', () => {
  it('insets one edge without moving the opposite inset', () => {
    const points = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 1 },
    ];
    const even = projectPoints(points, 200, 200, 20);
    const dropped = projectPoints(points, 200, 200, { top: 60, bottom: 20, left: 20, right: 20 });
    expect(even.toXY({ lat: 1, lon: 0 }).y).toBeGreaterThanOrEqual(20);
    expect(dropped.toXY({ lat: 1, lon: 0 }).y).toBeGreaterThan(even.toXY({ lat: 1, lon: 0 }).y);
  });

  it('stands an east-west hole up so the green is above the tee and the length fills the screen', () => {
    const tee = { lat: 47.45, lon: -122.2 };
    const green = destinationPoint(tee, 90, 480);
    const left = destinationPoint(destinationPoint(tee, 90, 240), 0, 30);
    const points = [tee, green, left];
    const northUp = projectPoints(points, 390, 844, 16);
    const stood = projectAlongHole(points, 390, 844, 16, 90, tee);
    const flat = Math.abs(northUp.toXY(green).y - northUp.toXY(tee).y);
    const tall = Math.abs(stood.toXY(green).y - stood.toXY(tee).y);
    expect(stood.toXY(green).y).toBeLessThan(stood.toXY(tee).y);
    expect(stood.toXY(left).x).toBeLessThan(stood.toXY(tee).x);
    expect(tall).toBeGreaterThan(flat * 3);
    expect(tall).toBeGreaterThan(700);
  });

  it('marks measured distances along the hole line', () => {
    const tee = { lat: 47.45, lon: -122.2 };
    const green = destinationPoint(tee, 0, 300);
    const marks = lineMarks([tee, green], 150);
    expect(marks.map((mark) => mark.yards)).toEqual([150, 300]);
    expect(distanceYards(tee, marks[0]!.at)).toBeCloseTo(150, 0);
    expect(lineMarks([tee], 150)).toEqual([]);
  });
});
