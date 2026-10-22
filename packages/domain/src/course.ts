export const DATASET_CLASSES = ['open', 'proprietary', 'none'] as const;
export type DatasetClass = (typeof DATASET_CLASSES)[number];

export interface LatLon {
  lat: number;
  lon: number;
}

/** Provenance stays on the feature. Open rows are ODbL. Proprietary rows do not copy those coordinates. */
export interface DataProvenance {
  provider: string;
  externalId: string;
  license: string;
  attribution: string;
  retrievedOn: string;
  datasetClass: DatasetClass;
  upstreamTimestamp: string | null;
}

export interface ScorecardHole {
  holeNumber: number;
  par: number | null;
  strokeIndex: number | null;
  /** Yards by tee key. Missing tees are absent, not zero. */
  yardagesByTee: Readonly<Record<string, number>>;
}

export interface TeeSet {
  key: string;
  name: string | null;
  color: string | null;
  gender: string | null;
  yardage: number | null;
  par: number | null;
  courseRating: number | null;
  slope: number | null;
}

export interface OpenCourseRecord {
  provider: 'opengolfapi';
  externalId: string;
  name: string;
  locality: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  holeCount: number | null;
  par: number | null;
  license: string;
  attribution: string;
  scorecard: readonly ScorecardHole[];
  teeSets: readonly TeeSet[];
}

export type MapFeatureKind = 'course' | 'hole' | 'tee' | 'green' | 'fairway' | 'bunker' | 'hazard' | 'pin';

export interface MapFeature {
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  kind: MapFeatureKind;
  /** Set only when the source tags a hole number. Never inferred. */
  holeRef: number | null;
  par: number | null;
  handicap: number | null;
  tags: Readonly<Record<string, string>>;
  /** Outer rings. A node is one ring with one point. A hole way is one ring of its line. */
  rings: readonly (readonly LatLon[])[];
  provenance: DataProvenance;
}

export type GeometryVerification = 'unverified' | 'admin_verified' | 'admin_rejected';

export interface HoleQuality {
  holeNumber: number;
  par: number | null;
  strokeIndex: number | null;
  yardagesByTee: Readonly<Record<string, number>>;
  teeGeometriesNearStart: number;
  namedTeeCoordinates: boolean;
  greenPolygons: number;
  frontCenterBackDerivable: boolean;
  fairwaysIntersectingLine: number;
  bunkersTaggedToHole: number;
  bunkersIntersecting: number;
  hazardsTaggedToHole: number;
  hazardsIntersecting: number;
  pinsInsideGreen: number;
  verification: GeometryVerification;
  /** OSM ids of the green used for the derivable flag. Empty when the green is missing or ambiguous. */
  greenOsmId: number | null;
  gaps: readonly string[];
}

export interface AdminReview {
  courseKey: string;
  holeNumber: number;
  osmType: string | null;
  osmId: string | null;
  decision: 'verified' | 'rejected';
  datasetClass: 'proprietary';
  note: string | null;
}

export interface CourseSearchHit {
  provider: string;
  externalId: string;
  name: string;
  locality: string | null;
  region: string | null;
  attribution: string;
}

export interface CourseDataProvider {
  readonly id: string;
  readonly state: 'available' | 'manual_import' | 'partner_required' | 'planned' | 'not_available';
  readonly datasetClass: DatasetClass;
  search(query: string): Promise<readonly CourseSearchHit[]>;
  loadScorecard(externalId: string): Promise<OpenCourseRecord | null>;
  loadGeometry(courseKey: string): Promise<readonly MapFeature[]>;
}

export interface PlayContext {
  mode: 'gps' | 'manual';
  /** Ground distance to the green. Not a carry and not a shot. */
  frontYards: number | null;
  centerYards: number | null;
  backYards: number | null;
  manualDistanceYards: number | null;
  isShot: false;
  isCarry: false;
  reason: string;
  attribution: string | null;
}
