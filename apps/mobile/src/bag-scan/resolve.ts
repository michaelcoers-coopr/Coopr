import { bagGaps, verdict, type BagGaps, type ClubVerdict, type FitClub, type FitProfile } from '@coopr/engine';
import { draftToClub, pickedTypes, profileFromFit, toFitClub } from './logic';
import { SAMPLE_BAG, SAMPLE_PROFILES } from './sample-data';
import type { Focus, ScanClub, ScanDraft, StoredFit } from './types';

export interface ShownClub {
  id: string;
  slot: string;
  inPlay: boolean;
  brand: string | null;
  model: string | null;
  type: string | null;
  loft: number | null;
  flex: string | null;
  ironBuild: string | null;
  photoUri: string | null;
  clubNumber: string | null;
  sample: boolean;
  fitAck: 'kept_anyway' | null;
  note: string | null;
}

export interface ShownFit {
  club: ShownClub;
  verdict: ClubVerdict;
  gaps: BagGaps;
  profile: FitProfile;
  bag: FitClub[];
  picked: Record<string, string>;
}

function sampleProfile(key: 'A' | 'B'): FitProfile | null {
  const profile = SAMPLE_PROFILES?.[key];
  if (!profile) return null;
  return {
    handicap_index: profile.handicap_index,
    handicap_quality: profile.handicap_quality,
    driver_speed_mph: profile.driver_speed_mph,
    speed_quality: profile.speed_quality,
  };
}

function sampleBag(): { clubs: FitClub[]; picked: Record<string, string>; shown: ShownClub[] } | null {
  if (!SAMPLE_BAG) return null;
  const picked = SAMPLE_BAG.types_user_picked;
  const clubs: FitClub[] = SAMPLE_BAG.clubs.map((club) => ({
    id: club.id,
    slot: club.slot,
    in_play: club.in_play,
    type: club.type,
    loft: club.loft,
    flex: club.flex,
    set: club.set ?? null,
  }));
  const shown: ShownClub[] = SAMPLE_BAG.clubs.map((club) => ({
    id: club.id,
    slot: club.slot,
    inPlay: club.in_play,
    brand: club.brand,
    model: club.model,
    type: club.type,
    loft: club.loft,
    flex: club.flex,
    ironBuild: club.set ? (picked[club.set] ?? null) : null,
    photoUri: null,
    clubNumber: null,
    sample: true,
    fitAck: null,
    note: club.note ?? null,
  }));
  return { clubs, picked, shown };
}

export function shownSample(profileKey: 'A' | 'B'): { clubs: ShownClub[]; gaps: BagGaps; profile: FitProfile; bag: FitClub[]; picked: Record<string, string> } | null {
  const bag = sampleBag();
  const profile = sampleProfile(profileKey);
  if (!bag || !profile) return null;
  return { clubs: bag.shown, gaps: bagGaps(bag.clubs), profile, bag: bag.clubs, picked: bag.picked };
}

export function fitForShown(shown: ShownClub, bag: FitClub[], profile: FitProfile, picked: Record<string, string>): ClubVerdict {
  const club = bag.find((item) => item.id === shown.id);
  if (!club) {
    return verdict(
      { id: shown.id, slot: shown.slot, in_play: shown.inPlay, type: shown.type ?? '', loft: shown.loft, flex: shown.flex, set: null },
      profile,
      bag,
      picked,
    );
  }
  return verdict(club, profile, bag, picked);
}

export function shownFromDraft(draft: ScanDraft, clubs: readonly ScanClub[], fit: StoredFit): ShownFit {
  const preview = draftToClub({ ...draft, existingId: draft.existingId ?? 'preview' }, null, 'preview');
  const previous = clubs.find((item) => item.id === preview.id);
  const placed = clubs.some((club) => club.id === preview.id)
    ? clubs.map((club) => (club.id === preview.id ? { ...preview, inPlay: club.inPlay } : club))
    : [...clubs.filter((club) => club.id !== preview.id), preview];
  const room = placed.filter((club) => club.id !== preview.id && club.inPlay).length;
  const bagClubs = placed.map((club) => (club.id === preview.id && !draft.existingId ? { ...club, inPlay: room < 14 } : club));
  const bag = bagClubs.map(toFitClub);
  const picked = pickedTypes(bagClubs);
  const profile = profileFromFit(fit);
  const stored = bagClubs.find((item) => item.id === preview.id) ?? preview;
  const club = toFitClub(stored);
  const shown: ShownClub = {
    id: preview.id,
    slot: preview.slot,
    inPlay: club.in_play,
    brand: preview.brand,
    model: preview.model,
    type: preview.type,
    loft: preview.loft,
    flex: preview.flex,
    ironBuild: preview.ironBuild,
    photoUri: preview.photoUri,
    clubNumber: preview.clubNumber,
    sample: false,
    fitAck: previous?.fitAck ?? null,
    note: null,
  };
  return { club: shown, verdict: verdict(club, profile, bag, picked), gaps: bagGaps(bag), profile, bag, picked };
}

export function shownSaved(clubs: readonly ScanClub[], id: string, fit: StoredFit): ShownFit | null {
  const club = clubs.find((item) => item.id === id);
  if (!club) return null;
  const bag = clubs.map(toFitClub);
  const picked = pickedTypes(clubs);
  const profile = profileFromFit(fit);
  const shown: ShownClub = {
    id: club.id,
    slot: club.slot,
    inPlay: club.inPlay,
    brand: club.brand,
    model: club.model,
    type: club.type,
    loft: club.loft,
    flex: club.flex,
    ironBuild: club.ironBuild,
    photoUri: club.photoUri,
    clubNumber: club.clubNumber,
    sample: false,
    fitAck: club.fitAck,
    note: null,
  };
  return { club: shown, verdict: verdict(toFitClub(club), profile, bag, picked), gaps: bagGaps(bag), profile, bag, picked };
}

export function shownForFocus(input: {
  focus: Focus;
  draft: ScanDraft;
  clubs: readonly ScanClub[];
  fit: StoredFit;
  sampleProfile: 'A' | 'B';
}): ShownFit | null {
  const focus = input.focus;
  if (focus.kind === 'sample') {
    const sample = shownSample(input.sampleProfile);
    const club = sample?.clubs.find((item) => item.id === focus.id);
    if (!sample || !club) return null;
    return {
      club,
      verdict: fitForShown(club, sample.bag, sample.profile, sample.picked),
      gaps: sample.gaps,
      profile: sample.profile,
      bag: sample.bag,
      picked: sample.picked,
    };
  }
  if (focus.kind === 'saved') return shownSaved(input.clubs, focus.id, input.fit);
  return shownFromDraft(input.draft, input.clubs, input.fit);
}
