import type { ImageSourcePropType } from 'react-native';
import { aerialGeoref, type AerialGeoref } from './project';

/**
 * JPEG requires live here so unit tests can import the projection without loading images.
 * Only High Cedars holes 1 and 2 have a plate. Every other hole stays on the vector map.
 */
const ART = {
  1: {
    image: require('../../assets/aerials/hole1_aerial_2x.jpg') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole1_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  2: {
    image: require('../../assets/aerials/hole2_aerial_2x.jpg') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole2_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
} as const;

/** Course key and the OpenGolfAPI id for Cedars At High Cedars. */
const HIGH_CEDARS_IDS = new Set(['high-cedars-orting', '2d198fce-e499-4e5e-9372-5329346fa54d']);

export interface AerialPlate {
  courseId: string;
  hole: number;
  georef: AerialGeoref;
  image: ImageSourcePropType;
  placeholder: ImageSourcePropType;
}

export function aerialPlate(courseId: string, holeNumber: number): AerialPlate | null {
  if (!HIGH_CEDARS_IDS.has(courseId)) return null;
  const georef = aerialGeoref(holeNumber);
  const art = holeNumber === 1 ? ART[1] : holeNumber === 2 ? ART[2] : null;
  if (!georef || !art) return null;
  return { courseId, hole: holeNumber, georef, image: art.image, placeholder: art.placeholder };
}
