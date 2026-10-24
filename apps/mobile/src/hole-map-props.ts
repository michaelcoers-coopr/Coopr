import type { LatLon } from '@coopr/domain';
import type { MapPad } from '@coopr/engine';

export interface HoleMapProps {
  line: readonly LatLon[];
  fairways: readonly (readonly LatLon[])[];
  green: readonly (readonly LatLon[])[];
  bunkers: readonly (readonly LatLon[])[];
  hazards: readonly (readonly LatLon[])[];
  ellipse: readonly LatLon[] | null;
  /** Short mark drawn on a sample oval, so it is not read as a measured pattern. */
  ellipseCaption?: string | null;
  /** Semantic fill for the dispersion oval. Omitted when there is no oval. */
  ellipseColor?: string | null;
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
  /** Real ground yardages for those three points. A tap shows one briefly. */
  markReadout?: { front: string; center: string; back: string } | null;
  /** Accessible names for the dots, such as "Front, 144 yards". Not drawn as text. */
  markAccess?: { front: string; center: string; back: string } | null;
  /** Tee-to-green bearing. The shapes map stands the hole up so the green is at the top. */
  orient?: { bearing: number; origin: LatLon } | null;
  /** Measured yardages on the aim line. Omitted when there is nothing to label. */
  labels?: readonly { at: LatLon; label: string }[];
  /**
   * What the open band between the yardage panel and the sheet should hold.
   * Tee frames the tee shot. Green frames the ball to the pin. Hole frames tee to green.
   */
  camera?: {
    kind: 'tee' | 'green' | 'hole';
    reachYards: number | null;
    from: LatLon | null;
  } | null;
}
