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
  elevationFeet: number | null;
  note: string;
}

export async function readWeather(input: { at: LatLon; holeLine: readonly LatLon[]; greenCenter: LatLon | null }): Promise<WeatherRead> {
  let current: OpenMeteoCurrent | null = null;
  let note = 'Open-Meteo. Keyless. Not a COOPR measurement.';
  try {
    const response = await fetch(openMeteoCurrentUrl(input.at.lat, input.at.lon));
    const payload: unknown = await response.json();
    const parsed = parseOpenMeteoCurrent(payload);
    if ('error' in parsed) note = parsed.error;
    else current = parsed;
  } catch {
    note = 'Weather could not be reached. Type the wind and temperature, or leave them blank.';
  }
  const bearing = shotBearing(input.holeLine);
  const head = current && bearing != null ? headwindMph({ windFromDeg: current.windFromDeg, windMph: current.windMph, shotBearingDeg: bearing }) : null;
  if (current && bearing == null) note += ' The hole line has no bearing, so the wind was not split into a headwind.';
  let elevationFeet: number | null = null;
  const start = input.holeLine[0];
  if (start && input.greenCenter) {
    try {
      const response = await fetch(openMeteoElevationUrl([start, input.greenCenter]));
      const payload: unknown = await response.json();
      const parsed = parseOpenMeteoElevation(payload);
      if (!('error' in parsed) && parsed.meters.length >= 2) {
        elevationFeet = elevationChangeFeet(parsed.meters[0]!, parsed.meters[1]!);
        note += ' Elevation is the open hole line, start to green center. Not a survey.';
      }
    } catch {
      note += ' Elevation was not read.';
    }
  }
  return { current, headwindMph: head, elevationFeet, note };
}
