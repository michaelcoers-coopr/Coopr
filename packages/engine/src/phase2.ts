import type { LatLon } from '@coopr/domain';
import { bearingDegrees } from './geo';
import type { DistanceProfile } from './profile';
import { median, quantileType7 } from './stats';

/**
 * Plays-like is an adjustment of the number on screen. It is not a measurement,
 * not a carry, and not a total. Each term is shown beside the raw yardage.
 *
 * Wind: 1% of the raw yardage per 1 mph of headwind, subtracted for a tailwind.
 * A crosswind is not turned into yards.
 * Elevation: 1 yard per 3 feet. Uphill adds.
 * Temperature: 2 yards per 10°F away from 75°F, scaled by raw / 250. Warmer adds.
 */
export const PLAYS_LIKE_RULES = {
  windFractionPerMph: 0.01,
  yardsPerFoot: 1 / 3,
  temperatureReferenceF: 75,
  yardsPer10FAt250: 2,
  referenceDistance: 250,
  maxWindFraction: 0.4,
} as const;

export interface PlaysLikeInput {
  rawYards: number;
  /** Positive is a headwind. Negative is a tailwind. Null when the wind is unknown. */
  headwindMph: number | null;
  /** Positive is uphill. Null when the elevation change is unknown. */
  elevationFeet: number | null;
  /** Null when the temperature was not read and not typed. */
  temperatureF: number | null;
}

export interface PlaysLikeTerm {
  yards: number;
  note: string;
}

export interface PlaysLikeResult {
  rawYards: number;
  /** Null until wind, elevation, and temperature are all known. */
  playsLikeYards: number | null;
  wind: PlaysLikeTerm | null;
  elevation: PlaysLikeTerm | null;
  temperature: PlaysLikeTerm | null;
  missing: string[];
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function playsLike(input: PlaysLikeInput): PlaysLikeResult | { error: string } {
  if (!Number.isFinite(input.rawYards) || input.rawYards <= 0 || input.rawYards > 500) {
    return { error: 'Plays-like needs a raw distance above 0 and at most 500 yards.' };
  }
  const missing: string[] = [];
  let wind: PlaysLikeTerm | null = null;
  let elevation: PlaysLikeTerm | null = null;
  let temperature: PlaysLikeTerm | null = null;
  if (input.headwindMph == null || !Number.isFinite(input.headwindMph)) missing.push('wind');
  else {
    const capped = Math.max(-80, Math.min(80, input.headwindMph));
    let yards = input.rawYards * PLAYS_LIKE_RULES.windFractionPerMph * capped;
    const cap = input.rawYards * PLAYS_LIKE_RULES.maxWindFraction;
    if (Math.abs(yards) > cap) yards = Math.sign(yards) * cap;
    const direction = capped > 0.5 ? 'headwind' : capped < -0.5 ? 'tailwind' : 'crosswind';
    wind = {
      yards: roundTenth(yards),
      note: `${Math.abs(roundTenth(capped))} mph ${direction}. 1% of the raw distance per mph. A crosswind adds nothing.`,
    };
  }
  if (input.elevationFeet == null || !Number.isFinite(input.elevationFeet)) missing.push('elevation');
  else {
    const feet = Math.max(-400, Math.min(400, input.elevationFeet));
    const yards = feet * PLAYS_LIKE_RULES.yardsPerFoot;
    const way = feet > 0.5 ? 'uphill' : feet < -0.5 ? 'downhill' : 'level';
    elevation = {
      yards: roundTenth(yards),
      note: `${roundTenth(feet)} ft ${way}. 1 yard per 3 feet. A rule of thumb, not a survey.`,
    };
  }
  if (input.temperatureF == null || !Number.isFinite(input.temperatureF)) missing.push('temperature');
  else {
    const temp = Math.max(-20, Math.min(130, input.temperatureF));
    const yards = ((temp - PLAYS_LIKE_RULES.temperatureReferenceF) / 10) * PLAYS_LIKE_RULES.yardsPer10FAt250 * (input.rawYards / PLAYS_LIKE_RULES.referenceDistance);
    temperature = {
      yards: roundTenth(yards),
      note: `${roundTenth(temp)}°F. 2 yards per 10°F from 75°F, scaled by the raw distance over 250.`,
    };
  }
  const playsLikeYards =
    wind && elevation && temperature ? roundTenth(input.rawYards + wind.yards + elevation.yards + temperature.yards) : null;
  return { rawYards: input.rawYards, playsLikeYards, wind, elevation, temperature, missing };
}

/** Positive means the wind is in the face along the shot. Wind-from is meteorological degrees. */
export function headwindMph(input: { windFromDeg: number; windMph: number; shotBearingDeg: number }): number | null {
  if (!Number.isFinite(input.windMph) || input.windMph < 0 || input.windMph > 120) return null;
  if (!Number.isFinite(input.windFromDeg) || !Number.isFinite(input.shotBearingDeg)) return null;
  const delta = ((input.shotBearingDeg - input.windFromDeg) * Math.PI) / 180;
  return roundTenth(input.windMph * Math.cos(delta));
}

export function elevationChangeFeet(playerMeters: number, targetMeters: number): number | null {
  if (!Number.isFinite(playerMeters) || !Number.isFinite(targetMeters)) return null;
  return roundTenth((targetMeters - playerMeters) * 3.280839895);
}

export function openMeteoCurrentUrl(lat: number, lon: number): string {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,wind_speed_10m,wind_direction_10m',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  });
  return `https://api.open-meteo.com/v1/forecast?${query}`;
}

export function openMeteoElevationUrl(points: readonly LatLon[]): string {
  return `https://api.open-meteo.com/v1/elevation?latitude=${points.map((point) => point.lat).join(',')}&longitude=${points.map((point) => point.lon).join(',')}`;
}

export interface OpenMeteoCurrent {
  temperatureF: number;
  windMph: number;
  windFromDeg: number;
}

export function parseOpenMeteoCurrent(payload: unknown): OpenMeteoCurrent | { error: string } {
  if (typeof payload !== 'object' || payload === null) return { error: 'Weather was not JSON.' };
  const current = (payload as { current?: unknown }).current;
  if (typeof current !== 'object' || current === null) return { error: 'Weather had no current observation.' };
  const row = current as { temperature_2m?: unknown; wind_speed_10m?: unknown; wind_direction_10m?: unknown };
  if (typeof row.temperature_2m !== 'number' || typeof row.wind_speed_10m !== 'number' || typeof row.wind_direction_10m !== 'number') {
    return { error: 'Weather left out temperature or wind. Nothing was filled in.' };
  }
  return { temperatureF: row.temperature_2m, windMph: row.wind_speed_10m, windFromDeg: row.wind_direction_10m };
}

export function parseOpenMeteoElevation(payload: unknown): { meters: number[] } | { error: string } {
  if (typeof payload !== 'object' || payload === null) return { error: 'Elevation was not JSON.' };
  const elevation = (payload as { elevation?: unknown }).elevation;
  if (!Array.isArray(elevation) || elevation.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return { error: 'Elevation was missing. Nothing was filled in.' };
  }
  return { meters: elevation as number[] };
}

export interface MissMark {
  side: 'left' | 'right' | 'fairway' | 'short' | 'hazard' | 'none';
  /** Positive is right. Null when the miss was tagged without a yardage. */
  sideYards: number | null;
}

export interface MissReport {
  left: number;
  right: number;
  sampleSize: number;
  side: 'left' | 'right' | 'unknown';
  /** Yards to move the aim. Negative is left. Null when fewer than five measured sides exist. */
  aimOffsetYards: number | null;
  note: string;
}

export function missReport(marks: readonly MissMark[]): MissReport {
  const left = marks.filter((mark) => mark.side === 'left').length;
  const right = marks.filter((mark) => mark.side === 'right').length;
  const sided = left + right;
  const side: MissReport['side'] = sided >= 3 && left !== right ? (left > right ? 'left' : 'right') : 'unknown';
  const yards = marks.map((mark) => mark.sideYards).filter((value): value is number => value != null && Number.isFinite(value) && Math.abs(value) <= 80);
  let aimOffsetYards: number | null = null;
  let note = `Miss side is ${side} from ${left} left and ${right} right out of ${marks.length} shots.`;
  if (yards.length >= 5) {
    const pattern = median(yards);
    aimOffsetYards = roundTenth(-pattern);
    const way = aimOffsetYards < -0.5 ? 'left' : aimOffsetYards > 0.5 ? 'right' : 'on the target';
    note += ` The median miss is ${roundTenth(pattern)} yards ${pattern > 0 ? 'right' : pattern < 0 ? 'left' : 'on line'} from ${yards.length} measured sides. Aim offset is ${Math.abs(aimOffsetYards)} yards ${way}. This is the pattern, not a new measurement.`;
  } else {
    note += ' No yard offset is stored until five measured sides exist.';
  }
  if (side === 'unknown' && yards.length < 5) note = `Miss side is unknown. ${left} left and ${right} right out of ${marks.length} shots. No yard offset is stored.`;
  return { left, right, sampleSize: marks.length, side, aimOffsetYards, note };
}

export const WEDGE_LENGTHS = ['full', 'three_quarter', 'half'] as const;
export type WedgeLength = (typeof WEDGE_LENGTHS)[number];

export function wedgeCarry(raw: number | null): number | null | { error: string } {
  if (raw == null) return null;
  if (!Number.isFinite(raw) || raw <= 0 || raw > 180) return { error: 'A wedge carry stays empty unless it is between 0 and 180 yards.' };
  return roundTenth(raw);
}

export interface DispersionShape {
  metric: 'carry' | 'total';
  centerYards: number;
  alongYards: number;
  sampleSize: number;
  note: string;
}

/** Half the P20–P80 gap. A reported average with no dispersion returns null. */
export function dispersionShape(profile: Pick<DistanceProfile, 'metric' | 'dispersionKnown' | 'p20' | 'p80' | 'stockYards' | 'sampleSize'> | null): DispersionShape | null {
  if (!profile || !profile.dispersionKnown) return null;
  if (!Number.isFinite(profile.p20) || !Number.isFinite(profile.p80) || profile.p80 < profile.p20) return null;
  const alongYards = roundTenth((profile.p80 - profile.p20) / 2);
  return {
    metric: profile.metric,
    centerYards: profile.stockYards,
    alongYards,
    sampleSize: profile.sampleSize,
    note: `${profile.metric} dispersion is ${alongYards} yards either side of the median, from ${profile.sampleSize} shots. Width is separate and is not invented.`,
  };
}

/** Half the P20–P80 of measured side yards. Null below five samples. */
export function lateralSpreadYards(sideYards: readonly number[]): number | null {
  const yards = sideYards.filter((value) => Number.isFinite(value) && Math.abs(value) <= 80);
  if (yards.length < 5) return null;
  return roundTenth(Math.max(0, (quantileType7(yards, 0.8) - quantileType7(yards, 0.2)) / 2));
}

export interface DebriefHole {
  hole: number;
  strokes: number;
  par: number;
  over: number;
}

/** The hole most over par. Ties take the earlier hole. A blank score is not zero. */
export function debriefTarget(holes: readonly { hole: number; strokes: number | null; par: number | null }[]): DebriefHole | null {
  const over = holes.flatMap((hole) => {
    if (hole.strokes == null || hole.par == null) return [];
    const diff = hole.strokes - hole.par;
    if (diff <= 0) return [];
    return [{ hole: hole.hole, strokes: hole.strokes, par: hole.par, over: diff }];
  });
  over.sort((a, b) => b.over - a.over || a.hole - b.hole);
  return over[0] ?? null;
}

export function debriefNote(choice: 'plan' | 'swing', target: DebriefHole): string {
  const reason = choice === 'plan' ? 'the plan' : 'the swing';
  return `Hole ${target.hole} was ${target.over} over par. You called it ${reason}. The score was not changed.`;
}

export function shotBearing(line: readonly LatLon[]): number | null {
  const start = line[0];
  const end = line[line.length - 1];
  if (!start || !end) return null;
  return bearingDegrees(start, end);
}
