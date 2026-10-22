import type { CourseDataProvider, CourseSearchHit, OpenCourseRecord, ScorecardHole, TeeSet } from '@coopr/domain';

interface ApiCourse {
  id?: string;
  name?: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  holes?: number | null;
  par?: number | null;
  _license?: string;
  _attribution?: string;
}

interface ApiHole {
  number?: number;
  par?: number | null;
  handicap_index?: number | null;
  yardages?: Record<string, number | null> | null;
}

interface ApiTee {
  tee_key?: string;
  tee_name?: string | null;
  tee_color?: string | null;
  gender?: string | null;
  yardage?: number | null;
  par?: number | null;
  course_rating?: number | null;
  slope?: number | null;
}

function yards(raw: Record<string, number | null> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export function scorecardFromApi(holes: readonly ApiHole[]): ScorecardHole[] {
  return holes
    .filter((hole) => typeof hole.number === 'number')
    .map((hole) => ({
      holeNumber: hole.number!,
      par: typeof hole.par === 'number' ? hole.par : null,
      strokeIndex: typeof hole.handicap_index === 'number' ? hole.handicap_index : null,
      yardagesByTee: yards(hole.yardages),
    }))
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

export function teeSetsFromApi(tees: readonly ApiTee[]): TeeSet[] {
  return tees
    .filter((tee) => typeof tee.tee_key === 'string')
    .map((tee) => ({
      key: tee.tee_key!,
      name: tee.tee_name ?? null,
      color: tee.tee_color ?? null,
      gender: tee.gender ?? null,
      yardage: typeof tee.yardage === 'number' ? tee.yardage : null,
      par: typeof tee.par === 'number' ? tee.par : null,
      courseRating: typeof tee.course_rating === 'number' ? tee.course_rating : null,
      slope: typeof tee.slope === 'number' ? tee.slope : null,
    }));
}

export function openCourseFromApi(course: ApiCourse, holes: readonly ApiHole[], tees: readonly ApiTee[]): OpenCourseRecord {
  if (!course.id || !course.name) throw new Error('OpenGolfAPI course is missing an id or name');
  return {
    provider: 'opengolfapi',
    externalId: course.id,
    name: course.name,
    locality: course.city ?? null,
    region: course.state ?? null,
    latitude: typeof course.latitude === 'number' ? course.latitude : null,
    longitude: typeof course.longitude === 'number' ? course.longitude : null,
    holeCount: typeof course.holes === 'number' ? course.holes : null,
    par: typeof course.par === 'number' ? course.par : null,
    license: course._license ?? 'ODbL-1.0',
    attribution: course._attribution ?? '© OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI',
    scorecard: scorecardFromApi(holes),
    teeSets: teeSetsFromApi(tees),
  };
}

export function openGolfApiProvider(record: OpenCourseRecord | null): CourseDataProvider {
  return {
    id: 'opengolfapi',
    state: record ? 'available' : 'not_available',
    datasetClass: 'open',
    async search(query: string): Promise<readonly CourseSearchHit[]> {
      if (!record) return [];
      const haystack = `${record.name} ${record.locality ?? ''} ${record.region ?? ''}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return [];
      return [
        {
          provider: 'opengolfapi',
          externalId: record.externalId,
          name: record.name,
          locality: record.locality,
          region: record.region,
          attribution: record.attribution,
        },
      ];
    },
    async loadScorecard(externalId: string) {
      if (!record || record.externalId !== externalId) return null;
      return record;
    },
    async loadGeometry() {
      return [];
    },
  };
}

export function yardageDiscrepancies(record: OpenCourseRecord): string[] {
  const notes: string[] = [];
  for (const tee of record.teeSets) {
    if (tee.yardage == null || tee.color == null) continue;
    const key = tee.color.toLowerCase();
    const sum = record.scorecard.reduce((total, hole) => total + (hole.yardagesByTee[key] ?? 0), 0);
    const complete = record.scorecard.every((hole) => hole.yardagesByTee[key] != null);
    if (complete && sum !== tee.yardage) {
      notes.push(`${tee.name ?? tee.color} ${tee.gender ?? ''} tee set says ${tee.yardage} yards. The hole yardages sum to ${sum}. The difference is left unresolved.`);
    }
  }
  return notes;
}
