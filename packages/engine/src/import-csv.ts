import type { DistanceMetric } from '@coopr/domain';

export interface ImportedSimShot {
  clubLabel: string;
  carry: number | null;
  total: number | null;
  lateralMiss: 'left' | 'right' | 'none';
  environment: 'simulator';
  swingMode: 'unknown';
  note: string;
}

export interface CsvImportResult {
  shots: ImportedSimShot[];
  warnings: string[];
  error: string | null;
}

const CLUB_HEADERS = new Set(['club', 'club name', 'club type']);
const CARRY_HEADERS = new Set(['carry', 'carry distance', 'carry flat', 'carry flat distance']);
const TOTAL_HEADERS = new Set(['total', 'total distance', 'total flat', 'total flat distance']);
const SIDE_HEADERS = new Set(['side', 'side distance', 'offline']);

function headerName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headerUnit(raw: string): 'yd' | 'm' | null {
  const text = raw.toLowerCase();
  if (/\[m\]|\(m\)|\bmeters?\b|\bmetres?\b/.test(text)) return 'm';
  if (/\[yds?\]|\(yds?\)|\byards?\b/.test(text)) return 'yd';
  return null;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && char === '\n') {
      row.push(cell);
      if (row.some((item) => item.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char ?? '';
  }
  row.push(cell);
  if (row.some((item) => item.trim() !== '')) rows.push(row);
  return rows;
}

function toYards(raw: string, unit: 'yd' | 'm' | null): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return unit === 'm' ? value / 0.9144 : value;
}

/**
 * Reads a TrackMan TPS-style CSV, or any file with Club plus Carry and/or Total.
 * Missing distances stay null. Carry is never copied into total.
 * A header without a unit is stored as yards and warned.
 */
export function parseSimulatorCsv(text: string): CsvImportResult {
  const rows = parseRows(text.trim());
  const header = rows[0];
  if (!header || rows.length < 2) {
    return { shots: [], warnings: [], error: 'The CSV needs a header row and at least one shot.' };
  }
  const names = header.map(headerName);
  const clubIndex = names.findIndex((name) => CLUB_HEADERS.has(name));
  const carryIndex = names.findIndex((name) => CARRY_HEADERS.has(name));
  const totalIndex = names.findIndex((name) => TOTAL_HEADERS.has(name));
  const sideIndex = names.findIndex((name) => SIDE_HEADERS.has(name));
  if (clubIndex < 0 || (carryIndex < 0 && totalIndex < 0)) {
    return {
      shots: [],
      warnings: [],
      error: `This CSV needs a Club column and a Carry or Total column. Found: ${header.join(', ')}.`,
    };
  }
  const carryUnit = carryIndex >= 0 ? headerUnit(header[carryIndex] ?? '') : null;
  const totalUnit = totalIndex >= 0 ? headerUnit(header[totalIndex] ?? '') : null;
  const warnings: string[] = [];
  if ((carryIndex >= 0 && carryUnit == null) || (totalIndex >= 0 && totalUnit == null)) {
    warnings.push('No unit on a distance header. Those numbers are stored as yards. Do not import a meter file this way.');
  }
  if (carryUnit === 'm' || totalUnit === 'm') {
    warnings.push('A meter column was converted to yards for storage. Carry and total were not copied into each other.');
  }
  if (sideIndex >= 0) warnings.push('Positive Side is stored as right. Confirm that matches this TrackMan export.');

  const shots: ImportedSimShot[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const clubLabel = (row[clubIndex] ?? '').trim();
    const carry = carryIndex >= 0 ? toYards(row[carryIndex] ?? '', carryUnit) : null;
    const total = totalIndex >= 0 ? toYards(row[totalIndex] ?? '', totalUnit) : null;
    if (!clubLabel || (carry == null && total == null)) {
      skipped += 1;
      continue;
    }
    if ((carryIndex >= 0 && (row[carryIndex] ?? '').trim() !== '' && carry == null) || (totalIndex >= 0 && (row[totalIndex] ?? '').trim() !== '' && total == null)) {
      skipped += 1;
      continue;
    }
    const sideRaw = sideIndex >= 0 ? (row[sideIndex] ?? '').trim() : '';
    const side = sideRaw === '' ? null : Number(sideRaw);
    const lateralMiss = side == null || !Number.isFinite(side) || Math.abs(side) <= 2 ? 'none' : side > 0 ? 'right' : 'left';
    const noteParts = ['TrackMan-style CSV on this device.'];
    if (carry == null) noteParts.push('Carry was blank and stays unknown.');
    if (total == null) noteParts.push('Total was blank and stays unknown.');
    shots.push({
      clubLabel,
      carry,
      total,
      lateralMiss,
      environment: 'simulator',
      swingMode: 'unknown',
      note: noteParts.join(' '),
    });
  }
  if (skipped > 0) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} skipped because the club or both distances were blank or not a number.`);
  if (shots.length === 0) {
    return { shots, warnings, error: 'No shot rows could be read.' };
  }
  return { shots, warnings, error: null };
}

export function importedMetrics(shot: ImportedSimShot): DistanceMetric[] {
  const metrics: DistanceMetric[] = [];
  if (shot.carry != null) metrics.push('carry');
  if (shot.total != null) metrics.push('total');
  return metrics;
}
