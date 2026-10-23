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
  rawLabel: string;
  playsLabel: string;
  height?: number;
  /** Edge-to-edge hole. The yardage lives in the sheet, not on the map. */
  bleed?: boolean;
  /** Front, center, and back of the green from the phone. Omitted when there is no position. */
  marks?: { front: LatLon; center: LatLon; back: LatLon } | null;
}
