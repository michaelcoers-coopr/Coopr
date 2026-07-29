import type { Shot } from '@coopr/core';

// Data portability (invariant 8): the golfer can export their full history as CSV or
// JSON. Pure string builders — the share/file step wires in with expo-file-system +
// expo-sharing. No data-hostage mechanics.

const SHOT_COLUMNS: Array<keyof Shot> = [
  'id', 'clubLabel', 'sessionDate', 'environment', 'swingMode', 'carryYards', 'totalYards',
  'offlineYards', 'side', 'clubSpeedMph', 'ballSpeedMph', 'smashFactor', 'launchAngleDeg',
  'spinRateRpm', 'qualityLabel', 'notes',
];

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildShotsCsv(shots: Shot[]): string {
  const header = SHOT_COLUMNS.join(',');
  const rows = shots.map((s) => SHOT_COLUMNS.map((c) => csvCell(s[c])).join(','));
  return [header, ...rows].join('\n');
}

export function buildShotsJson(shots: Shot[]): string {
  return JSON.stringify({ version: 1, exportedShots: shots.length, shots }, null, 2);
}
