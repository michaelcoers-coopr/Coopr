/** On-device read. This pass returns nothing. Manual entry is the path that works. */
export interface ClubVisionRead {
  brand: null;
  model: null;
  type: null;
  loft: null;
  flex: null;
  confidence: null;
  lines: readonly string[];
}

export interface ClubVision {
  read(photoUri: string | null): ClubVisionRead;
}

export const stubVision: ClubVision = {
  read(_photoUri: string | null): ClubVisionRead {
    return {
      brand: null,
      model: null,
      type: null,
      loft: null,
      flex: null,
      confidence: null,
      lines: [
        'Brand: not read',
        'Model: not read',
        'Loft: not read',
        'Flex: not read',
        'Type is your pick. It is never taken from the photo.',
      ],
    };
  },
};
