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
import { holeLabels, limitYardPills } from '../src/map-labels';
import { boxesSeparated, DOT_STROKE, GREEN_DOT, LABEL_GAP, layoutHoleLabels, leaderLength, LEADER_MAX, nearestMark, ovalGlowBox, sampleCaptionAt, sampleCaptionBox, type PlacedMapLabel } from '../src/map-label-layout';

const WIDTH = 390;
const HEIGHT = 844;

function pairName(items: readonly PlacedMapLabel[], index: number, other: number): string {
  return `${items[index]!.text} and ${items[other]!.text}`;
}

function pillSide(
  anchor: { x: number; y: number },
  box: LabelBox,
  line: readonly { x: number; y: number }[],
): 1 | -1 {
  const start = line[0]!;
  const end = line[line.length - 1]!;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = (box.x + box.w / 2 - anchor.x) * (-dy / length) + (box.y + box.h / 2 - anchor.y) * (dx / length);
  return offset >= 0 ? 1 : -1;
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
    const withoutOval = layoutHoleLabels({ ...input, ellipsePoints: [] });

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
    const playsBare = withoutOval.labels.find((item) => item.text === '156');
    expect(plays).toBeTruthy();
    expect(playsBare).toBeTruthy();
    expect(plays!.leader).toBe(true);
    expect(pillSide(plays!.anchor, plays!.box, input.line)).toBe(pillSide(playsBare!.anchor, playsBare!.box, input.line));
    expect(leaderLength(plays!.anchor, plays!.box)).toBeLessThanOrEqual(LEADER_MAX);
    expect(boxesSeparated(plays!.box, greenRect, 0)).toBe(true);
    const glow = ovalGlowBox(ellipse.map((point) => projection.toXY(point)));
    expect(glow).toBeTruthy();
    expect(boxesSeparated(plays!.box, glow!, LABEL_GAP)).toBe(true);
    for (const yards of ['150', '300', '450']) {
      const pill = placed.labels.find((item) => item.text === yards);
      expect(pill, yards).toBeTruthy();
      expect(leaderLength(pill!.anchor, pill!.box), yards).toBeGreaterThan(0);
      expect(leaderLength(pill!.anchor, pill!.box), yards).toBeLessThanOrEqual(LEADER_MAX);
    }

    for (const label of placed.labels) {
      expect(leaderLength(label.anchor, label.box), label.text).toBeLessThanOrEqual(LEADER_MAX);
      if (label.id.startsWith('plays')) expect(boxesSeparated(label.box, greenRect, 0), label.text).toBe(true);
    }
    const besideTheFlag = sampleCaptionAt({ cx: 180, cy: 210, halfW: 36, halfH: 18 }, { x: 184, y: 188 });
    expect(besideTheFlag).not.toBeNull();
    if (!besideTheFlag) return;
    expect(besideTheFlag.anchor).not.toBe('middle');
    expect(Math.abs(besideTheFlag.x - 180)).toBeGreaterThan(36);
    const clear = sampleCaptionAt({ cx: 40, cy: 500, halfW: 20, halfH: 12 }, { x: 300, y: 80 });
    expect(clear).toEqual({ x: 40, y: 500 - 12 - 18, anchor: 'middle' });
    const crowded = sampleCaptionAt({ cx: 200, cy: 240, halfW: 28, halfH: 16 }, null, [
      { x: 160, y: 188, w: 90, h: 30 },
      { x: 90, y: 220, w: 80, h: 40 },
    ]);
    expect(crowded).not.toBeNull();
    if (!crowded) return;
    const crowdedBox = sampleCaptionBox(crowded);
    for (const block of [
      { x: 160, y: 188, w: 90, h: 30 },
      { x: 90, y: 220, w: 80, h: 40 },
    ]) {
      expect(boxesSeparated(crowdedBox, block, 8)).toBe(true);
    }
    const greenOutline = { x: 150, y: 200, w: 140, h: 90 };
    const pill = { x: 236, y: 220, w: 40, h: 24 };
    const pin = { x: 210, y: 250 };
    const cleared = sampleCaptionAt({ cx: 200, cy: 240, halfW: 28, halfH: 16 }, pin, [pill], greenOutline, { x: 0, y: 0, w: 390, h: 500 });
    expect(cleared).not.toBeNull();
    if (!cleared) return;
    const clearedBox = sampleCaptionBox(cleared);
    const flag = { x: pin.x - 8, y: pin.y - 40, w: 32, h: 44 };
    expect(boxesSeparated(clearedBox, pill, 8)).toBe(true);
    expect(boxesSeparated(clearedBox, greenOutline, 8)).toBe(true);
    expect(boxesSeparated(clearedBox, flag, 8)).toBe(true);
    const hud = { x: 0, y: 0, w: 390, h: 140 };
    const underTheHud = sampleCaptionAt({ cx: 200, cy: 90, halfW: 28, halfH: 16 }, null, [hud], null, { x: 0, y: 140, w: 390, h: 400 });
    if (underTheHud) {
      const box = sampleCaptionBox(underTheHud);
      expect(box.y).toBeGreaterThanOrEqual(140);
      expect(boxesSeparated(box, hud, 0)).toBe(true);
    } else {
      expect(underTheHud).toBeNull();
    }
    const fairwayMarks = [
      { at: { lat: 0, lon: 0 }, label: '150' },
      { at: { lat: 0, lon: 1 }, label: '300' },
      { at: { lat: 0, lon: 2 }, label: '450' },
      { at: { lat: 1, lon: 1 }, label: '186' },
    ];
    const kept = limitYardPills(fairwayMarks, { lat: 0, lon: 0 }, 2).map((mark) => mark.label);
    expect(kept).toEqual(['150', '300', '186']);

    for (let index = 0; index < placed.labels.length; index += 1) {
      for (let other = index + 1; other < placed.labels.length; other += 1) {
        expect(boxesSeparated(placed.labels[index]!.box, placed.labels[other]!.box, LABEL_GAP), pairName(placed.labels, index, other)).toBe(true);
      }
    }
  });
});
