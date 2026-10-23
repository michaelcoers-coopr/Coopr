import { describe, expect, it } from 'vitest';
import { loadHighCedarsPilot } from '@coopr/course';
import {
  destinationPoint,
  dispersionOval,
  ellipseRing,
  flightArc,
  greenTargets,
  holeOverlay,
  PATTERN_INVITE,
  projectAlongHole,
  SAMPLE_PATTERN,
  shotBearing,
} from '@coopr/engine';
import { holeFrame, mapHudInset, patternCaption } from '../src/design/play-polish';
import { holeLabels } from '../src/map-labels';
import { boxesSeparated, LABEL_GAP, layoutHoleLabels, type PlacedMapLabel } from '../src/map-label-layout';

const WIDTH = 390;
const HEIGHT = 844;

function pairName(items: readonly PlacedMapLabel[], index: number, other: number): string {
  return `${items[index]!.text} and ${items[other]!.text}`;
}

describe('hole 1 map labels', () => {
  it('keeps every label at least 6pt apart on a 390 by 844 viewport', () => {
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
    const caption = patternCaption({
      onGreen: false,
      noShots: false,
      lowConfidence: false,
      sample: true,
      oval,
      invite: PATTERN_INVITE,
    });
    expect(caption).toBe(`Sample pattern · ±${oval!.carryStdYards} × ±${oval!.lateralStdYards} yd`);
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
    const placed = layoutHoleLabels({
      width: WIDTH,
      height: HEIGHT,
      pad,
      line: line.map((point) => projection.toXY(point)),
      flight: flight.map((point) => projection.toXY(point)),
      front: projection.toXY(marks!.front),
      center: projection.toXY(marks!.center),
      back: projection.toXY(marks!.back),
      pin: projection.toXY(line[line.length - 1]!),
      greenPoints: green.flatMap((ring) => ring.map((point) => projection.toXY(point))),
      ellipsePoints: ellipse.map((point) => projection.toXY(point)),
      labels: labels.map((label) => ({ text: label.label, at: projection.toXY(label.at) })),
      caption,
    });

    for (const label of labels) expect(placed.some((item) => item.text === label.label)).toBe(true);
    expect(placed.map((item) => item.text)).toEqual(expect.arrayContaining(['F', 'C', 'B', '156', caption!]));
    for (let index = 0; index < placed.length; index += 1) {
      for (let other = index + 1; other < placed.length; other += 1) {
        expect(boxesSeparated(placed[index]!.box, placed[other]!.box, LABEL_GAP), pairName(placed, index, other)).toBe(true);
      }
    }

    const front = projection.toXY(marks!.front);
    const back = projection.toXY(marks!.back);
    const dx = back.x - front.x;
    const dy = back.y - front.y;
    const length = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / length, y: dy / length };
    const perp = { x: -dir.y, y: dir.x };
    const f = placed.find((item) => item.text === 'F')!;
    const b = placed.find((item) => item.text === 'B')!;
    const fAlong = (f.at.x - front.x) * dir.x + (f.at.y - front.y) * dir.y;
    const fAcross = (f.at.x - front.x) * perp.x + (f.at.y - front.y) * perp.y;
    const bAcross = (b.at.x - back.x) * perp.x + (b.at.y - back.y) * perp.y;
    expect(fAlong).toBeLessThan(0);
    expect(Math.sign(fAcross)).not.toBe(Math.sign(bAcross));
  });
});
