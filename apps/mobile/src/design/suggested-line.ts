import type { LatLon } from '@coopr/domain';
import { distanceYards } from '@coopr/engine';

/** Par 3 is one shot, par 4 is two, par 5 is three. */
export function shotsInRegulation(par: number): number {
  const hole = Number.isFinite(par) ? Math.round(par) : 4;
  if (hole <= 3) return 1;
  if (hole === 4) return 2;
  return 3;
}

function lerp(a: LatLon, b: LatLon, t: number): LatLon {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

export function lineYards(line: readonly LatLon[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) total += distanceYards(line[index - 1]!, line[index]!);
  return total;
}

export function pointAtYards(line: readonly LatLon[], yards: number): LatLon {
  const first = line[0];
  if (!first) return { lat: 0, lon: 0 };
  if (yards <= 0) return first;
  let left = yards;
  for (let index = 1; index < line.length; index += 1) {
    const span = distanceYards(line[index - 1]!, line[index]!);
    if (left <= span) return lerp(line[index - 1]!, line[index]!, span === 0 ? 0 : left / span);
    left -= span;
  }
  return line[line.length - 1]!;
}

/**
 * Ideal landings along the hole line, using the longest carries first.
 * The last shot finishes on the green. Null when the hole has no line.
 * Every point is an estimate, never a recorded shot.
 */
export function suggestedPath(line: readonly LatLon[], par: number, carries: readonly number[]): LatLon[] | null {
  if (line.length < 2) return null;
  const total = lineYards(line);
  if (!(total > 1)) return null;
  const shots = shotsInRegulation(par);
  const stock = carries.filter((yards) => Number.isFinite(yards) && yards > 0).sort((a, b) => b - a);
  const path: LatLon[] = [line[0]!];
  let walked = 0;
  for (let shot = 0; shot < shots; shot += 1) {
    const remaining = total - walked;
    const planned = shot === shots - 1 ? remaining : Math.min(stock[shot] ?? remaining, remaining);
    walked += planned;
    path.push(pointAtYards(line, walked));
  }
  const end = line[line.length - 1]!;
  const last = path[path.length - 1]!;
  if (distanceYards(last, end) > 1) path.push(end);
  return path;
}
