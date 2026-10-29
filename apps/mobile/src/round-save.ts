import type { EnvironmentName } from '@coopr/domain';
import type { WedgeLength } from '@coopr/engine';

export interface SavedTag {
  id: string;
  hole: number;
  clubId: string;
  clubLabel: string;
  result: 'fairway' | 'left' | 'right' | 'short' | 'rough' | 'green' | 'hazard';
  shownYards: number | null;
  carry: number | null;
  total: number | null;
}

export interface SavedShot {
  id: string;
  clubId: string;
  clubLabel: string;
  environment: EnvironmentName;
  swingMode: string;
  carry: number | null;
  total: number | null;
  lateralMiss: 'left' | 'right' | 'none';
  origin: 'manual' | 'csv' | 'photo' | 'tag';
  sourceApp: string | null;
  capturedOn: string | null;
}

export interface SavedDebrief {
  hole: number;
  choice: 'plan' | 'swing';
  note: string;
}

export interface RoundConditions {
  wind: string;
  windChoice: 'head' | 'tail' | 'cross' | null;
  elevation: string;
  elevationChoice: 'up' | 'down' | null;
  temperature: string;
  usePlaysLike: boolean;
}

export const EMPTY_CONDITIONS: RoundConditions = {
  wind: '',
  windChoice: null,
  elevation: '',
  elevationChoice: null,
  temperature: '',
  usePlaysLike: false,
};

/** A new round applies fetched weather. An old save without the switch stays off. */
export const FRESH_CONDITIONS: RoundConditions = { ...EMPTY_CONDITIONS, usePlaysLike: true };

export type SavedLie = 'fairway' | 'rough' | 'left' | 'right' | 'green' | 'hazard';

export interface SavedMark {
  id: string;
  hole: number;
  lat: number;
  lon: number;
  clubId: string | null;
  clubLabel: string | null;
  /** Ground yards from the previous mark on this hole. Null until the next mark. Not a carry. */
  yards: number | null;
  lie: SavedLie | null;
}

export const EMPTY_PUTTS = Array.from({ length: 18 }, () => null) as Array<number | null>;

export interface RoundSave {
  version: 1;
  holes: Array<number | null>;
  currentHole: number;
  manualYards: Record<string, number>;
  tagged: SavedTag[];
  debriefs: SavedDebrief[];
  wedges: Record<string, Partial<Record<WedgeLength, number>>>;
  unit: 'yd' | 'm';
  plans: Record<string, { clubLabel: string; target: string }>;
  localShots: SavedShot[];
  /** Putts beside the score. 0 is a chip-in. Null means unknown. Never added to strokes. */
  putts: Array<number | null>;
  /** Penalty strokes beside the score. 0 is a logged zero. Null means not logged. Never added to strokes. */
  penalties: Array<number | null>;
  /** Wind, elevation, temperature, and the plays-like switch for this round. */
  conditions: RoundConditions;
  /** GPS marks. Absent on older saves. */
  marks: SavedMark[];
  /** Fairway result per hole. Null means not logged. */
  fairways: Array<'hit' | 'left' | 'right' | 'short' | 'long' | null>;
  /** Green in regulation per hole. Null means not logged. */
  girs: Array<boolean | null>;
}

export const EMPTY_FAIRWAYS = Array.from({ length: 18 }, () => null) as RoundSave['fairways'];
export const EMPTY_GIRS = Array.from({ length: 18 }, () => null) as RoundSave['girs'];

function holeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 18) return null;
  return value;
}

function positiveYards(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000) return null;
  return value;
}

function optionalYards(value: unknown): number | null | undefined {
  if (value == null) return null;
  return positiveYards(value) ?? undefined;
}

function strokesOf(value: unknown): Array<number | null> | null {
  if (!Array.isArray(value) || value.length !== 18) return null;
  const holes: Array<number | null> = [];
  for (const item of value) {
    if (item == null) {
      holes.push(null);
      continue;
    }
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > 99) return null;
    holes.push(item);
  }
  return holes;
}

function tagsOf(value: unknown): SavedTag[] {
  if (!Array.isArray(value)) return [];
  const tags: SavedTag[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const hole = holeNumber(row.hole);
    const result = row.result;
    if (!hole || typeof row.id !== 'string' || typeof row.clubId !== 'string' || typeof row.clubLabel !== 'string') continue;
    if (
      result !== 'fairway' &&
      result !== 'left' &&
      result !== 'right' &&
      result !== 'short' &&
      result !== 'rough' &&
      result !== 'green' &&
      result !== 'hazard'
    ) {
      continue;
    }
    const shown = optionalYards(row.shownYards);
    const carry = optionalYards(row.carry);
    const total = optionalYards(row.total);
    if (shown === undefined || carry === undefined || total === undefined) continue;
    tags.push({
      id: row.id,
      hole,
      clubId: row.clubId,
      clubLabel: row.clubLabel,
      result,
      shownYards: shown,
      carry,
      total,
    });
  }
  return tags;
}

function shotsOf(value: unknown): SavedShot[] {
  if (!Array.isArray(value)) return [];
  const shots: SavedShot[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const environment = row.environment;
    const origin = row.origin;
    const lateral = row.lateralMiss;
    if (typeof row.id !== 'string' || typeof row.clubId !== 'string' || typeof row.clubLabel !== 'string') continue;
    if (environment !== 'simulator' && environment !== 'range' && environment !== 'course') continue;
    if (origin !== 'manual' && origin !== 'csv' && origin !== 'photo' && origin !== 'tag') continue;
    if (lateral !== 'left' && lateral !== 'right' && lateral !== 'none') continue;
    if (typeof row.swingMode !== 'string') continue;
    const carry = optionalYards(row.carry);
    const total = optionalYards(row.total);
    if (carry === undefined || total === undefined) continue;
    shots.push({
      id: row.id,
      clubId: row.clubId,
      clubLabel: row.clubLabel,
      environment,
      swingMode: row.swingMode,
      carry,
      total,
      lateralMiss: lateral,
      origin,
      sourceApp: typeof row.sourceApp === 'string' ? row.sourceApp : null,
      capturedOn: typeof row.capturedOn === 'string' ? row.capturedOn : null,
    });
  }
  return shots;
}

function debriefsOf(value: unknown): SavedDebrief[] {
  if (!Array.isArray(value)) return [];
  const notes: SavedDebrief[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const hole = holeNumber(row.hole);
    if (!hole || (row.choice !== 'plan' && row.choice !== 'swing') || typeof row.note !== 'string' || row.note.trim() === '') continue;
    notes.push({ hole, choice: row.choice, note: row.note });
  }
  notes.sort((a, b) => a.hole - b.hole);
  return notes;
}

function wedgesOf(value: unknown): RoundSave['wedges'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const wedges: RoundSave['wedges'] = {};
  for (const [clubId, cells] of Object.entries(value)) {
    if (!cells || typeof cells !== 'object' || Array.isArray(cells)) continue;
    const next: Partial<Record<WedgeLength, number>> = {};
    for (const length of ['full', 'three_quarter', 'half'] as const) {
      const yards = positiveYards((cells as Record<string, unknown>)[length]);
      if (yards != null && yards <= 180) next[length] = yards;
    }
    if (Object.keys(next).length > 0) wedges[clubId] = next;
  }
  return wedges;
}

function yardsOf(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const yards: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const hole = holeNumber(Number(key));
    const distance = positiveYards(item);
    if (hole && distance != null) yards[String(hole)] = distance;
  }
  return yards;
}

const FAIRWAY = ['hit', 'left', 'right', 'short', 'long'] as const;

function fairwaysOf(value: unknown): RoundSave['fairways'] {
  if (!Array.isArray(value) || value.length !== 18) return [...EMPTY_FAIRWAYS];
  return value.map((item) => (typeof item === 'string' && (FAIRWAY as readonly string[]).includes(item) ? (item as RoundSave['fairways'][number]) : null));
}

function girsOf(value: unknown): RoundSave['girs'] {
  if (!Array.isArray(value) || value.length !== 18) return [...EMPTY_GIRS];
  return value.map((item) => (typeof item === 'boolean' ? item : null));
}

function puttsOf(value: unknown): Array<number | null> {
  if (!Array.isArray(value) || value.length !== 18) return [...EMPTY_PUTTS];
  return value.map((item) => {
    if (item == null) return null;
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 99) return null;
    return item;
  });
}

function numericText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed === '') return '';
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return '';
  return trimmed;
}

function conditionsOf(value: unknown): RoundConditions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_CONDITIONS };
  const row = value as Record<string, unknown>;
  const windChoice = row.windChoice === 'head' || row.windChoice === 'tail' || row.windChoice === 'cross' ? row.windChoice : null;
  const elevationChoice = row.elevationChoice === 'up' || row.elevationChoice === 'down' ? row.elevationChoice : null;
  return {
    wind: numericText(row.wind),
    windChoice,
    elevation: numericText(row.elevation),
    elevationChoice,
    temperature: numericText(row.temperature),
    usePlaysLike: row.usePlaysLike === true,
  };
}

const LIES = new Set(['fairway', 'rough', 'left', 'right', 'green', 'hazard']);

function marksOf(value: unknown): SavedMark[] {
  if (!Array.isArray(value)) return [];
  const marks: SavedMark[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const hole = holeNumber(row.hole);
    if (!hole || typeof row.id !== 'string') continue;
    if (typeof row.lat !== 'number' || typeof row.lon !== 'number' || !Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
    const yards = row.yards == null ? null : positiveYards(row.yards);
    if (row.yards != null && yards == null) continue;
    const lie = row.lie == null ? null : LIES.has(String(row.lie)) ? (row.lie as SavedMark['lie']) : null;
    if (row.lie != null && lie == null) continue;
    const clubId = row.clubId == null ? null : typeof row.clubId === 'string' ? row.clubId : null;
    const clubLabel = row.clubLabel == null ? null : typeof row.clubLabel === 'string' ? row.clubLabel : null;
    if (row.clubId != null && clubId == null) continue;
    if (row.clubLabel != null && clubLabel == null) continue;
    marks.push({ id: row.id, hole, lat: row.lat, lon: row.lon, clubId, clubLabel, yards, lie });
  }
  return marks;
}

function plansOf(value: unknown): RoundSave['plans'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const plans: RoundSave['plans'] = {};
  for (const [key, item] of Object.entries(value)) {
    const hole = holeNumber(Number(key));
    if (!hole || !item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.clubLabel !== 'string' || typeof row.target !== 'string') continue;
    plans[String(hole)] = { clubLabel: row.clubLabel, target: row.target };
  }
  return plans;
}

/** A bad scorecard is ignored. A bad yardage is dropped. Nothing is filled in. */
export function parseRoundSave(raw: string | null): RoundSave | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (row.version !== 1) return null;
  const holes = strokesOf(row.holes);
  const currentHole = holeNumber(row.currentHole);
  if (!holes || !currentHole) return null;
  if (row.unit !== 'yd' && row.unit !== 'm') return null;
  return {
    version: 1,
    holes,
    currentHole,
    manualYards: yardsOf(row.manualYards),
    tagged: tagsOf(row.tagged),
    debriefs: debriefsOf(row.debriefs),
    wedges: wedgesOf(row.wedges),
    unit: row.unit,
    plans: plansOf(row.plans),
    localShots: shotsOf(row.localShots),
    putts: puttsOf(row.putts),
    penalties: puttsOf(row.penalties),
    conditions: conditionsOf(row.conditions),
    marks: marksOf(row.marks),
    fairways: fairwaysOf(row.fairways),
    girs: girsOf(row.girs),
  };
}

export const ROUND_KEY = 'coopr.round.v1';
