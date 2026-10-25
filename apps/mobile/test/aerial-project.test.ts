import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AERIAL_DISCLOSURE,
  AERIAL_IMAGERY_CREDIT,
  AERIAL_TOLERANCE_PX,
  HIGH_CEDARS_AERIALS,
  aerialGeoref,
  aerialPhotoCredit,
  aerialScreenPoint,
  aerialScreenProjection,
  aerialTreeNote,
  aerialView,
  invertAerialPx,
  pointOnAerial,
  projectAerialPx,
} from '../src/aerial/project';

const here = dirname(fileURLToPath(import.meta.url));

describe('aerial affine', () => {
  it('projects the five shipped vectors for each hole within 0.25 px', () => {
    expect(AERIAL_TOLERANCE_PX).toBe(0.25);
    expect(HIGH_CEDARS_AERIALS.map((geo) => geo.hole)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
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

  it('has plate geometry for every High Cedars hole and nowhere else', () => {
    for (let hole = 1; hole <= 18; hole += 1) expect(aerialGeoref(hole)?.hole).toBe(hole);
    expect(aerialGeoref(0)).toBeNull();
    expect(aerialGeoref(19)).toBeNull();
  });

  it('names the three required credits and the tree note on holes 3 and 7', () => {
    expect(aerialPhotoCredit()).toEqual([
      AERIAL_IMAGERY_CREDIT,
      '© OpenStreetMap contributors',
      AERIAL_DISCLOSURE,
    ]);
    expect(AERIAL_IMAGERY_CREDIT).toBe('Imagery: USDA NAIP, 2023');
    expect(AERIAL_DISCLOSURE).toBe('Stylized and enhanced, not true-colour, not current conditions');
    expect(aerialTreeNote(3)).toBe('Green partly hidden by trees');
    expect(aerialTreeNote(7)).toBe('Green partly hidden by trees');
    for (const hole of [1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
      expect(aerialTreeNote(hole), `hole ${hole}`).toBeNull();
    }
  });

  it('bundles a webp plate and a 1x placeholder for every hole, and falls back when art is missing', () => {
    const source = readFileSync(join(here, '../src/aerial/registry.ts'), 'utf8');
    expect(source).toContain('if (!georef || !art) return null');
    expect(source).toContain('const art = ART[holeNumber] ?? null');
    for (let hole = 1; hole <= 18; hole += 1) {
      const sharp = `hole${hole}_aerial_2x.webp`;
      const placeholder = `hole${hole}_aerial_1x_placeholder.jpg`;
      expect(source, sharp).toContain(sharp);
      expect(source, placeholder).toContain(placeholder);
      expect(existsSync(join(here, '../assets/aerials', sharp)), sharp).toBe(true);
      expect(existsSync(join(here, '../assets/aerials', placeholder)), placeholder).toBe(true);
    }
    expect(source).not.toContain('hole1_aerial_2x.jpg');
    expect(source).not.toContain('hole2_aerial_2x.jpg');
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
