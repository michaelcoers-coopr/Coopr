import type { LatLon } from '@coopr/domain';
import { distanceYards, formatDistance, type DistanceUnit } from '@coopr/engine';
import { lineLengthYards, pointAtYards } from './hole-fit';

/** A mark at each requested yardage along the hole. Yardages past the hole are left out. */
export function marksAt(line: readonly LatLon[], yards: readonly number[], unit: DistanceUnit): { at: LatLon; label: string }[] {
  if (line.length < 2) return [];
  const wanted = [...yards].filter((yard) => Number.isFinite(yard) && yard > 0).sort((a, b) => a - b);
  const labels: { at: LatLon; label: string }[] = [];
  let walked = 0;
  let index = 0;
  for (let step = 1; step < line.length && index < wanted.length; step += 1) {
    const start = line[step - 1]!;
    const end = line[step]!;
    const span = distanceYards(start, end);
    if (span <= 0) continue;
    while (index < wanted.length && wanted[index]! <= walked + span + 1e-6) {
      const yard = wanted[index]!;
      const t = Math.min(1, Math.max(0, (yard - walked) / span));
      labels.push({
        at: {
          lat: start.lat + (end.lat - start.lat) * t,
          lon: start.lon + (end.lon - start.lon) * t,
        },
        label: formatDistance(yard, unit),
      });
      index += 1;
    }
    walked += span;
  }
  return labels;
}

const FAIRWAY_MARK = new Set(['150', '300', '450']);

/** While the sheet is open, keep the two fairway marks closest to the ball. Other labels stay. */
export function limitYardPills(
  labels: readonly { at: LatLon; label: string }[],
  from: LatLon | null,
  keep = 2,
): { at: LatLon; label: string }[] {
  const marks = labels.filter((label) => FAIRWAY_MARK.has(label.label));
  if (marks.length <= keep) return [...labels];
  const origin = from ?? marks[0]!.at;
  const kept = new Set(
    [...marks].sort((a, b) => distanceYards(origin, a.at) - distanceYards(origin, b.at)).slice(0, keep),
  );
  return labels.filter((label) => !FAIRWAY_MARK.has(label.label) || kept.has(label));
}

/** Yards still to play. 150 is the mark nearest the green. A mark the hole cannot hold is left out. */
const REMAINING_STEPS = [150, 300, 450] as const;

/**
 * Fairway pills are distance still to go along the line, plus the current shot.
 * 450 sits near the tee and 150 near the green. The shot label is the carry, unchanged.
 * A step that would land on the tee, past the green, or on top of the shot is left out.
 */
export function holeLabels(
  line: readonly LatLon[],
  unit: DistanceUnit,
  landing: { at: LatLon; label: string } | null,
): { at: LatLon; label: string }[] {
  const total = lineLengthYards(line);
  const labels: { at: LatLon; label: string }[] = [];
  for (const remain of REMAINING_STEPS) {
    const fromTee = total - remain;
    if (!(fromTee > 1)) continue;
    const at = pointAtYards(line, fromTee);
    if (!at) continue;
    if (landing && distanceYards(at, landing.at) <= 28) continue;
    labels.push({ at, label: formatDistance(remain, unit) });
  }
  if (landing && landing.label !== '—') labels.push(landing);
  return labels;
}
