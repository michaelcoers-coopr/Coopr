import { describe, expect, it } from 'vitest';
import { loadHighCedarsPilot } from '@coopr/course';
import {
  destinationPoint,
  distanceYards,
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
import { aerialGeoref, aerialScreenProjection, aerialView } from '../src/aerial/project';
import { holeFrame, mapHudInset } from '../src/design/play-polish';
import { lineLengthYards, pointAtYards } from '../src/hole-fit';
import { holeLabels, limitYardPills } from '../src/map-labels';
import { AERIAL_OVAL_FLOOR, boxesSeparated, CAPTION_OVAL_GLOW, CARRY_CHIP, DOT_STROKE, fittedEllipse, GREEN_DOT, LABEL_GAP, layoutHoleLabels, leaderLength, LEADER_MAX, nearestMark, ovalGlowBox, pinFromPoint, sampleCaptionAt, sampleCaptionBox, YARD_CROWD_ALONG, type PlacedMapLabel } from '../src/map-label-layout';

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
    const pinDots = [
      { id: 'front' as const, at: { x: 206, y: 211 } },
      { id: 'center' as const, at: { x: 206, y: 198 } },
      { id: 'back' as const, at: { x: 206, y: 185 } },
    ];
    expect(pinFromPoint(pinDots, 206, 211)).toBe('front');
    expect(pinFromPoint(pinDots, 206, 198)).toBe('center');
    expect(pinFromPoint(pinDots, 206, 185)).toBe('back');
    expect(pinFromPoint(pinDots, 206, 206)).toBe('front');
    expect(pinFromPoint(pinDots, 206, 192)).toBe('center');
    expect(pinFromPoint(pinDots, 20, 20)).toBeNull();
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
    const flagBox = { x: 176, y: 148, w: 32, h: 44 };
    expect(boxesSeparated(sampleCaptionBox(besideTheFlag), flagBox, 8)).toBe(true);
    expect(Math.hypot(besideTheFlag.x - 180, besideTheFlag.y - 210)).toBeLessThan(90);
    const clear = sampleCaptionAt({ cx: 40, cy: 500, halfW: 20, halfH: 12 }, { x: 300, y: 80 });
    expect(clear).toEqual({ x: 40, y: 500 - 12 * CAPTION_OVAL_GLOW - 8, anchor: 'middle' });
    const vectorOval = { cx: 200, cy: 300, halfW: 37.5, halfH: 30 };
    const vectorPin = { x: 200, y: 230 };
    const vectorGreen = { x: 80, y: 200, w: 260, h: 180 };
    const vectorView = { x: 0, y: 40, w: 390, h: 520 };
    const carryAt = sampleCaptionAt(vectorOval, vectorPin, [], vectorGreen, vectorView, CARRY_CHIP);
    expect(carryAt).not.toBeNull();
    if (carryAt) {
      const carryChip = sampleCaptionBox(carryAt, CARRY_CHIP);
      const glowBox = {
        x: vectorOval.cx - vectorOval.halfW * CAPTION_OVAL_GLOW,
        y: vectorOval.cy - vectorOval.halfH * CAPTION_OVAL_GLOW,
        w: vectorOval.halfW * CAPTION_OVAL_GLOW * 2,
        h: vectorOval.halfH * CAPTION_OVAL_GLOW * 2,
      };
      expect(boxesSeparated(carryChip, glowBox, 8)).toBe(true);
      expect(boxesSeparated(carryChip, { x: vectorPin.x - 8, y: vectorPin.y - 40, w: 32, h: 44 }, 8)).toBe(true);
      expect(boxesSeparated(carryChip, vectorGreen, 8)).toBe(true);
    }
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
    const lowOval = { cx: 200, cy: 420, halfW: 30, halfH: 18 };
    const anchored = sampleCaptionAt(lowOval, null, [hud], null, { x: 0, y: 140, w: 390, h: 400 });
    expect(anchored).not.toBeNull();
    if (anchored) {
      expect(Math.hypot(anchored.x - lowOval.cx, anchored.y - lowOval.cy)).toBeLessThan(90);
      const chip = sampleCaptionBox(anchored);
      expect(chip.y).toBeGreaterThanOrEqual(140);
      expect(chip.x).toBeGreaterThan(40);
    }
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

  it('reads 450 near the tee and 150 near the green on the hole 1 aerial', () => {
    const pilot = loadHighCedarsPilot();
    const overlay = holeOverlay(pilot.features, pilot.record.scorecard, 1);
    const line = [...overlay.line];
    const geo = aerialGeoref(1);
    const landing = pointAtYards(line, 186);
    const tee = line[0];
    const pin = line[line.length - 1];
    expect(geo).toBeTruthy();
    expect(landing && tee && pin).toBeTruthy();
    if (!geo || !landing || !tee || !pin) return;
    const view = aerialView({
      imageWidth: geo.widthPx,
      imageHeight: geo.heightPx,
      viewWidth: WIDTH,
      viewHeight: HEIGHT,
      focus: 'hole',
      tee: { x: geo.teePx[0], y: geo.teePx[1] },
      green: { x: geo.greenPx[0], y: geo.greenPx[1] },
    });
    const projection = aerialScreenProjection(geo, view);
    const labels = holeLabels(line, 'yd', { at: landing, label: '186' });
    const total = lineLengthYards(line);
    for (const step of [150, 300, 450]) {
      const mark = labels.find((item) => item.label === String(step));
      if (total - step <= 1) {
        expect(mark).toBeUndefined();
        continue;
      }
      if (distanceYards(pointAtYards(line, total - step)!, landing) <= 28) {
        expect(mark).toBeUndefined();
        continue;
      }
      expect(mark, String(step)).toBeTruthy();
      const along = pointAtYards(line, total - step);
      expect(along).toBeTruthy();
      expect(distanceYards(along!, mark!.at)).toBeLessThan(1);
    }
    const pad = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 80, sheetClosed: 200 });
    const green = overlay.green ? [...overlay.green.rings] : [];
    const holeLine = line.map((point) => projection.toXY(point));
    const placed = layoutHoleLabels({
      width: WIDTH,
      height: HEIGHT,
      pad,
      line: holeLine,
      front: null,
      center: null,
      back: null,
      greenPoints: green.flatMap((ring) => ring.map((point) => projection.toXY(point))),
      labels: labels.map((label) => ({ text: label.label, at: projection.toXY(label.at) })),
    });
    const far = placed.labels.find((item) => item.text === '450');
    const close = placed.labels.find((item) => item.text === '150');
    const carry = placed.labels.find((item) => item.text === '186');
    expect(far).toBeTruthy();
    expect(close).toBeTruthy();
    expect(carry).toBeTruthy();
    if (!far || !close || !carry) return;
    const teeXY = projection.toXY(tee);
    const pinXY = projection.toXY(pin);
    expect(Math.hypot(far.anchor.x - teeXY.x, far.anchor.y - teeXY.y)).toBeLessThan(Math.hypot(close.anchor.x - teeXY.x, close.anchor.y - teeXY.y));
    expect(Math.hypot(close.anchor.x - pinXY.x, close.anchor.y - pinXY.y)).toBeLessThan(Math.hypot(far.anchor.x - pinXY.x, far.anchor.y - pinXY.y));
    const three = placed.labels.find((item) => item.text === '300');
    if (three) {
      const along = Math.abs(three.anchor.y - carry.anchor.y);
      if (along < YARD_CROWD_ALONG) {
        expect(pillSide(three.anchor, three.box, holeLine)).not.toBe(pillSide(carry.anchor, carry.box, holeLine));
        expect(boxesSeparated(three.box, carry.box, LABEL_GAP)).toBe(true);
      }
    }
    const tiny = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 3 },
    ];
    const plain = fittedEllipse(tiny);
    const aerial = fittedEllipse(tiny, AERIAL_OVAL_FLOOR);
    expect(plain && aerial).toBeTruthy();
    expect(Math.min(aerial!.halfW, aerial!.halfH) * 2).toBeGreaterThanOrEqual(AERIAL_OVAL_FLOOR);
    expect(aerial!.scale).toBeGreaterThan(plain!.scale);
  });
});
