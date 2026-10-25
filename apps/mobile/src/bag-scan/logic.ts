import { expectedFlexes, FLEX, type ClubVerdict, type FitClub, type FitProfile, type FlexLetter } from '@coopr/engine';
import { durablePhoto } from './photos';
import type { IronBuild, ScanClub, ScanDraft, StoredFit } from './types';
import { EMPTY_FIT } from './types';

export const IN_PLAY_CAP = 14;
export const SET_ASIDE = 'Your bag holds 14 clubs, this one is set aside';

/** The sentence shown at the moment a new club is benched because 14 are already in play. */
export function setAsideNotice(before: readonly ScanClub[], clubId: string): string | null {
  const previous = before.find((club) => club.id === clubId);
  if (previous?.inPlay === false) return null;
  const others = before.filter((club) => club.inPlay && club.id !== clubId).length;
  return others >= IN_PLAY_CAP ? SET_ASIDE : null;
}

/** The same sentence on the card or hold screen, before the club is saved. */
export function asideOnReview(clubs: readonly ScanClub[], existingId: string | null, sample = false): string | null {
  if (sample) return null;
  return setAsideNotice(clubs, existingId ?? 'pending');
}

export const CONFIRM_HOLD = 'Pick a type, and a loft or a club number, before this can continue.';
export const DETAILS_HOLD = 'Pick a type, and a loft or a club number, before this can save.';
export const SAMPLE_HOLD = 'This is Sample. Editing it does not copy it into your bag.';

export function confirmReason(ready: boolean): string | null {
  return ready ? null : CONFIRM_HOLD;
}

export function detailsReason(sample: boolean, ready: boolean): string | null {
  if (sample) return SAMPLE_HOLD;
  return ready ? null : DETAILS_HOLD;
}

const CLUB_TYPES = ['driver', 'fairway wood', 'hybrid', 'iron', 'wedge', 'putter', 'utility iron'] as const;
const BUILDS = ['game-improvement', 'players-distance', 'players-cb', 'blade', 'super-game-improvement'] as const;
const FLEXES = ['L', 'A', 'R', 'S', 'X'] as const;

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const HANDICAP_MIN = -10;
export const HANDICAP_MAX = 54;
export const SPEED_MIN = 40;
export const SPEED_MAX = 140;
export const LOFT_MIN = 5;
export const LOFT_MAX = 75;
export const PUTTER_LOFT_MIN = 0;
export const PUTTER_LOFT_MAX = 10;

export function loftRange(type: string | null | undefined): { min: number; max: number } {
  if (type === 'putter') return { min: PUTTER_LOFT_MIN, max: PUTTER_LOFT_MAX };
  return { min: LOFT_MIN, max: LOFT_MAX };
}

export function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function rangedNumber(text: string, min: number, max: number): { blank: boolean; value: number | null; problem: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { blank: true, value: null, problem: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { blank: false, value: null, problem: `Enter a number from ${min} to ${max}.` };
  }
  return { blank: false, value, problem: null };
}

export function loftProblem(text: string, type?: string | null): string | null {
  const range = loftRange(type);
  return rangedNumber(text, range.min, range.max).problem;
}

export function canConfirmDraft(draft: Pick<ScanDraft, 'type' | 'loftText' | 'clubNumber'>): boolean {
  if (draft.type == null || loftProblem(draft.loftText, draft.type)) return false;
  return parseOptionalNumber(draft.loftText) != null || Boolean(draft.clubNumber.trim());
}

export function slotFor(draft: Pick<ScanDraft, 'clubNumber' | 'loftText' | 'type'>): string {
  const number = draft.clubNumber.trim();
  if (number) return number.toUpperCase();
  const loft = parseOptionalNumber(draft.loftText);
  if (loft != null) return String(loft);
  return 'CLUB';
}

export function draftToClub(draft: ScanDraft, ack: 'kept_anyway' | null, now = new Date().toISOString()): ScanClub {
  const loft = parseOptionalNumber(draft.loftText);
  return {
    id: draft.existingId ?? `scan-${now}`,
    slot: slotFor(draft),
    inPlay: true,
    brand: emptyToNull(draft.brand),
    model: emptyToNull(draft.model),
    type: draft.type,
    loft,
    flex: draft.flex,
    ironBuild: draft.type === 'iron' ? draft.ironBuild : null,
    photoUri: durablePhoto(draft.facePhotoUri),
    fitAck: ack,
    fitAckOn: ack ? now : null,
    clubNumber: emptyToNull(draft.clubNumber),
    identifiedBy: 'typed',
  };
}

export function clubToDraft(club: ScanClub): ScanDraft {
  return {
    step: 'face',
    facePhotoUri: club.photoUri,
    captureUri: club.photoUri,
    faceCropped: Boolean(club.photoUri),
    brand: club.brand ?? '',
    model: club.model ?? '',
    type: club.type,
    ironBuild: club.ironBuild,
    loftText: club.loft == null ? '' : String(club.loft),
    clubNumber: club.clubNumber ?? '',
    flex: club.flex,
    existingId: club.id,
  };
}

export function placeClub(existing: readonly ScanClub[], club: ScanClub): ScanClub[] {
  const previous = existing.find((item) => item.id === club.id);
  const others = existing.filter((item) => item.id !== club.id);
  const inPlay = previous ? previous.inPlay : others.filter((item) => item.inPlay).length < IN_PLAY_CAP;
  return [...others, { ...club, inPlay, fitAck: club.fitAck ?? previous?.fitAck ?? null, fitAckOn: club.fitAck ? club.fitAckOn : previous?.fitAckOn ?? null }];
}

export function withoutClub(existing: readonly ScanClub[], id: string): ScanClub[] {
  return existing.filter((club) => club.id !== id);
}

export function withInPlay(existing: readonly ScanClub[], id: string, inPlay: boolean): { clubs: ScanClub[]; refused: string | null } {
  if (inPlay && existing.filter((club) => club.inPlay && club.id !== id).length >= IN_PLAY_CAP) {
    return { clubs: [...existing], refused: 'In-play bag is limited to 14 clubs. Move one out before adding another.' };
  }
  return { clubs: existing.map((club) => (club.id === id ? { ...club, inPlay } : club)), refused: null };
}

export function toFitClub(club: ScanClub): FitClub {
  return {
    id: club.id,
    slot: club.slot,
    in_play: club.inPlay,
    type: club.type ?? '',
    loft: club.loft,
    flex: club.flex,
    set: club.ironBuild ? club.id : null,
  };
}

export function pickedTypes(clubs: readonly ScanClub[]): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const club of clubs) {
    if (club.ironBuild) picked[club.id] = club.ironBuild;
  }
  return picked;
}

export function profileFromFit(fit: StoredFit): FitProfile {
  return {
    handicap_index: fit.handicapIndex,
    handicap_quality: fit.handicapIndex == null ? null : fit.handicapQuality,
    driver_speed_mph: fit.driverSpeedMph,
    speed_quality: fit.driverSpeedMph == null ? null : fit.speedQuality,
  };
}

export function sanitizeFit(value: unknown): StoredFit {
  if (!value || typeof value !== 'object') return { ...EMPTY_FIT };
  const raw = value as Record<string, unknown>;
  const handicap = typeof raw.handicapIndex === 'number' && raw.handicapIndex >= HANDICAP_MIN && raw.handicapIndex <= HANDICAP_MAX ? raw.handicapIndex : null;
  const speed = typeof raw.driverSpeedMph === 'number' && raw.driverSpeedMph >= SPEED_MIN && raw.driverSpeedMph <= SPEED_MAX ? raw.driverSpeedMph : null;
  const handicapQuality = raw.handicapQuality === 'measured' || raw.handicapQuality === 'user_confirmed' ? raw.handicapQuality : null;
  const speedQuality = raw.speedQuality === 'measured' || raw.speedQuality === 'user_confirmed' ? raw.speedQuality : null;
  return {
    handicapIndex: handicap,
    handicapQuality: handicap == null ? null : handicapQuality ?? 'user_confirmed',
    driverSpeedMph: speed,
    speedQuality: speed == null ? null : speedQuality ?? 'user_confirmed',
  };
}

function asType(value: unknown): ScanClub['type'] {
  return typeof value === 'string' && (CLUB_TYPES as readonly string[]).includes(value) ? (value as ScanClub['type']) : null;
}

function asBuild(value: unknown): IronBuild | null {
  return typeof value === 'string' && (BUILDS as readonly string[]).includes(value) ? (value as IronBuild) : null;
}

function asFlex(value: unknown): FlexLetter | null {
  return typeof value === 'string' && (FLEXES as readonly string[]).includes(value) ? (value as FlexLetter) : null;
}

export function sanitizeClub(value: unknown): ScanClub | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const type = asType(raw.type);
  const range = loftRange(type);
  const loft = typeof raw.loft === 'number' && raw.loft >= range.min && raw.loft <= range.max ? raw.loft : null;
  return {
    id: raw.id,
    slot: typeof raw.slot === 'string' && raw.slot.trim() ? raw.slot : 'CLUB',
    inPlay: raw.inPlay !== false,
    brand: typeof raw.brand === 'string' && raw.brand.trim() ? raw.brand.trim() : null,
    model: typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null,
    type,
    loft,
    flex: asFlex(raw.flex),
    ironBuild: asBuild(raw.ironBuild),
    photoUri: typeof raw.photoUri === 'string' && raw.photoUri ? raw.photoUri : null,
    fitAck: raw.fitAck === 'kept_anyway' ? 'kept_anyway' : null,
    fitAckOn: typeof raw.fitAckOn === 'string' ? raw.fitAckOn : null,
    clubNumber: typeof raw.clubNumber === 'string' && raw.clubNumber.trim() ? raw.clubNumber.trim() : null,
    identifiedBy: 'typed',
  };
}

export function sameFlexIrons(clubs: readonly ScanClub[], flex: FlexLetter | null): number {
  if (!flex) return 0;
  return clubs.filter((club) => club.inPlay && club.type === 'iron' && club.flex === flex).length;
}

export function shaftNudge(flex: string | null, speed: number | null): string | null {
  if (!flex || speed == null || !(FLEX as readonly string[]).includes(flex)) return null;
  const expected = expectedFlexes(speed);
  if (!expected.length) return null;
  const index = FLEX.indexOf(flex as FlexLetter);
  const distances = expected.map((item) => FLEX.indexOf(item) - index);
  const softer = distances.every((item) => item < 0);
  const firmer = distances.every((item) => item > 0);
  const which = softer ? 'a softer shaft in the same heads' : firmer ? 'a firmer flex in the same heads' : 'a different flex in the same heads';
  return `Log shots, or ask a fitter about ${which}. This build does not suggest a shaft to buy, and nothing here promises a shaft change fixes it.`;
}

export function holdBody(input: {
  type: string | null;
  flex: string | null;
  verdict: ClubVerdict;
  speed: number | null;
  speedQuality: string | null;
  ironMates: number;
}): string {
  const parts: string[] = [];
  if (input.type === 'iron') parts.push('Nice irons.');
  parts.push("The club isn't bad. It may just not be yours yet.");
  if (input.speed != null) {
    const label = input.speedQuality === 'sample' ? 'Sample driver speed' : 'Driver speed';
    parts.push(`${label} ${input.speed} mph.`);
  }
  const head = input.verdict.checks.find((check) => check.label.startsWith('Head'));
  if (head?.status === 'pass') parts.push('Head passes.');
  const firm = input.verdict.checks.find((check) => check.status === 'mismatch');
  if (firm) parts.push(firm.why);
  if (input.type === 'iron' && input.flex && firm?.label.startsWith('Shaft') && input.ironMates > 1) {
    parts.push(`Same ${input.flex} shaft in all ${input.ironMates} irons: one question, not ${input.ironMates}.`);
  }
  parts.push('Handicap and speed are not everything. Log shots and we re-check.');
  return parts.join(' ');
}
