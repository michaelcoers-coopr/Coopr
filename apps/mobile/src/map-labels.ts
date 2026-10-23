import type { LatLon } from '@coopr/domain';
import { distanceYards, formatDistance, lineMarks, type DistanceUnit } from '@coopr/engine';

/** Yardage labels measured along the hole, plus the current shot when one exists. */
export function holeLabels(
  line: readonly LatLon[],
  unit: DistanceUnit,
  landing: { at: LatLon; label: string } | null,
): { at: LatLon; label: string }[] {
  const stepped = lineMarks(line, 150).filter((mark) => landing == null || distanceYards(mark.at, landing.at) > 28);
  const labels = stepped.map((mark) => ({ at: mark.at, label: formatDistance(mark.yards, unit) }));
  if (landing && landing.label !== '—') labels.push(landing);
  return labels;
}
