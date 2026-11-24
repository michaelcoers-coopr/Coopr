/** Live charity event. Golfers do not get an account. */

export const HOLE_COUNT = 18;
export const LOGO_MAX_BYTES = 512 * 1024;
export const POLL_MS = 5000;

/**
 * High Cedars pars from the OpenGolfAPI card in
 * packages/course/src/fixtures/high-cedars/opengolfapi-course.json.
 */
export const HIGH_CEDARS_PARS: readonly number[] = [5, 3, 4, 4, 5, 4, 4, 3, 4, 5, 3, 4, 3, 4, 4, 4, 4, 5];
export const HIGH_CEDARS_NAME = 'High Cedars';
export const HIGH_CEDARS_KEY = 'high-cedars-orting';

export const DEMO_CODE = 'SAMPLE';
/** Fake token for the seeded sample event only. It is not a production secret. */
export const DEMO_ORGANIZER_TOKEN = 'sample-organizer-token';

export type EventFormat = 'scramble' | 'stroke';
export type StartStyle = 'shotgun' | 'tee-times';
export type GuestRole = 'scorer' | 'viewer';
export type LogoSlot = 'library' | 'title' | 'leaderboard' | 'recap' | 'hole';
export type ScoreSource = 'guest' | 'organizer';

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

export interface StoredEvent {
  id: string;
  code: string;
  name: string;
  charityName: string;
  /**
   * LEGAL REVIEW: outbound link only. COOPR does not collect donations,
   * run a checkout, or hold money. Leave this unused in a real event until
   * counsel signs off.
   */
  charityUrl: string | null;
  courseKey: string;
  courseName: string;
  pars: number[];
  date: string;
  format: EventFormat;
  startStyle: StartStyle;
  groups: Group[];
  watchers: Watcher[];
  logos: Logo[];
  scores: HoleScore[];
  seenKeys: string[];
  locks: HoleLock[];
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
}

export interface PublicEvent {
  code: string;
  name: string;
  charityName: string;
  charityUrl: string | null;
  courseName: string;
  date: string;
  format: EventFormat;
  startStyle: StartStyle;
  groups: PublicGroup[];
  logos: Logo[];
  rows: BoardRow[];
  updatedAt: string;
}

export interface OrganizerView extends PublicEvent {
  scores: { groupId: string; playerId: string; hole: number; strokes: number }[];
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
