/** The scan screen draws this same box. Continue crops the face shot to it. */
export const CROP_BOX = { width: 0.72, height: 0.7 } as const;

export function cropRect(width: number, height: number): { originX: number; originY: number; width: number; height: number } {
  const cropWidth = Math.max(1, Math.min(width, Math.round(width * CROP_BOX.width)));
  const cropHeight = Math.max(1, Math.min(height, Math.round(height * CROP_BOX.height)));
  const originX = Math.max(0, Math.round((width - cropWidth) / 2));
  const originY = Math.max(0, Math.round((height - cropHeight) / 2));
  return {
    originX,
    originY,
    width: Math.min(cropWidth, width - originX),
    height: Math.min(cropHeight, height - originY),
  };
}

export async function cropClubhead(uri: string): Promise<string | null> {
  try {
    const { Image } = await import('react-native');
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
    if (!size.width || !size.height) return null;
    const manipulator = await import('expo-image-manipulator');
    const result = await manipulator.manipulateAsync(uri, [{ crop: cropRect(size.width, size.height) }], {
      compress: 0.85,
      format: manipulator.SaveFormat.JPEG,
    });
    return result.uri || null;
  } catch {
    return null;
  }
}
