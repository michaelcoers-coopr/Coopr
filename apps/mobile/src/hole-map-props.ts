import type { LatLon } from '@coopr/domain';
import type { MapPad } from '@coopr/engine';
import type { AerialPlate } from './aerial/registry';
import type { MapTileSource } from './tile-source';

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
  /**
   * Play-only grade. Home leaves this off so the shared map stays as it is.
   * Deeper greens, tree shadow, teal water, and brighter sand.
   */
  aerial?: boolean;
  /** Swappable imagery. A null provider keeps the vector drawing. */
  imagery?: MapTileSource | null;
  /**
   * Stylized aerial for this hole. Null keeps the vector map.
   * The picture and the overlay share one scale and origin from the plate's affine.
   */
  plate?: AerialPlate | null;
  /**
   * Map credit. Off while the sheet is open so the line cannot cover a pill.
   * More and the course screen keep the full sentence.
   */
  showCredit?: boolean;
  /**
   * Distance from the bottom of the map to the credit line.
   * Play sets this above the Score and Mark buttons and left of Ask.
   */
  creditBottom?: number;
  /** Left inset of the attribution pill. The play rail needs it clear of the right edge. */
  creditLeft?: number;
  /** Right inset of the attribution pill. */
  creditRight?: number;
  /**
   * Short note drawn with the aerial credit. Play sets this only while the plate is showing.
   * Holes 3 and 7 say the green is partly hidden by trees. Null draws nothing.
   */
  aerialNote?: string | null;
  /** Draws the dispersion oval this many times larger. 1 keeps the measured shape. */
  ellipseScale?: number;
}
