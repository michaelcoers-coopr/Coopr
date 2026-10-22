import type { EnvironmentName } from '@coopr/domain';

export const PHOTO_KINDS = ['launch_monitor', 'external_app', 'scorecard', 'clubs', 'unknown'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const FIELD_CONFIDENCE = ['high', 'low', 'unreadable'] as const;
export type FieldConfidence = (typeof FIELD_CONFIDENCE)[number];

export type DistanceChoice = 'carry' | 'total' | 'ambiguous';

export interface LaunchShotDraft {
  club: string | null;
  clubConfidence: FieldConfidence;
  carry: number | null;
  carryConfidence: FieldConfidence;
  total: number | null;
  totalConfidence: FieldConfidence;
  side: number | null;
  sideConfidence: FieldConfidence;
}

export interface ReportedDraft {
  club: string | null;
  metric: DistanceChoice | null;
  yards: number | null;
  yardsConfidence: FieldConfidence;
  sampleSize: number | null;
  sampleSizeConfidence: FieldConfidence;
}

export interface ScoreHoleDraft {
  hole: number;
  par: number | null;
  strokeIndex: number | null;
  yardage: number | null;
  strokes: number | null;
}

export interface ClubDraft {
  brand: string | null;
  model: string | null;
  loft: number | null;
  shaft: string | null;
  brandConfidence: FieldConfidence;
  modelConfidence: FieldConfidence;
  loftConfidence: FieldConfidence;
  shaftConfidence: FieldConfidence;
}

export interface PhotoExtraction {
  kind: PhotoKind;
  sourceApp: string | null;
  capturedOn: string | null;
  /** True only when a vision model read the bytes. A stub did not. */
  readFromImage: boolean;
  imageRetained: false;
  mode: 'live' | 'stub';
  shots: LaunchShotDraft[];
  reported: ReportedDraft[];
  holes: ScoreHoleDraft[];
  clubs: ClubDraft[];
  courseName: string | null;
  notes: string[];
}

export interface ExistingPhotoRecords {
  shots: { clubLabel: string; carry: number | null; total: number | null }[];
  reported: { sourceApp: string | null; clubLabel: string; metric: 'carry' | 'total'; yards: number }[];
  scores: { courseName: string | null; hole: number; strokes: number }[];
  clubs: { brand: string | null; model: string | null; loft: number | null }[];
}

export interface PhotoReviewItem {
  id: string;
  group: 'shot' | 'reported' | 'score' | 'club';
  include: boolean;
  /** Ambiguous metric, or a row with nothing legible. The user must fix it before it can save. */
  blockedReason: string | null;
  duplicateReason: string | null;
  club: string | null;
  metric: 'carry' | 'total' | null;
  carry: number | null;
  total: number | null;
  side: number | null;
  yards: number | null;
  sampleSize: number | null;
  environment: EnvironmentName | null;
  hole: number | null;
  par: number | null;
  strokeIndex: number | null;
  yardage: number | null;
  strokes: number | null;
  brand: string | null;
  model: string | null;
  loft: number | null;
  shaft: string | null;
  confidenceNote: string;
  sourceApp: string | null;
  capturedOn: string | null;
  courseName: string | null;
}

export interface ConfirmedPhotoImport {
  shots: {
    clubLabel: string;
    carry: number | null;
    total: number | null;
    side: number | null;
    environment: 'simulator';
    sourceApp: string | null;
    capturedOn: string | null;
  }[];
  reported: {
    clubLabel: string;
    metric: 'carry' | 'total';
    yards: number;
    sampleSize: number | null;
    environment: EnvironmentName | null;
    sourceApp: string | null;
    capturedOn: string | null;
  }[];
  scores: {
    hole: number;
    par: number | null;
    strokeIndex: number | null;
    yardage: number | null;
    strokes: number | null;
    courseName: string | null;
    sourceApp: string | null;
    capturedOn: string | null;
  }[];
  clubs: {
    brand: string | null;
    model: string | null;
    loft: number | null;
    shaft: string | null;
    label: string;
    sourceApp: string | null;
    capturedOn: string | null;
  }[];
}

const EMPTY_EXISTING: ExistingPhotoRecords = { shots: [], reported: [], scores: [], clubs: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function confidenceOf(value: unknown): FieldConfidence {
  return FIELD_CONFIDENCE.includes(value as FieldConfidence) ? (value as FieldConfidence) : 'unreadable';
}

function textField(raw: unknown, confidence: unknown, notes: string[], label: string): { value: string | null; confidence: FieldConfidence } {
  const level = confidenceOf(confidence);
  if (level === 'unreadable' || typeof raw !== 'string') {
    if (typeof raw === 'string' && raw.trim() && level === 'unreadable') notes.push(`${label} was marked unreadable and was dropped.`);
    return { value: null, confidence: 'unreadable' };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, confidence: 'unreadable' };
  return { value: trimmed.slice(0, 80), confidence: level };
}

function numberField(
  raw: unknown,
  confidence: unknown,
  notes: string[],
  label: string,
  accept: (value: number) => boolean,
): { value: number | null; confidence: FieldConfidence } {
  const level = confidenceOf(confidence);
  if (level === 'unreadable' || typeof raw !== 'number' || !Number.isFinite(raw) || !accept(raw)) {
    if (level === 'unreadable' && typeof raw === 'number' && Number.isFinite(raw)) notes.push(`${label} was marked unreadable and was dropped.`);
    else if (typeof raw === 'number' && Number.isFinite(raw) && !accept(raw)) notes.push(`${label} was outside a believable range and was dropped.`);
    return { value: null, confidence: 'unreadable' };
  }
  return { value: raw, confidence: level };
}

function yardsOk(value: number): boolean {
  return value > 0 && value <= 500;
}

function sideOk(value: number): boolean {
  return Math.abs(value) <= 150;
}

/** A sample extraction for the review screen. It is not the result of reading a photo. */
export const SAMPLE_PHOTO_PAYLOAD: unknown = {
  kind: 'unknown',
  sourceApp: null,
  capturedOn: null,
  shots: [
    { club: '7-iron', clubConfidence: 'high', carry: 158, carryConfidence: 'high', total: null, totalConfidence: 'unreadable', side: 4, sideConfidence: 'low' },
    { club: 'Driver', clubConfidence: 'high', carry: null, carryConfidence: 'unreadable', total: null, totalConfidence: 'unreadable', side: null, sideConfidence: 'unreadable' },
  ],
  reported: [
    { club: '6-iron', metric: 'ambiguous', yards: 170, yardsConfidence: 'low', sampleSize: 12, sampleSizeConfidence: 'low' },
    { club: '8-iron', metric: 'total', yards: 145, yardsConfidence: 'high', sampleSize: null, sampleSizeConfidence: 'unreadable' },
  ],
  courseName: 'Sample course',
  holes: [{ hole: 1, par: 4, strokeIndex: 7, yardage: 380, strokes: 5 }],
  clubs: [{ brand: 'Sample', model: 'Blade', loft: 34, shaft: null, brandConfidence: 'high', modelConfidence: 'low', loftConfidence: 'high', shaftConfidence: 'unreadable' }],
  notes: ['Sample fixture. No photo was read.'],
};

export function parsePhotoExtraction(input: unknown, mode: 'live' | 'stub' = 'stub'): PhotoExtraction | { error: string } {
  if (!isRecord(input)) return { error: 'The extraction was not a JSON object.' };
  const notes: string[] = [];
  if (Array.isArray(input.notes)) {
    for (const note of input.notes) {
      if (typeof note === 'string' && note.trim()) notes.push(note.trim().slice(0, 200));
    }
  }
  const kind = PHOTO_KINDS.includes(input.kind as PhotoKind) ? (input.kind as PhotoKind) : 'unknown';
  if (input.kind != null && kind === 'unknown') notes.push('The photo type was not one of the known kinds.');
  const source = textField(input.sourceApp, input.sourceApp ? 'high' : 'unreadable', notes, 'Source app');
  const capturedRaw = typeof input.capturedOn === 'string' ? input.capturedOn.trim() : '';
  const capturedOn = /^\d{4}-\d{2}-\d{2}$/.test(capturedRaw) ? capturedRaw : null;
  if (capturedRaw && !capturedOn) notes.push('A date that was not YYYY-MM-DD was dropped.');
  const course = textField(input.courseName, input.courseName ? 'low' : 'unreadable', notes, 'Course name');

  const shots: LaunchShotDraft[] = [];
  if (Array.isArray(input.shots)) {
    for (const row of input.shots) {
      if (!isRecord(row)) continue;
      const club = textField(row.club, row.clubConfidence, notes, 'Club');
      const carry = numberField(row.carry, row.carryConfidence, notes, 'Carry', yardsOk);
      const total = numberField(row.total, row.totalConfidence, notes, 'Total', yardsOk);
      const side = numberField(row.side, row.sideConfidence, notes, 'Side', sideOk);
      if (!club.value && carry.value == null && total.value == null) continue;
      shots.push({
        club: club.value,
        clubConfidence: club.confidence,
        carry: carry.value,
        carryConfidence: carry.confidence,
        total: total.value,
        totalConfidence: total.confidence,
        side: side.value,
        sideConfidence: side.confidence,
      });
    }
  }

  const reported: ReportedDraft[] = [];
  if (Array.isArray(input.reported)) {
    for (const row of input.reported) {
      if (!isRecord(row)) continue;
      const club = textField(row.club, 'high', notes, 'Reported club');
      const metric = row.metric === 'carry' || row.metric === 'total' || row.metric === 'ambiguous' ? row.metric : null;
      if (row.metric != null && metric == null) notes.push('A reported metric was not carry, total, or ambiguous, so it stays unknown.');
      const yards = numberField(row.yards, row.yardsConfidence, notes, 'Reported yards', yardsOk);
      const sampleSize = numberField(row.sampleSize, row.sampleSizeConfidence, notes, 'Sample size', (value) => Number.isInteger(value) && value >= 1 && value <= 200);
      if (!club.value && yards.value == null) continue;
      reported.push({
        club: club.value,
        metric,
        yards: yards.value,
        yardsConfidence: yards.confidence,
        sampleSize: sampleSize.value,
        sampleSizeConfidence: sampleSize.confidence,
      });
    }
  }

  const holes: ScoreHoleDraft[] = [];
  if (Array.isArray(input.holes)) {
    for (const row of input.holes) {
      if (!isRecord(row)) continue;
      const hole = typeof row.hole === 'number' && Number.isInteger(row.hole) && row.hole >= 1 && row.hole <= 18 ? row.hole : null;
      if (hole == null) {
        notes.push('A scorecard row without a hole number from 1 to 18 was dropped.');
        continue;
      }
      const par = numberField(row.par, row.par == null ? 'unreadable' : 'low', notes, 'Par', (value) => Number.isInteger(value) && value >= 3 && value <= 6);
      const strokeIndex = numberField(row.strokeIndex, row.strokeIndex == null ? 'unreadable' : 'low', notes, 'Stroke index', (value) => Number.isInteger(value) && value >= 1 && value <= 18);
      const yardage = numberField(row.yardage, row.yardage == null ? 'unreadable' : 'low', notes, 'Yardage', yardsOk);
      const strokes = numberField(row.strokes, row.strokes == null ? 'unreadable' : 'low', notes, 'Strokes', (value) => Number.isInteger(value) && value >= 1 && value <= 20);
      holes.push({ hole, par: par.value, strokeIndex: strokeIndex.value, yardage: yardage.value, strokes: strokes.value });
    }
  }

  const clubs: ClubDraft[] = [];
  if (Array.isArray(input.clubs)) {
    for (const row of input.clubs) {
      if (!isRecord(row)) continue;
      const brand = textField(row.brand, row.brandConfidence, notes, 'Brand');
      const model = textField(row.model, row.modelConfidence, notes, 'Model');
      const loft = numberField(row.loft, row.loftConfidence, notes, 'Loft', (value) => value > 0 && value <= 70);
      const shaft = textField(row.shaft, row.shaftConfidence, notes, 'Shaft');
      if (!brand.value && !model.value && loft.value == null && !shaft.value) continue;
      clubs.push({
        brand: brand.value,
        model: model.value,
        loft: loft.value,
        shaft: shaft.value,
        brandConfidence: brand.confidence,
        modelConfidence: model.confidence,
        loftConfidence: loft.confidence,
        shaftConfidence: shaft.confidence,
      });
    }
  }

  return {
    kind,
    sourceApp: source.value,
    capturedOn,
    readFromImage: false,
    imageRetained: false,
    mode,
    shots,
    reported,
    holes,
    clubs,
    courseName: course.value,
    notes,
  };
}

function clubKey(label: string | null): string {
  return (label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function close(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= 0.5;
}

function reviewShell(extraction: PhotoExtraction, partial: Partial<PhotoReviewItem> & Pick<PhotoReviewItem, 'id' | 'group'>): PhotoReviewItem {
  return {
    include: false,
    blockedReason: null,
    duplicateReason: null,
    club: null,
    metric: null,
    carry: null,
    total: null,
    side: null,
    yards: null,
    sampleSize: null,
    environment: null,
    hole: null,
    par: null,
    strokeIndex: null,
    yardage: null,
    strokes: null,
    brand: null,
    model: null,
    loft: null,
    shaft: null,
    confidenceNote: '',
    sourceApp: extraction.sourceApp,
    capturedOn: extraction.capturedOn,
    courseName: extraction.courseName,
    ...partial,
  };
}

export function reviewBlockReason(item: Pick<PhotoReviewItem, 'group' | 'club' | 'carry' | 'total' | 'metric' | 'yards' | 'brand' | 'model' | 'loft'>): string | null {
  if (item.group === 'shot') {
    if (!item.club?.trim() || (item.carry == null && item.total == null)) {
      return 'Club or both distances are unknown. Fill a club and a carry or a total, or leave it out.';
    }
  }
  if (item.group === 'reported') {
    if (item.metric !== 'carry' && item.metric !== 'total') {
      return 'The screenshot did not say whether this number is carry or total. Choose one before saving.';
    }
    if (!item.club?.trim() || item.yards == null) return 'Club or yards are unknown.';
  }
  if (item.group === 'club' && !item.brand && !item.model && item.loft == null) {
    return 'Brand, model, and loft are all unknown.';
  }
  return null;
}

export function duplicateReasonFor(item: PhotoReviewItem, existing: ExistingPhotoRecords = EMPTY_EXISTING): string | null {
  if (item.group === 'shot') {
    const duplicate = existing.shots.find((row) => {
      if (clubKey(row.clubLabel) !== clubKey(item.club)) return false;
      const checks: boolean[] = [];
      if (item.carry != null) checks.push(close(row.carry, item.carry));
      if (item.total != null) checks.push(close(row.total, item.total));
      return checks.length > 0 && checks.every(Boolean);
    });
    return duplicate ? `Already on this phone: ${duplicate.clubLabel}.` : null;
  }
  if (item.group === 'reported' && item.metric && item.club && item.yards != null) {
    const duplicate = existing.reported.find(
      (row) =>
        clubKey(row.clubLabel) === clubKey(item.club) &&
        row.metric === item.metric &&
        close(row.yards, item.yards) &&
        (row.sourceApp ?? '') === (item.sourceApp ?? ''),
    );
    return duplicate ? `Already stored as their reported ${duplicate.metric} for ${duplicate.clubLabel}.` : null;
  }
  if (item.group === 'score' && item.hole != null && item.strokes != null) {
    const duplicate = existing.scores.find(
      (row) => row.hole === item.hole && row.strokes === item.strokes && (row.courseName ?? '') === (item.courseName ?? ''),
    );
    return duplicate ? `Hole ${item.hole} already has this score.` : null;
  }
  if (item.group === 'club' && (item.brand != null || item.model != null)) {
    const duplicate = existing.clubs.find(
      (row) => clubKey(row.brand) === clubKey(item.brand) && clubKey(row.model) === clubKey(item.model) && (row.loft ?? null) === (item.loft ?? null),
    );
    return duplicate ? 'A club with this brand, model, and loft is already in the bag.' : null;
  }
  return null;
}

/** Recomputes the block and the duplicate after an edit. A row that just became readable is selected unless it is a duplicate. */
export function refreshReviewItem(
  previous: PhotoReviewItem,
  patch: Partial<PhotoReviewItem>,
  existing: ExistingPhotoRecords = EMPTY_EXISTING,
): PhotoReviewItem {
  const next = { ...previous, ...patch, id: previous.id, group: previous.group };
  const blockedReason = reviewBlockReason(next);
  const duplicateReason = duplicateReasonFor(next, existing);
  const becameValid = Boolean(previous.blockedReason) && !blockedReason;
  return {
    ...next,
    blockedReason,
    duplicateReason,
    include: blockedReason ? false : becameValid ? !duplicateReason : next.include,
  };
}

export function buildPhotoReview(extraction: PhotoExtraction, existing: ExistingPhotoRecords = EMPTY_EXISTING): PhotoReviewItem[] {
  const items: PhotoReviewItem[] = [];
  extraction.shots.forEach((shot, index) => {
    const draft = reviewShell(extraction, {
      id: `shot-${index + 1}`,
      group: 'shot',
      club: shot.club,
      carry: shot.carry,
      total: shot.total,
      side: shot.side,
      environment: 'simulator',
      confidenceNote: `Club ${shot.clubConfidence}. Carry ${shot.carryConfidence}. Total ${shot.totalConfidence}. Side ${shot.sideConfidence}.`,
    });
    const blockedReason = reviewBlockReason(draft);
    const duplicateReason = duplicateReasonFor(draft, existing);
    items.push({ ...draft, blockedReason, duplicateReason, include: !blockedReason && !duplicateReason });
  });
  extraction.reported.forEach((row, index) => {
    const draft = reviewShell(extraction, {
      id: `reported-${index + 1}`,
      group: 'reported',
      club: row.club,
      metric: row.metric === 'carry' || row.metric === 'total' ? row.metric : null,
      yards: row.yards,
      sampleSize: row.sampleSize,
      confidenceNote: `Yards ${row.yardsConfidence}. Sample size ${row.sampleSizeConfidence}. Their reported number, not a COOPR measurement.`,
    });
    const blockedReason = reviewBlockReason(draft);
    const duplicateReason = duplicateReasonFor(draft, existing);
    items.push({ ...draft, blockedReason, duplicateReason, include: !blockedReason && !duplicateReason });
  });
  extraction.holes.forEach((hole) => {
    const draft = reviewShell(extraction, {
      id: `score-${hole.hole}`,
      group: 'score',
      hole: hole.hole,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      yardage: hole.yardage,
      strokes: hole.strokes,
      confidenceNote: 'Pars and yardages from a photo stay on this import. They do not replace the open course record.',
    });
    const duplicateReason = duplicateReasonFor(draft, existing);
    items.push({ ...draft, blockedReason: null, duplicateReason, include: !duplicateReason });
  });
  extraction.clubs.forEach((club, index) => {
    const draft = reviewShell(extraction, {
      id: `club-${index + 1}`,
      group: 'club',
      brand: club.brand,
      model: club.model,
      loft: club.loft,
      shaft: club.shaft,
      confidenceNote: `Brand ${club.brandConfidence}. Model ${club.modelConfidence}. Loft ${club.loftConfidence}. Shaft ${club.shaftConfidence}.`,
    });
    const blockedReason = reviewBlockReason(draft);
    const duplicateReason = duplicateReasonFor(draft, existing);
    items.push({ ...draft, blockedReason, duplicateReason, include: !blockedReason && !duplicateReason });
  });
  return items;
}

export function confirmedPhotoImport(items: readonly PhotoReviewItem[]): ConfirmedPhotoImport | { error: string } {
  const chosen = items.filter((item) => item.include);
  const blocked = chosen.find((item) => reviewBlockReason(item));
  if (blocked) return { error: reviewBlockReason(blocked) ?? 'A selected row is incomplete.' };
  const shots: ConfirmedPhotoImport['shots'] = [];
  const reported: ConfirmedPhotoImport['reported'] = [];
  const scores: ConfirmedPhotoImport['scores'] = [];
  const clubs: ConfirmedPhotoImport['clubs'] = [];
  for (const item of chosen) {
    if (item.group === 'shot') {
      if (!item.club || (item.carry == null && item.total == null)) return { error: 'A shot needs a club and a carry or a total.' };
      shots.push({
        clubLabel: item.club,
        carry: item.carry,
        total: item.total,
        side: item.side,
        environment: 'simulator',
        sourceApp: item.sourceApp,
        capturedOn: item.capturedOn,
      });
    } else if (item.group === 'reported') {
      if (!item.club || (item.metric !== 'carry' && item.metric !== 'total') || item.yards == null) {
        return { error: 'A reported number needs a club, carry or total, and yards.' };
      }
      reported.push({
        clubLabel: item.club,
        metric: item.metric,
        yards: item.yards,
        sampleSize: item.sampleSize,
        environment: item.environment,
        sourceApp: item.sourceApp,
        capturedOn: item.capturedOn,
      });
    } else if (item.group === 'score' && item.hole != null) {
      scores.push({
        hole: item.hole,
        par: item.par,
        strokeIndex: item.strokeIndex,
        yardage: item.yardage,
        strokes: item.strokes,
        courseName: item.courseName,
        sourceApp: item.sourceApp,
        capturedOn: item.capturedOn,
      });
    } else if (item.group === 'club') {
      const label = [item.brand, item.model, item.loft != null ? `${item.loft}°` : null].filter(Boolean).join(' ');
      if (!label) return { error: 'A club needs a brand, a model, or a loft.' };
      clubs.push({
        brand: item.brand,
        model: item.model,
        loft: item.loft,
        shaft: item.shaft,
        label,
        sourceApp: item.sourceApp,
        capturedOn: item.capturedOn,
      });
    }
  }
  return { shots, reported, scores, clubs };
}

export function samplePhotoExtraction(): PhotoExtraction {
  const parsed = parsePhotoExtraction(SAMPLE_PHOTO_PAYLOAD, 'stub');
  if ('error' in parsed) throw new Error(parsed.error);
  parsed.notes = ['Sample fixture. No photo was read. Unreadable fields stay empty.'];
  return parsed;
}
