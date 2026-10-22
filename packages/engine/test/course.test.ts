import { describe, expect, it } from 'vitest';
import type { CourseDataProvider, LatLon, MapFeature, ScorecardHole } from '@coopr/domain';
import { distanceYards, greenYardsFrom, recommend, resolveCourse, resolveHolePlay, scoreRound, assessHoleQuality, type DistanceProfile } from '@coopr/engine';

const SOUTH: LatLon = { lat: 0, lon: 0 };
const GREEN: LatLon[] = [
  { lat: 0.001, lon: -0.0005 },
  { lat: 0.001, lon: 0.0005 },
  { lat: 0.002, lon: 0.0005 },
  { lat: 0.002, lon: -0.0005 },
];

function feature(partial: Pick<MapFeature, 'osmId' | 'kind'> & Partial<MapFeature>): MapFeature {
  return {
    osmType: partial.osmType ?? 'way',
    osmId: partial.osmId,
    kind: partial.kind,
    holeRef: partial.holeRef ?? null,
    par: partial.par ?? null,
    handicap: partial.handicap ?? null,
    tags: partial.tags ?? {},
    rings: partial.rings ?? [],
    provenance: partial.provenance ?? {
      provider: 'openstreetmap',
      externalId: `way/${partial.osmId}`,
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
      retrievedOn: '2026-10-22',
      datasetClass: 'open',
      upstreamTimestamp: null,
    },
  };
}

const emptyProvider: CourseDataProvider = {
  id: 'empty',
  state: 'not_available',
  datasetClass: 'none',
  async search() {
    return [];
  },
  async loadScorecard() {
    return null;
  },
  async loadGeometry() {
    return [];
  },
};

describe('green distance', () => {
  it('measures front, center, and back in yards and does not call them a carry', () => {
    const yards = greenYardsFrom(SOUTH, GREEN);
    if (!yards) throw new Error('polygon should produce distances');
    const oneThousandthDegree = ((0.001 * Math.PI) / 180) * 6_371_000 / 0.9144;
    expect(yards.frontYards).toBeCloseTo(oneThousandthDegree, 0);
    expect(yards.centerYards).toBeCloseTo(oneThousandthDegree * 1.5, 0);
    expect(yards.backYards).toBeGreaterThan(oneThousandthDegree * 2);
    expect(yards.centerYards).toBeGreaterThan(yards.frontYards);
    expect(yards.centerYards).toBeLessThan(yards.backYards);
    expect(distanceYards(SOUTH, { lat: 0.001, lon: 0 })).toBeCloseTo(yards.frontYards, 0);
    const play = resolveHolePlay({
      verification: 'admin_verified',
      player: SOUTH,
      greenRing: GREEN,
      manualDistanceYards: 150,
      attribution: '© OpenStreetMap contributors',
    });
    expect(play.mode).toBe('gps');
    expect(play.isShot).toBe(false);
    expect(play.isCarry).toBe(false);
    expect(play.frontYards).toBeCloseTo(yards.frontYards, 5);
  });

  it('falls back to a manual distance when the green is not verified, and the caddie still runs', async () => {
    const play = resolveHolePlay({
      verification: 'unverified',
      player: SOUTH,
      greenRing: GREEN,
      manualDistanceYards: 160,
      attribution: '© OpenStreetMap contributors',
    });
    expect(play.mode).toBe('manual');
    expect(play.frontYards).toBeNull();
    expect(play.centerYards).toBeNull();
    expect(play.backYards).toBeNull();
    expect(play.manualDistanceYards).toBe(160);
    expect(scoreRound([{ hole: 1, strokes: 4 }]).gross).toBe(4);
    const profile: DistanceProfile = {
      clubId: 'club',
      clubLabel: '7-iron',
      environment: 'course',
      swingMode: 'stock',
      metric: 'carry',
      p20: 155,
      p50: 160,
      p80: 168,
      sampleSize: 12,
      iqr: 13,
      mad: 5,
      shortMissCount: 0,
      longMissCount: 0,
      shortMissShare: 0,
      longMissShare: 0,
      confidence: 'moderate',
      longestYards: 168,
      stockYards: 160,
      lateralMiss: 'none',
      blended: false,
      reported: false,
      dispersionKnown: true,
      sampleWarning: null,
    };
    const card = recommend({
      targetDistanceYards: play.manualDistanceYards ?? 0,
      targetMetric: 'carry',
      hazards: [],
      intent: 'neutral',
      riskPreference: 'neutral',
      profiles: [profile],
    });
    expect(card.posture).not.toBe('decline');
    const resolved = await resolveCourse({
      courseKey: 'missing',
      externalId: 'missing',
      scorecard: emptyProvider,
      geometry: emptyProvider,
      commercial: { ...emptyProvider, id: 'commercial-stub', state: 'partner_required', datasetClass: 'proprietary' },
    });
    expect(resolved.scorecard).toBeNull();
    expect(resolved.geometry).toEqual([]);
    expect(resolved.commercialFeatures).toEqual([]);
  });
});

describe('hole quality flags', () => {
  it('counts a contained green and refuses to assign an untagged bunker to the hole', () => {
    const scorecard: ScorecardHole[] = [{ holeNumber: 1, par: 4, strokeIndex: 1, yardagesByTee: { white: 180 } }];
    const features = [
      feature({
        osmId: 1,
        kind: 'hole',
        holeRef: 1,
        par: 4,
        rings: [[{ lat: 0, lon: 0 }, { lat: 0.0015, lon: 0 }]],
      }),
      feature({ osmId: 2, kind: 'green', rings: [GREEN] }),
      feature({
        osmId: 3,
        kind: 'bunker',
        rings: [[
          { lat: 0.01, lon: 0.01 },
          { lat: 0.0101, lon: 0.01 },
          { lat: 0.0101, lon: 0.0101 },
          { lat: 0.01, lon: 0.0101 },
        ]],
      }),
    ];
    const [hole] = assessHoleQuality(features, scorecard);
    expect(hole?.greenPolygons).toBe(1);
    expect(hole?.frontCenterBackDerivable).toBe(true);
    expect(hole?.bunkersTaggedToHole).toBe(0);
    expect(hole?.bunkersIntersecting).toBe(0);
    expect(hole?.verification).toBe('unverified');
    expect(hole?.namedTeeCoordinates).toBe(false);
    expect(hole?.gaps.join(' ')).toMatch(/not proof the hole has no bunker/);
  });
});
