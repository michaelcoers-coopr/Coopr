export interface ExportMeasurement {
  id: string;
  clubId: string;
  shotId: string | null;
  metric: string;
  valueNum: number | null;
  valueText: string | null;
  unit: string | null;
  quality: string;
  aggregation: string;
  convertedFromMetric: null;
  deletedAtMs: number | null;
}

export interface ExportBundle {
  exportedAtMs: number;
  userId: string;
  displayName: string;
  audience: string;
  raw: string;
  measurements: readonly ExportMeasurement[];
  discrepancies: readonly { code: string; detail: string }[];
}

function cell(value: string | number | null): string {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function exportJson(bundle: ExportBundle): string {
  const visible = {
    ...bundle,
    measurements: bundle.measurements.filter((row) => row.deletedAtMs == null),
  };
  return JSON.stringify(visible, null, 2);
}

export function exportMeasurementsCsv(rows: readonly ExportMeasurement[]): string {
  const header = ['id', 'clubId', 'shotId', 'metric', 'valueNum', 'valueText', 'unit', 'quality', 'aggregation', 'convertedFromMetric'];
  const lines = [header.join(',')];
  for (const row of rows) {
    if (row.deletedAtMs != null) continue;
    lines.push(
      [
        row.id,
        row.clubId,
        row.shotId,
        row.metric,
        row.valueNum,
        row.valueText,
        row.unit,
        row.quality,
        row.aggregation,
        row.convertedFromMetric,
      ]
        .map((value) => cell(value))
        .join(','),
    );
  }
  return lines.join('\n');
}
