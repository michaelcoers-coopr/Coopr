// Pure launch-monitor CSV parser. Maps common header names loosely to shot fields.
// Extracted values are STAGED — the UI must show them for confirmation before they
// touch the player model (invariant 5). Never fabricates: unrecognized columns are
// ignored, missing values stay null.

export interface ParsedShotRow {
  clubLabel: string | null;
  carryYards: number | null;
  totalYards: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  spinRateRpm: number | null;
  launchAngleDeg: number | null;
}

export interface ParsedCsv {
  headers: string[];
  recognized: Partial<Record<keyof ParsedShotRow, string>>; // field -> source header
  rows: ParsedShotRow[];
}

const SYNONYMS: Record<keyof ParsedShotRow, string[]> = {
  clubLabel: ['club', 'club name', 'clubname'],
  carryYards: ['carry', 'carry distance', 'carry (yds)', 'carry yards', 'carryyards'],
  totalYards: ['total', 'total distance', 'total (yds)', 'total yards', 'totalyards'],
  ballSpeedMph: ['ball speed', 'ball', 'ballspeed', 'ball speed (mph)'],
  clubSpeedMph: ['club speed', 'clubhead speed', 'swing speed', 'clubspeed'],
  spinRateRpm: ['spin', 'spin rate', 'backspin', 'total spin'],
  launchAngleDeg: ['launch', 'launch angle', 'launch v', 'vert launch'],
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[_"]/g, ' ').replace(/\s+/g, ' ');
}

function splitLine(line: string): string[] {
  // Minimal CSV: comma-separated, tolerant of surrounding quotes. Does not handle
  // embedded commas inside quotes — acceptable for launch-monitor exports.
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

export function parseSessionCsv(csv: string): ParsedCsv {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], recognized: {}, rows: [] };

  const headers = splitLine(lines[0]!);
  const normHeaders = headers.map(norm);

  const colIndex = {} as Record<keyof ParsedShotRow, number>;
  const recognized: ParsedCsv['recognized'] = {};
  (Object.keys(SYNONYMS) as (keyof ParsedShotRow)[]).forEach((field) => {
    const idx = normHeaders.findIndex((h) => SYNONYMS[field].includes(h));
    if (idx >= 0) {
      colIndex[field] = idx;
      recognized[field] = headers[idx]!;
    }
  });

  const numAt = (cells: string[], field: keyof ParsedShotRow): number | null => {
    const idx = colIndex[field];
    if (idx == null) return null;
    const raw = cells[idx];
    if (raw == null || raw === '') return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  const rows: ParsedShotRow[] = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const clubIdx = colIndex.clubLabel;
    return {
      clubLabel: clubIdx != null ? (cells[clubIdx] ?? null) : null,
      carryYards: numAt(cells, 'carryYards'),
      totalYards: numAt(cells, 'totalYards'),
      ballSpeedMph: numAt(cells, 'ballSpeedMph'),
      clubSpeedMph: numAt(cells, 'clubSpeedMph'),
      spinRateRpm: numAt(cells, 'spinRateRpm'),
      launchAngleDeg: numAt(cells, 'launchAngleDeg'),
    };
  });

  return { headers, recognized, rows };
}
