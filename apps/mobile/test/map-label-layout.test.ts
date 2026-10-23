import { describe, expect, it } from 'vitest';
import { loadHighCedarsPilot } from '@coopr/course';
import {
  destinationPoint,
  dispersionOval,
  ellipseRing,
  flightArc,
  greenTargets,
  holeOverlay,
  projectAlongHole,
  SAMPLE_PATTERN,
  shotBearing,
  type LabelBox,
} from '@coopr/engine';
import { holeFrame, mapHudInset } from '../src/design/play-polish';
import { holeLabels } from '../src/map-labels';
import { boxesSeparated, DOT_STROKE, GREEN_DOT, LABEL_GAP, layoutHoleLabels, leaderLength, LEADER_MAX, nearestMark, ovalGlowBox, type PlacedMapLabel } from '../src/map-label-layout';

const WIDTH = 390;
const HEIGHT = 844;

function pairName(items: readonly PlacedMapLabel[], index: number, other: number): string {
  return `${items[index]!.text} and ${items[other]!.text}`;
}

function greenBox(points: readonly { x: number; y: number }[]): LabelBox {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

describe('hole 1 map labels', () => {
  it('keeps dots on the green and pills attached, 6pt apart, on a 390 by 844 viewport', () => {
    const pilot = loadHighCedarsPilot();
    const overlay = holeOverlay(pilot.features, pilot.record.scorecard, 1);
    const line = [...overlay.line];
    const tee = line[0];
    const bearing = shotBearing(line);
    const greenRing = overlay.green?.rings[0];
    expect(tee).toBeTruthy();
    expect(bearing).not.toBeNull();
    expect(greenRing && greenRing.length > 3).toBe(true);
    const center = greenTargets(tee!, greenRing!)?.center;
    expect(center).toBeTruthy();
    const player = destinationPoint(center!, bearing! + 180, 156);
    const marks = greenTargets(player, greenRing!);
    expect(marks).toBeTruthy();
    const landing = destinationPoint(player, bearing!, 156);
    const oval = dispersionOval([...SAMPLE_PATTERN]);
    expect(oval).not.toBeNull();
    const ellipse = ellipseRing(landing, bearing!, oval!.carryStdYards, oval!.lateralStdYards, 36, oval!.biasDeg);
    const flight = flightArc(player, landing);
    const pad = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 80, sheetClosed: 200 });
    const fairways = overlay.fairways.flatMap((feature) => feature.rings);
    const bunkers = overlay.bunkers.flatMap((feature) => feature.rings);
    const hazards = overlay.hazards.flatMap((feature) => feature.rings);
    const green = overlay.green ? [...overlay.green.rings] : [];
    const cloud = [line, ...fairways, ...green, ...bunkers, ...hazards, ellipse, flight].flat();
    const projection = projectAlongHole(cloud, WIDTH, HEIGHT, pad, bearing!, tee!);
    const labels = holeLabels(line, 'yd', { at: landing, label: '156' });
    const front = projection.toXY(marks!.front);
    const middle = projection.toXY(marks!.center);
    const back = projection.toXY(marks!.back);
    const greenPoints = green.flatMap((ring) => ring.map((point) => projection.toXY(point)));
    const input = {
      width: WIDTH,
      height: HEIGHT,
      pad,
      line: line.map((point) => projection.toXY(point)),
      front,
      center: middle,
      back,
      greenPoints,
      ellipsePoints: ellipse.map((point) => projection.toXY(point)),
      labels: [
        ...labels.map((label) => ({ text: label.label, at: projection.toXY(label.at) })),
        { text: 'Sample pattern · ±2.8 × ±2.4 yd', at: middle },
      ],
    };
    const placed = layoutHoleLabels(input);
    const again = layoutHoleLabels(input);

    expect(GREEN_DOT).toBe(4);
    expect(DOT_STROKE).toBe(1);
    expect(placed.dots.map((dot) => dot.id)).toEqual(['front', 'center', 'back']);
    expect(placed.dots[0]!.at).toEqual(front);
    expect(placed.dots[1]!.at).toEqual(middle);
    expect(placed.dots[2]!.at).toEqual(back);
    expect(nearestMark(placed.dots, middle.x, middle.y)).toBe('center');
    expect(nearestMark(placed.dots, 0, 0)).toBeNull();
    expect(placed.labels.some((item) => item.text === 'F' || item.text === 'C' || item.text === 'B')).toBe(false);
    expect(placed.labels.some((item) => item.text.startsWith('Sample'))).toBe(false);
    expect(again.labels).toEqual(placed.labels);
    const greenRect = greenBox(greenPoints);
    const plays = placed.labels.find((item) => item.text === '156');
    expect(plays).toBeTruthy();
    expect(plays!.leader).toBe(true);
    expect(leaderLength(plays!.anchor, plays!.box)).toBeLessThanOrEqual(LEADER_MAX);
    expect(boxesSeparated(plays!.box, greenRect, 0)).toBe(true);
    const glow = ovalGlowBox(ellipse.map((point) => projection.toXY(point)));
    expect(glow).toBeTruthy();
    expect(boxesSeparated(plays!.box, glow!, LABEL_GAP)).toBe(true);
    for (const yards of ['150', '300', '450']) {
      const pill = placed.labels.find((item) => item.text === yards);
      expect(pill, yards).toBeTruthy();
      expect(leaderLength(pill!.anchor, pill!.box), yards).toBe(0);
    }

    for (const label of placed.labels) {
      expect(leaderLength(label.anchor, label.box), label.text).toBeLessThanOrEqual(LEADER_MAX);
      if (label.id.startsWith('plays')) expect(boxesSeparated(label.box, greenRect, 0), label.text).toBe(true);
    }
    for (let index = 0; index < placed.labels.length; index += 1) {
      for (let other = index + 1; other < placed.labels.length; other += 1) {
        expect(boxesSeparated(placed.labels[index]!.box, placed.labels[other]!.box, LABEL_GAP), pairName(placed.labels, index, other)).toBe(true);
      }
    }
  });
});
