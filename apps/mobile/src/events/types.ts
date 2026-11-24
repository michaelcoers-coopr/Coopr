/** Live charity event. Golfers do not get an account. */

export const HOLE_COUNT = 18;
export const LOGO_MAX_BYTES = 512 * 1024;
export const LOGO_MAX_COUNT = 80;
export const GROUP_MAX = 40;
export const POLL_MS = 5000;
export const DEMO_SEED_VERSION = 3;

/**
 * High Cedars pars from the OpenGolfAPI card in
 * packages/course/src/fixtures/high-cedars/opengolfapi-course.json.
 * The hole screen still walks this course. An event can carry a different card.
 */
export const HIGH_CEDARS_PARS: readonly number[] = [5, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 3, 4, 4, 4, 4, 5];
export const HIGH_CEDARS_NAME = 'High Cedars';
export const HIGH_CEDARS_KEY = 'high-cedars-orting';

/**
 * Auburn Golf Course published layout, par 71.
 * Hole pars match the course page at auburngolf.org and the GolfPass card
 * for 29630 Green River Rd SE. This is the scorecard, not a map.
 */
export const AUBURN_PARS: readonly number[] = [4, 4, 4, 3, 4, 4, 4, 3, 5, 5, 4, 5, 4, 3, 4, 3, 4, 4];
export const AUBURN_NAME = 'Auburn Golf Course';
export const AUBURN_ADDRESS = '29630 Green River Rd SE, Auburn, WA 98092';
export const AUBURN_KEY = 'auburn-golf-course';
/** Panthers teal. Web leaderboard and TV only. The app stays navy, white, red, and lime. */
export const PANTHERS_ACCENT = '#1EC8C8';

export const DEMO_CODE = 'SAMPLE';
/** Fake token for the seeded sample event only. It is not a production secret. */
export const DEMO_ORGANIZER_TOKEN = 'sample-organizer-token';

export type EventFormat = 'scramble' | 'stroke';
export type StartStyle = 'shotgun' | 'modified-shotgun' | 'tee-times';
/** No handicaps and no flights on this event. */
export type Tiebreak = 'back-nine' | 'share';
export type MulliganScope = 'player' | 'team';
export type GuestRole = 'scorer' | 'viewer';
export type LogoSlot =
  | 'library'
  | 'title'
  | 'team-hole'
  | 'hole'
  | 'kid-photo'
  | 'winning-prize'
  | 'mulligan'
  | 'prize-partner'
  | 'leaderboard'
  | 'recap';
export type ScoreSource = 'guest' | 'organizer';
export type SurveyEase = 'easy' | 'ok' | 'hard';
export type SurveyUse = 'yes' | 'maybe' | 'no';

export interface Player {
  id: string;
  name: string;
  role: GuestRole;
  token: string | null;
  claimed: boolean;
}

export interface Group {
  id: string;
  name: string;
  /** False until the team sets its own name. */
  nameClaimed: boolean;
  waitlist: boolean;
  /** Modified shotgun. Null until the organizer assigns it. The same hole may be shared. */
  startingHole: number | null;
  players: Player[];
}

export interface Watcher {
  id: string;
  groupId: string;
  name: string;
  token: string;
}

export interface Logo {
  id: string;
  name: string;
  dataUrl: string;
  slot: LogoSlot;
  hole: number | null;
}

export interface HoleScore {
  id: string;
  groupId: string;
  playerId: string;
  hole: number;
  strokes: number | null;
  clientSeq: number;
  idempotencyKey: string;
  source: ScoreSource;
  writtenAt: string;
}

export interface HoleLock {
  groupId: string;
  playerId: string | null;
  hole: number;
}

export interface MulliganUse {
  id: string;
  groupId: string;
  playerId: string;
  hole: number;
  idempotencyKey: string;
}

/**
 * LEGAL REVIEW: stored only after the golfer opts in.
 * Email is kept only when emailConsent is true. No other personal data.
 */
export interface SurveyResponse {
  id: string;
  groupId: string;
  playerId: string;
  name: string;
  ease: SurveyEase;
  wouldUse: SurveyUse;
  next: string;
  email: string | null;
  emailConsent: boolean;
  createdAt: string;
}

/** Closest to the pin and longest drive only. There is no hole-in-one contest. Both lists stay empty until the organizer picks the holes. */
export interface Contests {
  closestToPin: number[];
  longestDrive: number[];
}

export interface StoredEvent {
  id: string;
  code: string;
  name: string;
  charityName: string;
  charityDetail: string;
  /**
   * LEGAL REVIEW: outbound link only. COOPR does not collect donations,
   * run a checkout, or hold money. Leave this unused in a real event until
   * counsel signs off.
   */
  charityUrl: string | null;
  courseKey: string;
  courseName: string;
  courseAddress: string;
  pars: number[];
  date: string;
  /** Local start, 24-hour HH:MM. Empty when the organizer did not set one. */
  startTime: string;
  format: EventFormat;
  startStyle: StartStyle;
  teamSize: number;
  includesCart: boolean;
  /** Display only. The app does not collect this money. Empty when there is no price to show. */
  mulliganPriceLabel: string;
  /**
   * TODO(Mike): The flyer says max 2. The organizer record says max 4 per foursome.
   * The seed uses 4 per team until that is confirmed.
   * Mulligans are prepaid off the app with a coin or ticket. This number is only a count.
   */
  mulliganScope: MulliganScope;
  mulliganMax: number;
  /** No handicaps. Back nine is the default card match. */
  tiebreak: Tiebreak;
  /** Web leaderboard and TV. Null keeps the COOPR board colors. */
  accent: string | null;
  contests: Contests;
  /** Friend of the Panthers. Names only, no logos. */
  friends: string[];
  groups: Group[];
  watchers: Watcher[];
  logos: Logo[];
  scores: HoleScore[];
  mulligans: MulliganUse[];
  surveys: SurveyResponse[];
  seenKeys: string[];
  locks: HoleLock[];
  seedVersion: number;
  organizerToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  role: GuestRole;
  claimed: boolean;
}

export interface PublicGroup {
  id: string;
  name: string;
  nameClaimed: boolean;
  waitlist: boolean;
  startingHole: number | null;
  players: PublicPlayer[];
}

export interface BoardRow {
  key: string;
  groupId: string;
  playerId: string | null;
  name: string;
  thru: number;
  gross: number;
  toPar: number | null;
  rank: number | null;
  waitlist: boolean;
  startingHole: number | null;
  mulligansUsed: number;
  mulliganCap: number;
}

export interface PublicMulligan {
  groupId: string;
  playerId: string;
  count: number;
}

export interface PublicEvent {
  code: string;
  name: string;
  charityName: string;
  charityDetail: string;
  charityUrl: string | null;
  courseName: string;
  courseAddress: string;
  pars: number[];
  date: string;
  startTime: string;
  format: EventFormat;
  startStyle: StartStyle;
  teamSize: number;
  includesCart: boolean;
  mulliganPriceLabel: string;
  mulliganScope: MulliganScope;
  mulliganMax: number;
  tiebreak: Tiebreak;
  accent: string | null;
  contests: Contests;
  friends: string[];
  groups: PublicGroup[];
  logos: Logo[];
  rows: BoardRow[];
  mulligans: PublicMulligan[];
  updatedAt: string;
}

export interface OrganizerView extends PublicEvent {
  scores: { groupId: string; playerId: string; hole: number; strokes: number }[];
  surveys: SurveyResponse[];
}

export interface CreatePlayerInput {
  name: string;
  role: GuestRole;
}

export interface CreateGroupInput {
  name: string;
  players: CreatePlayerInput[];
}

export interface CreateEventInput {
  name: string;
  charityName: string;
  charityUrl?: string | null;
  date: string;
  format: EventFormat;
  startStyle: StartStyle;
  groups: CreateGroupInput[];
}

export interface LiveSession {
  code: string;
  eventName: string;
  format: EventFormat;
  groupId: string;
  playerId: string;
  name: string;
  role: GuestRole;
  token: string;
}

export const HOLE_SLOTS: readonly LogoSlot[] = ['hole', 'kid-photo', 'team-hole'];

export function isLogoSlot(value: unknown): value is LogoSlot {
  return value === 'library'
    || value === 'title'
    || value === 'team-hole'
    || value === 'hole'
    || value === 'kid-photo'
    || value === 'winning-prize'
    || value === 'mulligan'
    || value === 'prize-partner'
    || value === 'leaderboard'
    || value === 'recap';
}
