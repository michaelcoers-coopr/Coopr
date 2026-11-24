import type { ImageSourcePropType } from 'react-native';
import { aerialGeoref, type AerialGeoref } from './project';

/**
 * Image requires live here so unit tests can import the projection without loading images.
 * High Cedars holes 1–18. A missing file stays on the vector map.
 * The sharp plate is WebP. The JPEG is the low-resolution first paint.
 */
const ART: Partial<Record<number, { image: ImageSourcePropType; placeholder: ImageSourcePropType }>> = {
  1: {
    image: require('../../assets/aerials/hole1_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole1_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  2: {
    image: require('../../assets/aerials/hole2_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole2_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  3: {
    image: require('../../assets/aerials/hole3_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole3_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  4: {
    image: require('../../assets/aerials/hole4_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole4_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  5: {
    image: require('../../assets/aerials/hole5_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole5_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  6: {
    image: require('../../assets/aerials/hole6_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole6_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  7: {
    image: require('../../assets/aerials/hole7_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole7_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  8: {
    image: require('../../assets/aerials/hole8_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole8_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  9: {
    image: require('../../assets/aerials/hole9_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole9_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  10: {
    image: require('../../assets/aerials/hole10_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole10_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  11: {
    image: require('../../assets/aerials/hole11_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole11_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  12: {
    image: require('../../assets/aerials/hole12_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole12_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  13: {
    image: require('../../assets/aerials/hole13_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole13_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  14: {
    image: require('../../assets/aerials/hole14_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole14_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  15: {
    image: require('../../assets/aerials/hole15_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole15_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  16: {
    image: require('../../assets/aerials/hole16_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole16_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  17: {
    image: require('../../assets/aerials/hole17_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole17_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
  18: {
    image: require('../../assets/aerials/hole18_aerial_2x.webp') as ImageSourcePropType,
    placeholder: require('../../assets/aerials/hole18_aerial_1x_placeholder.jpg') as ImageSourcePropType,
  },
};

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
  const art = ART[holeNumber] ?? null;
  if (!georef || !art) return null;
  return { courseId, hole: holeNumber, georef, image: art.image, placeholder: art.placeholder };
}
