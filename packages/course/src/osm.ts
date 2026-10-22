import type { DataProvenance, LatLon, MapFeature, MapFeatureKind } from '@coopr/domain';

interface OsmPoint {
  lat: number;
  lon: number;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string | undefined>;
  geometry?: OsmPoint[];
  members?: Array<{ role?: string; geometry?: OsmPoint[] }>;
}

export interface OverpassDocument {
  osm3s?: { timestamp_osm_base?: string; copyright?: string };
  elements?: OsmElement[];
}

const KINDS: Record<string, MapFeatureKind> = {
  hole: 'hole',
  tee: 'tee',
  green: 'green',
  fairway: 'fairway',
  bunker: 'bunker',
  water_hazard: 'hazard',
  lateral_water_hazard: 'hazard',
  hazard: 'hazard',
  pin: 'pin',
};

function points(raw: readonly OsmPoint[] | undefined): LatLon[] {
  return (raw ?? []).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon)).map((point) => ({ lat: point.lat, lon: point.lon }));
}

function ringsOf(element: OsmElement): LatLon[][] {
  if (element.type === 'node' && element.lat != null && element.lon != null) return [[{ lat: element.lat, lon: element.lon }]];
  if (element.type === 'way') {
    const ring = points(element.geometry);
    return ring.length > 0 ? [ring] : [];
  }
  const outers = (element.members ?? [])
    .filter((member) => member.role === 'outer' || member.role === '')
    .map((member) => points(member.geometry))
    .filter((ring) => ring.length > 0);
  return outers;
}

function holeRef(tags: Record<string, string>): number | null {
  if (!tags.ref || !/^\d+$/.test(tags.ref)) return null;
  const value = Number(tags.ref);
  return value >= 1 && value <= 18 ? value : null;
}

function optionalInt(value: string | undefined): number | null {
  if (!value || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}

export function featuresFromOverpass(document: OverpassDocument, provenance: Omit<DataProvenance, 'externalId'>): MapFeature[] {
  const features: MapFeature[] = [];
  for (const element of document.elements ?? []) {
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(element.tags ?? {})) {
      if (typeof value === 'string') tags[key] = value;
    }
    const kind = tags.leisure === 'golf_course' ? 'course' : KINDS[tags.golf ?? ''];
    if (!kind) continue;
    const rings = ringsOf(element);
    if (rings.length === 0) continue;
    features.push({
      osmType: element.type,
      osmId: element.id,
      kind,
      holeRef: kind === 'hole' ? holeRef(tags) : holeRef(tags),
      par: optionalInt(tags.par),
      handicap: optionalInt(tags.handicap),
      tags,
      rings,
      provenance: { ...provenance, externalId: `${element.type}/${element.id}` },
    });
  }
  return features;
}
