import type {
  CourseDataProvider,
  GeometryVerification,
  HoleQuality,
  LatLon,
  MapFeature,
  OpenCourseRecord,
  PlayContext,
  ScorecardHole,
} from '@coopr/domain';
import { distanceToRingYards, distanceYards, greenYardsFrom, lineIntersectsRing, pointInOrOnRing, METERS_PER_YARD } from './geo';

/** Tee polygons are matched only when they sit on the tagged hole-way start. This does not name the tee. */
export const TEE_MATCH_METERS = 25;

export interface HoleGeometry {
  holeNumber: number;
  line: readonly LatLon[];
  green: MapFeature | null;
  greenStatus: 'missing' | 'one' | 'ambiguous';
}

function holeLine(feature: MapFeature): readonly LatLon[] {
  return feature.rings[0] ?? [];
}

function taggedHoleNumber(feature: MapFeature): number | null {
  return feature.kind === 'hole' ? feature.holeRef : null;
}

function containsPoint(feature: MapFeature, point: LatLon): boolean {
  return feature.rings.some((ring) => ring.length >= 3 && pointInOrOnRing(point, ring));
}

function featureNear(feature: MapFeature, point: LatLon, meters: number): boolean {
  if (containsPoint(feature, point)) return true;
  return feature.rings.some((ring) => {
    const yards = distanceToRingYards(point, ring);
    return yards != null && yards * METERS_PER_YARD <= meters;
  });
}

function intersects(feature: MapFeature, line: readonly LatLon[]): boolean {
  return feature.rings.some((ring) => lineIntersectsRing(line, ring));
}

/**
 * Championship holes are the golf=hole ways whose ref and par match the open scorecard
 * and that do not carry a handicap tag. At High Cedars the executive nine ways all have
 * handicap tags, including a par-3 hole 2 that would otherwise collide with the 18.
 */
export function championshipHoleWays(features: readonly MapFeature[], scorecard: readonly ScorecardHole[]): MapFeature[] {
  const parByHole = new Map(scorecard.map((hole) => [hole.holeNumber, hole.par]));
  return features.filter((feature) => {
    if (feature.kind !== 'hole' || feature.holeRef == null || feature.par == null) return false;
    if (feature.handicap != null) return false;
    return parByHole.get(feature.holeRef) === feature.par;
  });
}

export function associateHoleGeometry(features: readonly MapFeature[], scorecard: readonly ScorecardHole[]): HoleGeometry[] {
  const holes = championshipHoleWays(features, scorecard);
  const greens = features.filter((feature) => feature.kind === 'green');
  const result: HoleGeometry[] = [];
  for (const holeNumber of scorecard.map((hole) => hole.holeNumber)) {
    const ways = holes.filter((feature) => taggedHoleNumber(feature) === holeNumber);
    const line = ways.length === 1 ? holeLine(ways[0]!) : [];
    const end = line.length > 0 ? line[line.length - 1]! : null;
    const containing = end ? greens.filter((green) => containsPoint(green, end)) : [];
    result.push({
      holeNumber,
      line,
      green: containing.length === 1 ? containing[0]! : null,
      greenStatus: containing.length === 1 ? 'one' : containing.length === 0 ? 'missing' : 'ambiguous',
    });
  }
  return result;
}

export interface HoleOverlay {
  holeNumber: number;
  line: readonly LatLon[];
  green: MapFeature | null;
  fairways: readonly MapFeature[];
  bunkers: readonly MapFeature[];
  hazards: readonly MapFeature[];
}

/** Shapes that meet this championship hole. A polygon that misses the hole line is left out. */
export function holeOverlay(features: readonly MapFeature[], scorecard: readonly ScorecardHole[], holeNumber: number): HoleOverlay {
  const geometry = associateHoleGeometry(features, scorecard).find((hole) => hole.holeNumber === holeNumber);
  const line = geometry?.line ?? [];
  const touching = (kind: MapFeature['kind']) =>
    line.length < 2 ? [] : features.filter((feature) => feature.kind === kind && intersects(feature, line));
  return {
    holeNumber,
    line,
    green: geometry?.green ?? null,
    fairways: touching('fairway'),
    bunkers: touching('bunker'),
    hazards: touching('hazard'),
  };
}

function yardageGap(scorecard: ScorecardHole, derivedCenter: number | null): string | null {
  const published = Object.values(scorecard.yardagesByTee);
  if (derivedCenter == null || published.length === 0) return null;
  const nearest = Math.min(...published.map((yardage) => Math.abs(yardage - derivedCenter)));
  if (nearest <= 40) return null;
  return `Derived tee-to-center is ${derivedCenter.toFixed(0)} yards from the hole-way start, more than 40 yards from every published tee yardage. The start of the hole way is not treated as a surveyed tee.`;
}

export function assessHoleQuality(
  features: readonly MapFeature[],
  scorecard: readonly ScorecardHole[],
  verification: Readonly<Record<number, GeometryVerification>> = {},
): HoleQuality[] {
  const geometries = associateHoleGeometry(features, scorecard);
  const tees = features.filter((feature) => feature.kind === 'tee');
  const fairways = features.filter((feature) => feature.kind === 'fairway');
  const bunkers = features.filter((feature) => feature.kind === 'bunker');
  const hazards = features.filter((feature) => feature.kind === 'hazard');
  const pins = features.filter((feature) => feature.kind === 'pin');
  return scorecard.map((hole) => {
    const geometry = geometries.find((item) => item.holeNumber === hole.holeNumber);
    const line = geometry?.line ?? [];
    const start = line[0] ?? null;
    const green = geometry?.green ?? null;
    const teeGeometriesNearStart = start ? tees.filter((tee) => featureNear(tee, start, TEE_MATCH_METERS)).length : 0;
    const fairwaysIntersectingLine = line.length > 1 ? fairways.filter((feature) => intersects(feature, line)).length : 0;
    const greenTargets = green ? [green] : [];
    const touchesHole = (feature: MapFeature) =>
      (line.length > 1 && intersects(feature, line)) || greenTargets.some((target) => target.rings.some((ring) => intersects(feature, ring)));
    const bunkersTaggedToHole = bunkers.filter((feature) => feature.holeRef === hole.holeNumber).length;
    const hazardsTaggedToHole = hazards.filter((feature) => feature.holeRef === hole.holeNumber).length;
    const bunkersIntersecting = bunkers.filter(touchesHole).length;
    const hazardsIntersecting = hazards.filter(touchesHole).length;
    const pinsInsideGreen = green ? pins.filter((pin) => pin.rings.some((ring) => ring[0] && containsPoint(green, ring[0]))).length : 0;
    const derived = start && green?.rings[0] ? greenYardsFrom(start, green.rings[0]) : null;
    const frontCenterBackDerivable = derived != null && geometry?.greenStatus === 'one';
    const status = verification[hole.holeNumber] ?? 'unverified';
    const gaps: string[] = [];
    if (line.length < 2) gaps.push('No single golf=hole way matches this hole number and par without an executive-nine handicap tag.');
    if (geometry?.greenStatus === 'missing') gaps.push('No green polygon contains the end of the hole way. Front, center, and back are not derivable.');
    if (geometry?.greenStatus === 'ambiguous') gaps.push('More than one green polygon contains the end of the hole way. None is selected.');
    if (teeGeometriesNearStart === 0) gaps.push(`No tee geometry within ${TEE_MATCH_METERS} m of the hole-way start.`);
    else {
      const noun = teeGeometriesNearStart === 1 ? 'geometry sits' : 'geometries sit';
      gaps.push(`${teeGeometriesNearStart} tee ${noun} within ${TEE_MATCH_METERS} m of the hole-way start. None are tagged with a tee name or color, so Blue, White, Gold, and Red are not coordinates.`);
    }
    if (fairwaysIntersectingLine === 0) gaps.push('No fairway polygon intersects the hole line.');
    if (fairwaysIntersectingLine > 1) gaps.push(`${fairwaysIntersectingLine} fairway polygons intersect the hole line. The report does not pick one.`);
    if (bunkersTaggedToHole === 0 && bunkersIntersecting === 0) {
      gaps.push('No bunker is tagged with this hole number. A count of zero intersections is not proof the hole has no bunker.');
    } else if (bunkersTaggedToHole === 0) {
      const noun = bunkersIntersecting === 1 ? 'polygon intersects' : 'polygons intersect';
      const verb = bunkersIntersecting === 1 ? 'is' : 'are';
      gaps.push(
        `${bunkersIntersecting} bunker ${noun} the hole line or the associated green and ${verb} not tagged to this hole.`,
      );
    }
    if (hazardsTaggedToHole === 0 && hazardsIntersecting === 0) {
      gaps.push('No water hazard is tagged with this hole number.');
    } else if (hazardsTaggedToHole === 0) {
      const noun = hazardsIntersecting === 1 ? 'polygon intersects' : 'polygons intersect';
      const verb = hazardsIntersecting === 1 ? 'is' : 'are';
      gaps.push(
        `${hazardsIntersecting} water-hazard ${noun} the hole line or the associated green and ${verb} not tagged to this hole.`,
      );
    }
    if (frontCenterBackDerivable) gaps.push('Front, center, and back can be derived from the green polygon. They are unverified open-data distances, not a survey, and not a carry.');
    const centerGap = yardageGap(hole, derived?.centerYards ?? null);
    if (centerGap) gaps.push(centerGap);
    if (status !== 'admin_verified') gaps.push('GPS play stays on manual distance until an admin verifies this green.');
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      yardagesByTee: hole.yardagesByTee,
      teeGeometriesNearStart,
      namedTeeCoordinates: false,
      greenPolygons: geometry?.greenStatus === 'one' ? 1 : geometry?.greenStatus === 'ambiguous' ? 2 : 0,
      frontCenterBackDerivable,
      fairwaysIntersectingLine,
      bunkersTaggedToHole,
      bunkersIntersecting,
      hazardsTaggedToHole,
      hazardsIntersecting,
      pinsInsideGreen,
      verification: status,
      greenOsmId: green?.osmId ?? null,
      gaps,
    };
  });
}

export function resolveHolePlay(input: {
  verification: GeometryVerification;
  player: LatLon | null;
  greenRing: readonly LatLon[] | null;
  manualDistanceYards: number | null;
  attribution: string | null;
}): PlayContext {
  const manual = input.manualDistanceYards;
  if (input.verification !== 'admin_verified' || !input.player || !input.greenRing) {
    return {
      mode: 'manual',
      frontYards: null,
      centerYards: null,
      backYards: null,
      manualDistanceYards: manual,
      isShot: false,
      isCarry: false,
      reason:
        input.verification === 'admin_verified'
          ? 'Verified green has no player position or no polygon, so the distance stays manual.'
          : 'Green geometry is not admin-verified. Scoring and the caddie use a manual distance.',
      attribution: input.attribution,
    };
  }
  const yards = greenYardsFrom(input.player, input.greenRing);
  if (!yards) {
    return {
      mode: 'manual',
      frontYards: null,
      centerYards: null,
      backYards: null,
      manualDistanceYards: manual,
      isShot: false,
      isCarry: false,
      reason: 'The verified ring is not a polygon, so the distance stays manual.',
      attribution: input.attribution,
    };
  }
  return {
    mode: 'gps',
    frontYards: yards.frontYards,
    centerYards: yards.centerYards,
    backYards: yards.backYards,
    manualDistanceYards: manual,
    isShot: false,
    isCarry: false,
    reason: 'Ground distance to a verified green. This is not a shot and not a carry.',
    attribution: input.attribution,
  };
}

export async function resolveCourse(input: {
  courseKey: string;
  externalId: string;
  scorecard: CourseDataProvider;
  geometry: CourseDataProvider;
  commercial: CourseDataProvider;
}): Promise<{ scorecard: OpenCourseRecord | null; geometry: readonly MapFeature[]; commercialFeatures: readonly MapFeature[] }> {
  const [card, openGeometry, commercialGeometry] = await Promise.all([
    input.scorecard.loadScorecard(input.externalId),
    input.geometry.loadGeometry(input.courseKey),
    input.commercial.loadGeometry(input.courseKey),
  ]);
  if (commercialGeometry.some((feature) => feature.provenance.datasetClass !== 'proprietary')) {
    throw new Error('Commercial geometry must stay in the proprietary dataset');
  }
  if (openGeometry.some((feature) => feature.provenance.datasetClass !== 'open')) {
    throw new Error('Open geometry must stay in the open dataset');
  }
  return { scorecard: card, geometry: openGeometry, commercialFeatures: commercialGeometry };
}
