export type ClubType = 'driver' | 'fairway wood' | 'hybrid' | 'iron' | 'wedge' | 'putter' | 'utility iron';
export type IronBuild = 'game-improvement' | 'players-distance' | 'players-cb' | 'blade' | 'super-game-improvement';
export type FlexLetter = 'L' | 'A' | 'R' | 'S' | 'X';
export type CaptureStep = 'face' | 'sole' | 'shaft' | 'bag';

export interface ScanClub {
  id: string;
  slot: string;
  inPlay: boolean;
  brand: string | null;
  model: string | null;
  type: ClubType | null;
  loft: number | null;
  flex: FlexLetter | null;
  ironBuild: IronBuild | null;
  /** Face photo kept in the app sandbox. Never uploaded by this build. */
  photoUri: string | null;
  fitAck: 'kept_anyway' | null;
  fitAckOn: string | null;
  clubNumber: string | null;
  identifiedBy: 'typed';
}

export interface ScanDraft {
  step: CaptureStep;
  facePhotoUri: string | null;
  /** Latest capture, including sole or shaft. Only a face shot is kept as the club picture. */
  captureUri: string | null;
  brand: string;
  model: string;
  type: ClubType | null;
  ironBuild: IronBuild | null;
  loftText: string;
  clubNumber: string;
  flex: FlexLetter | null;
  existingId: string | null;
}

export interface StoredFit {
  handicapIndex: number | null;
  handicapQuality: 'user_confirmed' | 'measured' | null;
  driverSpeedMph: number | null;
  speedQuality: 'user_confirmed' | 'measured' | null;
}

export const EMPTY_FIT: StoredFit = {
  handicapIndex: null,
  handicapQuality: null,
  driverSpeedMph: null,
  speedQuality: null,
};

export function blankDraft(): ScanDraft {
  return {
    step: 'face',
    facePhotoUri: null,
    captureUri: null,
    brand: '',
    model: '',
    type: null,
    ironBuild: null,
    loftText: '',
    clubNumber: '',
    flex: null,
    existingId: null,
  };
}

export type Focus = { kind: 'draft' } | { kind: 'saved'; id: string } | { kind: 'sample'; id: string };
