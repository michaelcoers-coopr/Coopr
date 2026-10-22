import {
  elevationChangeFeet,
  headwindMph,
  openMeteoCurrentUrl,
  openMeteoElevationUrl,
  parseOpenMeteoCurrent,
  parseOpenMeteoElevation,
  shotBearing,
  type OpenMeteoCurrent,
} from '@coopr/engine';
import type { LatLon } from '@coopr/domain';

export interface WeatherRead {
  current: OpenMeteoCurrent | null;
  headwindMph: number | null;
  /** Target height minus player height. Null when either height is missing. */
  elevationFeet: number | null;
}

/**
 * Wind, temperature, and pressure come from Open-Meteo. Elevation is the same
 * service's terrain heights from the player to the green. A missing elevation
 * stays null. Pressure is kept and is not turned into yards.
 */
export async function readWeather(input: {
  at: LatLon;
  holeLine: readonly LatLon[];
  player: LatLon | null;
  greenCenter: LatLon | null;
}): Promise<WeatherRead> {
  let current: OpenMeteoCurrent | null = null;
  try {
    const response = await fetch(openMeteoCurrentUrl(input.at.lat, input.at.lon));
    const payload: unknown = await response.json();
    const parsed = parseOpenMeteoCurrent(payload);
    if (!('error' in parsed)) current = parsed;
  } catch {
    current = null;
  }
  const bearing = shotBearing(input.holeLine);
  const head = current && bearing != null ? headwindMph({ windFromDeg: current.windFromDeg, windMph: current.windMph, shotBearingDeg: bearing }) : null;
  let elevationFeet: number | null = null;
  if (input.player && input.greenCenter) {
    try {
      const response = await fetch(openMeteoElevationUrl([input.player, input.greenCenter]));
      const payload: unknown = await response.json();
      const parsed = parseOpenMeteoElevation(payload);
      if (!('error' in parsed) && parsed.meters.length >= 2) {
        elevationFeet = elevationChangeFeet(parsed.meters[0]!, parsed.meters[1]!);
      }
    } catch {
      elevationFeet = null;
    }
  }
  return { current, headwindMph: head, elevationFeet };
}
