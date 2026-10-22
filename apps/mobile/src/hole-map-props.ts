import type { LatLon } from '@coopr/domain';

export interface HoleMapProps {
  line: readonly LatLon[];
  fairways: readonly (readonly LatLon[])[];
  green: readonly (readonly LatLon[])[];
  bunkers: readonly (readonly LatLon[])[];
  hazards: readonly (readonly LatLon[])[];
  ellipse: readonly LatLon[] | null;
  dispersionLine: readonly LatLon[];
  measure: readonly LatLon[];
  onTap: (point: LatLon) => void;
}
