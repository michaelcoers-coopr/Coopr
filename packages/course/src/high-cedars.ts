import type { CourseDataProvider, HoleQuality, MapFeature, OpenCourseRecord } from '@coopr/domain';
import { assessHoleQuality } from '@coopr/engine';
import holesJson from './fixtures/high-cedars/opengolfapi-holes.json';
import courseJson from './fixtures/high-cedars/opengolfapi-course.json';
import manifest from './fixtures/high-cedars/manifest.json';
import teesJson from './fixtures/high-cedars/opengolfapi-tees.json';
import overpassJson from './fixtures/high-cedars/overpass.json';
import { commercialCourseStub } from './commercial';
import { featuresFromOverpass, type OverpassDocument } from './osm';
import { openCourseFromApi, openGolfApiProvider, yardageDiscrepancies } from './opengolfapi';

export const HIGH_CEDARS_KEY = 'high-cedars-orting';

const record = openCourseFromApi(courseJson, holesJson.holes, teesJson.tees);

const osmFeatures = featuresFromOverpass(overpassJson as unknown as OverpassDocument, {
  provider: 'openstreetmap',
  license: 'ODbL-1.0',
  attribution: '© OpenStreetMap contributors',
  retrievedOn: manifest.retrievedOn,
  datasetClass: 'open',
  upstreamTimestamp: manifest.openstreetmap.osmTimestamp,
});

export interface HighCedarsPilot {
  courseKey: string;
  record: OpenCourseRecord;
  features: readonly MapFeature[];
  quality: readonly HoleQuality[];
  attribution: string;
  osmAttribution: string;
  osmTimestamp: string;
  discrepancies: readonly string[];
  executiveHoleWays: number;
}

function executiveHoleWays(features: readonly MapFeature[]): number {
  return features.filter((feature) => feature.kind === 'hole' && feature.handicap != null).length;
}

export function loadHighCedarsPilot(): HighCedarsPilot {
  return {
    courseKey: HIGH_CEDARS_KEY,
    record,
    features: osmFeatures,
    quality: assessHoleQuality(osmFeatures, record.scorecard),
    attribution: record.attribution,
    osmAttribution: '© OpenStreetMap contributors',
    osmTimestamp: manifest.openstreetmap.osmTimestamp,
    discrepancies: yardageDiscrepancies(record),
    executiveHoleWays: executiveHoleWays(osmFeatures),
  };
}

export function highCedarsProviders(): {
  scorecard: CourseDataProvider;
  geometry: CourseDataProvider;
  commercial: CourseDataProvider;
} {
  const pilot = loadHighCedarsPilot();
  return {
    scorecard: openGolfApiProvider(pilot.record),
    geometry: {
      id: 'openstreetmap',
      state: 'available',
      datasetClass: 'open',
      async search() {
        return [];
      },
      async loadScorecard() {
        return null;
      },
      async loadGeometry(courseKey: string) {
        return courseKey === HIGH_CEDARS_KEY ? pilot.features : [];
      },
    },
    commercial: commercialCourseStub(),
  };
}

export function renderPilotReport(pilot: HighCedarsPilot): string {
  const header = [
    '# High Cedars course data',
    '',
    'Pilot course: Cedars At High Cedars Golf Club, Orting, Washington. This is the 18-hole course. The executive nine is a separate OpenGolfAPI record and is not in the hole table.',
    '',
    `Scorecard source: OpenGolfAPI \`${pilot.record.externalId}\`, license ${pilot.record.license}. ${pilot.attribution}`,
    '',
    `Geometry source: OpenStreetMap via Overpass (\`https://overpass.openstreetmap.fr/api/interpreter\`). Extract timestamp ${pilot.osmTimestamp}. ${pilot.osmAttribution}. ODbL 1.0. The main overpass-api.de endpoint returned HTTP 502 on the pull, so this is the mirror extract, not a claim the map was edited on the pull date.`,
    '',
    '## Aerial imagery (holes 1 and 2)',
    '',
    'Holes 1 and 2 can draw a stylized aerial under the vector overlay (flight, yard pills, dispersion, tee, flag, and green marks). Holes 3–18 stay on the vector map. A GPS fix that falls outside the picture falls back to that vector map too.',
    '',
    'Imagery: USDA National Agriculture Imagery Program (NAIP), 0.6 m, flown 2023-08-16, scene `wa_m_4712263_nw_10_060_20230816_20240209`, retrieved via the Microsoft Planetary Computer. NAIP is US federal public domain. The file in the app is stylized, not a true-colour photograph and not current conditions: dry August turf is recoloured, relief and a vignette are applied, and super-resolution adds texture without moving edges.',
    '',
    'Registration is a local equirectangular affine. East and north use the same math as `localMeters()` in `apps/mobile/src/hole-fit.ts` (`R = 6371000`). The shipped `matrix_px_per_meter` is used verbatim. The image center is the lat/lng center. The top-left corner is pixel (0, 0).',
    '',
    'Outlines on top of the picture are © OpenStreetMap contributors, ODbL. Greens on these holes remain unverified. Sample yardages stay labeled Sample.',
    '',
    'Credit line: Imagery: USDA NAIP, stylized. Outlines © OpenStreetMap contributors',
    '',
    'OpenGolfAPI returned par, stroke index, and tee yardages. Its tee coordinates, green polygons, fairway polygons, and hazard lists are null on every hole. Those nulls stay null. Geometry below is only what the OSM extract tags or what a stated rule derives from those tags.',
    '',
    'Association rules, and nothing else:',
    '',
    '- A championship hole way has `golf=hole`, ref 1–18, par equal to the OpenGolfAPI scorecard, and no `handicap` tag. The nine ways that do have `handicap` sum to par 29 and match the executive nine, including a par-3 hole 2 that would otherwise collide.',
    '- A green counts only when the last node of that hole way is inside exactly one green polygon. Zero or several means the green is missing or ambiguous. No green is chosen by nearness.',
    '- A tee counts when its geometry is within 25 m of the first node of the hole way. Tee features have no name or color tag, so they are not Blue, White, Gold, or Red.',
    '- A fairway, bunker, or hazard counts for a hole only when its ring intersects the hole line or the associated green. No hole number is invented for an untagged polygon.',
    '- Front, center, and back are derivable when that one green polygon exists. They are not surveyed, not verified, and not a carry. GPS play stays manual until an admin verifies the green. Nothing in this pull is verified.',
    '',
    '## Hole quality',
    '',
    '| Hole | Par | SI | White yd | Tees near start | Green polygon | F/C/B derivable | Fairways on line | Bunkers tagged / intersecting | Hazards tagged / intersecting | Pins in green | Verified |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const rows = pilot.quality.map((hole) => {
    const white = hole.yardagesByTee.white ?? '—';
    return `| ${hole.holeNumber} | ${hole.par ?? '—'} | ${hole.strokeIndex ?? '—'} | ${white} | ${hole.teeGeometriesNearStart} | ${hole.greenPolygons === 1 ? 'one' : 'none'} | ${hole.frontCenterBackDerivable ? 'yes' : 'no'} | ${hole.fairwaysIntersectingLine} | ${hole.bunkersTaggedToHole} / ${hole.bunkersIntersecting} | ${hole.hazardsTaggedToHole} / ${hole.hazardsIntersecting} | ${hole.pinsInsideGreen} | ${hole.verification} |`;
  });
  const gapLines = pilot.quality.flatMap((hole) => hole.gaps.map((gap) => `- Hole ${hole.holeNumber}: ${gap}`));
  const bunkers = pilot.features.filter((feature) => feature.kind === 'bunker').length;
  const hazards = pilot.features.filter((feature) => feature.kind === 'hazard').length;
  const footer = [
    '',
    '## Gaps',
    '',
    ...pilot.discrepancies.map((note) => `- ${note}`),
    `- ${pilot.executiveHoleWays} OSM hole ways carry a handicap tag and are excluded as the executive nine.`,
    `- ${bunkers} bunker polygons and ${hazards} water-hazard polygons are in the extract. Hole numbers on those features: none.`,
    '- OpenGolfAPI lists a White / Male tee at 6,260 yards, course rating 69.1, slope 113. That does not resolve the founder discrepancy between 69.1/113 and 70.1/115, and it is not written onto the founder round.',
    '- No admin review has verified a green. The commercial adapter is a stub: iGolf and Golf Intelligence are not licensed and contribute no rows.',
    '',
    '## Per-hole notes',
    '',
    ...gapLines,
    '',
    'Proprietary corrections, when an admin adds them, are stored as reviews that point at an OSM id. They do not overwrite the open copy. A future commercial license uses the same proprietary side and does not require a new app.',
    '',
  ];
  return [...header, ...rows, ...footer].join('\n');
}
