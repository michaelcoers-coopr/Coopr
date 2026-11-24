import { leaderboard } from './scoring';
import {
  AUBURN_ADDRESS,
  AUBURN_KEY,
  AUBURN_NAME,
  AUBURN_PARS,
  DEMO_CODE,
  DEMO_ORGANIZER_TOKEN,
  DEMO_SEED_VERSION,
  PANTHERS_ACCENT,
  type Group,
  type Logo,
  type PublicEvent,
  type StoredEvent,
} from './types';

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Clearly fake marks. These are not real company logos. */
export function sampleLogo(name: string, fill: string, ink: string): string {
  const safe = name.replace(/[<>&]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect width="240" height="80" rx="12" fill="${fill}"/><text x="120" y="46" text-anchor="middle" font-family="sans-serif" font-size="16" fill="${ink}">${safe}</text></svg>`;
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}

function logo(id: string, name: string, fill: string, ink: string, slot: Logo['slot'], hole: number | null): Logo {
  return { id, name, dataUrl: sampleLogo(name, fill, ink), slot, hole };
}

function team(n: number, waitlist: boolean): Group {
  const sample = n === 1 || n === 2;
  const name = sample ? (n === 1 ? 'Sample Team A' : 'Sample Team B') : waitlist ? `Waitlist ${n - 34}` : `Team ${String(n).padStart(2, '0')}`;
  const mark = n === 1 ? 'A' : n === 2 ? 'B' : `T${n}`;
  return {
    id: `demo-team-${n}`,
    name,
    nameClaimed: sample,
    waitlist,
    startingHole: null,
    players: [1, 2, 3, 4].map((seat) => ({
      id: `demo-team-${n}-p${seat}`,
      name: sample ? `Sample Golfer ${mark}${seat}` : 'Open',
      role: seat === 1 ? 'scorer' : 'viewer',
      token: null,
      claimed: false,
    })),
  };
}

/** Seeded Panthers Classic. Placeholder logos only. A newer seed replaces an older SAMPLE that has not been edited into a real round. */
export function buildDemoEvent(): StoredEvent {
  const writtenAt = '2026-11-24T15:00:00.000Z';
  const groups = Array.from({ length: 34 }, (_, index) => team(index + 1, false));
  groups.push(team(35, true), team(36, true));
  const score = (id: string, groupId: string, playerId: string, hole: number, strokes: number) => ({
    id, groupId, playerId, hole, strokes, clientSeq: hole, idempotencyKey: id, source: 'guest' as const, writtenAt,
  });
  return {
    id: 'demo-event',
    code: DEMO_CODE,
    name: 'Panthers Golf Classic',
    charityName: 'Bonney Lake Jr. Panthers',
    charityDetail: 'Youth football and cheer. A 501(c)(3).',
    charityUrl: null,
    courseKey: AUBURN_KEY,
    courseName: AUBURN_NAME,
    courseAddress: AUBURN_ADDRESS,
    pars: [...AUBURN_PARS],
    date: '2027-05-23',
    startTime: '07:30',
    format: 'scramble',
    startStyle: 'modified-shotgun',
    teamSize: 4,
    includesCart: true,
    mulliganPriceLabel: '',
    mulliganScope: 'team',
    mulliganMax: 4,
    tiebreak: 'back-nine',
    accent: PANTHERS_ACCENT,
    contests: { closestToPin: [], longestDrive: [] },
    friends: ['Sample Friend A', 'Sample Friend B'],
    groups,
    watchers: [],
    logos: [
      logo('demo-logo-title', 'Sample Title Sponsor', '#0B1F3A', '#FFFFFF', 'title', null),
      logo('demo-logo-team-hole', 'Sample Team Hole', '#1EC8C8', '#0B1F3A', 'team-hole', 1),
      logo('demo-logo-hole', 'Sample Hole Sponsor', '#C8102E', '#FFFFFF', 'hole', 1),
      // LEGAL REVIEW: a real Panthers player photo needs a parent or guardian's consent. This mark is a placeholder, not a child.
      logo('demo-logo-kid', 'Sample Player Photo', '#0B1F3A', '#1EC8C8', 'kid-photo', 1),
      logo('demo-logo-cup', 'Sample Panther Cup', '#0B1F3A', '#FFFFFF', 'winning-prize', null),
      logo('demo-logo-mulligan', 'Sample Mulligan Sponsor', '#1EC8C8', '#0B1F3A', 'mulligan', null),
      // Name only. The drawing is a placeholder, not the business's logo.
      logo('demo-logo-prize', 'Sample Prize Partner', '#0B1F3A', '#FFFFFF', 'prize-partner', null),
      logo('demo-logo-share', 'Sample Share Card', '#8AC926', '#0B1F3A', 'recap', null),
    ],
    scores: [
      score('demo-a1', 'demo-team-1', 'demo-team-1-p1', 1, 4),
      score('demo-a2', 'demo-team-1', 'demo-team-1-p1', 2, 4),
      score('demo-a3', 'demo-team-1', 'demo-team-1-p1', 3, 5),
      score('demo-a4', 'demo-team-1', 'demo-team-1-p1', 4, 3),
      score('demo-b1', 'demo-team-2', 'demo-team-2-p1', 1, 3),
      score('demo-b2', 'demo-team-2', 'demo-team-2-p1', 2, 4),
      score('demo-b3', 'demo-team-2', 'demo-team-2-p1', 3, 4),
      score('demo-b4', 'demo-team-2', 'demo-team-2-p1', 4, 3),
    ],
    mulligans: [],
    surveys: [],
    seenKeys: ['demo-a1', 'demo-a2', 'demo-a3', 'demo-a4', 'demo-b1', 'demo-b2', 'demo-b3', 'demo-b4'],
    locks: [],
    seedVersion: DEMO_SEED_VERSION,
    organizerToken: DEMO_ORGANIZER_TOKEN,
    createdAt: writtenAt,
    updatedAt: writtenAt,
  };
}

export function demoPublic(): PublicEvent {
  const event = buildDemoEvent();
  return {
    code: event.code,
    name: event.name,
    charityName: event.charityName,
    charityDetail: event.charityDetail,
    charityUrl: event.charityUrl,
    courseName: event.courseName,
    courseAddress: event.courseAddress,
    pars: [...event.pars],
    date: event.date,
    startTime: event.startTime,
    format: event.format,
    startStyle: event.startStyle,
    teamSize: event.teamSize,
    includesCart: event.includesCart,
    mulliganPriceLabel: event.mulliganPriceLabel,
    mulliganScope: event.mulliganScope,
    mulliganMax: event.mulliganMax,
    tiebreak: event.tiebreak,
    accent: event.accent,
    contests: event.contests,
    friends: [...event.friends],
    groups: event.groups.map((group) => ({
      id: group.id,
      name: group.name,
      nameClaimed: group.nameClaimed,
      waitlist: group.waitlist,
      startingHole: group.startingHole,
      players: group.players.map((player) => ({ id: player.id, name: player.name, role: player.role, claimed: player.claimed })),
    })),
    logos: event.logos,
    rows: leaderboard(event),
    mulligans: [],
    updatedAt: event.updatedAt,
  };
}
