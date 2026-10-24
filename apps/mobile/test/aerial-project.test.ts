import { describe, expect, it } from 'vitest';
import {
  AERIAL_TOLERANCE_PX,
  HIGH_CEDARS_AERIALS,
  aerialGeoref,
  aerialScreenPoint,
  aerialScreenProjection,
  aerialView,
  invertAerialPx,
  pointOnAerial,
  projectAerialPx,
} from '../src/aerial/project';

describe('aerial affine', () => {
  it('projects the five shipped vectors for each hole within 0.25 px', () => {
    expect(AERIAL_TOLERANCE_PX).toBe(0.25);
    expect(HIGH_CEDARS_AERIALS.map((geo) => geo.hole)).toEqual([1, 2]);
    for (const geo of HIGH_CEDARS_AERIALS) {
      expect(geo.tests).toHaveLength(5);
      for (const point of geo.tests) {
        const px = projectAerialPx(geo, point.lat, point.lng);
        expect(Math.hypot(px.x - point.expectedPx[0], px.y - point.expectedPx[1]), `${geo.hole} ${point.name}`).toBeLessThanOrEqual(AERIAL_TOLERANCE_PX);
        const back = invertAerialPx(geo, point.expectedPx[0], point.expectedPx[1]);
        const round = projectAerialPx(geo, back.lat, back.lng);
        expect(Math.hypot(round.x - point.expectedPx[0], round.y - point.expectedPx[1]), `${geo.hole} ${point.name} inverse`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it('has no plate geometry for any other hole', () => {
    expect(aerialGeoref(1)?.hole).toBe(1);
    expect(aerialGeoref(2)?.hole).toBe(2);
    for (const hole of [0, 3, 9, 18]) expect(aerialGeoref(hole)).toBeNull();
  });

  it('frames the full hole so the tee is near 69% and the green near 23.5%', () => {
    for (const geo of HIGH_CEDARS_AERIALS) {
      const view = aerialView({
        imageWidth: geo.widthPx,
        imageHeight: geo.heightPx,
        viewWidth: 390,
        viewHeight: 844,
        focus: 'hole',
        tee: { x: geo.teePx[0], y: geo.teePx[1] },
        green: { x: geo.greenPx[0], y: geo.greenPx[1] },
      });
      expect(view.scale, `hole ${geo.hole} scale`).toBeCloseTo(0.5, 6);
      expect(view.originX, `hole ${geo.hole} originX`).toBeCloseTo(0, 6);
      expect(view.originY, `hole ${geo.hole} originY`).toBeCloseTo(0, 6);
      const tee = aerialScreenPoint(view, { x: geo.teePx[0], y: geo.teePx[1] });
      const green = aerialScreenPoint(view, { x: geo.greenPx[0], y: geo.greenPx[1] });
      expect(tee.y / 844, `hole ${geo.hole} tee`).toBeCloseTo(0.69, 2);
      expect(green.y / 844, `hole ${geo.hole} green`).toBeCloseTo(0.235, 2);
      const anchor = geo.tests[0]!;
      const px = projectAerialPx(geo, anchor.lat, anchor.lng);
      const projected = aerialScreenProjection(geo, view).toXY({ lat: anchor.lat, lon: anchor.lng });
      const locked = aerialScreenPoint(view, px);
      expect(projected.x).toBeCloseTo(locked.x, 6);
      expect(projected.y).toBeCloseTo(locked.y, 6);
    }
  });

  it('keeps a zoomed picture covering the view, with the overlay on the same matrix', () => {
    const geo = aerialGeoref(1)!;
    for (const focus of ['tee', 'green'] as const) {
      const view = aerialView({
        imageWidth: geo.widthPx,
        imageHeight: geo.heightPx,
        viewWidth: 390,
        viewHeight: 844,
        focus,
        tee: { x: geo.teePx[0], y: geo.teePx[1] },
        green: { x: geo.greenPx[0], y: geo.greenPx[1] },
      });
      expect(view.scale).toBeGreaterThan(0.5);
      expect(view.originX).toBeLessThanOrEqual(0);
      expect(view.originY).toBeLessThanOrEqual(0);
      expect(view.originX + geo.widthPx * view.scale).toBeGreaterThanOrEqual(390);
      expect(view.originY + geo.heightPx * view.scale).toBeGreaterThanOrEqual(844);
      const anchor = focus === 'tee' ? geo.tests[0]! : geo.tests[1]!;
      const px = projectAerialPx(geo, anchor.lat, anchor.lng);
      const screen = aerialScreenProjection(geo, view).toXY({ lat: anchor.lat, lon: anchor.lng });
      expect(screen.x).toBeCloseTo(view.originX + px.x * view.scale, 5);
      expect(screen.y).toBeCloseTo(view.originY + px.y * view.scale, 5);
    }
  });

  it('treats the tee and green as on the picture and a distant fix as off it', () => {
    for (const geo of HIGH_CEDARS_AERIALS) {
      const tee = geo.tests[0]!;
      const green = geo.tests[1]!;
      expect(pointOnAerial(geo, { lat: tee.lat, lon: tee.lng }), `hole ${geo.hole} tee`).toBe(true);
      expect(pointOnAerial(geo, { lat: green.lat, lon: green.lng }), `hole ${geo.hole} green`).toBe(true);
      expect(pointOnAerial(geo, { lat: 47.2, lon: -122.24 }), `hole ${geo.hole} off`).toBe(false);
    }
  });
});
