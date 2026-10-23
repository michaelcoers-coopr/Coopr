import type { LatLon } from '@coopr/domain';
import type { MapPad } from '@coopr/engine';

export interface HoleMapProps {
  line: readonly LatLon[];
  fairways: readonly (readonly LatLon[])[];
  green: readonly (readonly LatLon[])[];
  bunkers: readonly (readonly LatLon[])[];
  hazards: readonly (readonly LatLon[])[];
  ellipse: readonly LatLon[] | null;
  /** Semantic fill for the dispersion oval. Omitted when there is no oval. */
  ellipseColor?: string | null;
  /** Measured standard deviations, in yards. The map may magnify a tiny oval and must say so. */
  ellipseNote?: string | null;
  /** Aim curve between two real points. A drawing, not a measured flight. */
  flight?: readonly LatLon[] | null;
  reduceMotion?: boolean;
  dispersionLine: readonly LatLon[];
  measure: readonly LatLon[];
  onTap: (point: LatLon) => void;
  rawLabel: string;
  playsLabel: string;
  height?: number;
  /** Edge-to-edge hole. Yardage sits in a glass pill over the map. */
  bleed?: boolean;
  /** Keeps the hole drawing clear of the glass pill and the bottom sheet. */
  pad?: number | MapPad;
  /** Front, center, and back of the green from the phone. Omitted when there is no position. */
  marks?: { front: LatLon; center: LatLon; back: LatLon } | null;
  /** Tee-to-green bearing. The shapes map stands the hole up so the green is at the top. */
  orient?: { bearing: number; origin: LatLon } | null;
  /** Measured yardages on the aim line. Omitted when there is nothing to label. */
  labels?: readonly { at: LatLon; label: string }[];
}
