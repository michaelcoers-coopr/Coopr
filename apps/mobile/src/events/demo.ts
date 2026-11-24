import { leaderboard } from './scoring';
import {
  DEMO_CODE,
  DEMO_ORGANIZER_TOKEN,
  HIGH_CEDARS_KEY,
  HIGH_CEDARS_NAME,
  HIGH_CEDARS_PARS,
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

/** Clearly fake marks. These are not real companies. */
export function sampleLogo(name: string, fill: string, ink: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect width="240" height="80" rx="12" fill="${fill}"/><text x="120" y="46" text-anchor="middle" font-family="sans-serif" font-size="18" fill="${ink}">${name}</text></svg>`;
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}

function logo(id: string, name: string, fill: string, ink: string, slot: Logo['slot'], hole: number | null): Logo {
  return { id, name, dataUrl: sampleLogo(name, fill, ink), slot, hole };
}

/** Seeded sample. Idempotent callers must not reset it once the file already has SAMPLE. */
export function buildDemoEvent(): StoredEvent {
  const writtenAt = '2026-06-14T15:00:00.000Z';
  return {
    id: 'demo-event',
    code: DEMO_CODE,
    name: 'Sample Charity Open',
    charityName: 'Sample Charity',
    charityUrl: null,
    courseKey: HIGH_CEDARS_KEY,
    courseName: HIGH_CEDARS_NAME,
    pars: [...HIGH_CEDARS_PARS],
    date: '2026-06-14',
    format: 'scramble',
    startStyle: 'shotgun',
    groups: [
      {
        id: 'demo-cedar',
        name: 'Sample Team Cedar',
        players: [
          { id: 'demo-casey', name: 'Casey Cedar', role: 'scorer', token: null, claimed: false },
          { id: 'demo-quinn', name: 'Quinn Cedar', role: 'viewer', token: null, claimed: false },
        ],
      },
      {
        id: 'demo-lime',
        name: 'Sample Team Lime',
        players: [
          { id: 'demo-logan', name: 'Logan Lime', role: 'scorer', token: null, claimed: false },
          { id: 'demo-riley', name: 'Riley Lime', role: 'viewer', token: null, claimed: false },
        ],
      },
      {
        id: 'demo-tee',
        name: 'Sample Team Tee',
        players: [{ id: 'demo-taylor', name: 'Taylor Tee', role: 'scorer', token: null, claimed: false }],
      },
    ],
    watchers: [],
    logos: [
      logo('demo-logo-a', 'Sample Sponsor A', '#0B1F3A', '#FFFFFF', 'title', null),
      logo('demo-logo-b', 'Sample Sponsor B', '#C8102E', '#FFFFFF', 'leaderboard', null),
      logo('demo-logo-c', 'Sample Sponsor C', '#8AC926', '#0B1F3A', 'recap', null),
      logo('demo-logo-d', 'Sample Sponsor D', '#0B1F3A', '#8AC926', 'hole', 1),
    ],
    scores: [
      { id: 'demo-s1', groupId: 'demo-cedar', playerId: 'demo-casey', hole: 1, strokes: 5, clientSeq: 1, idempotencyKey: 'demo-cedar-1', source: 'guest', writtenAt },
      { id: 'demo-s2', groupId: 'demo-cedar', playerId: 'demo-casey', hole: 2, strokes: 3, clientSeq: 2, idempotencyKey: 'demo-cedar-2', source: 'guest', writtenAt },
      { id: 'demo-s3', groupId: 'demo-cedar', playerId: 'demo-casey', hole: 3, strokes: 5, clientSeq: 3, idempotencyKey: 'demo-cedar-3', source: 'guest', writtenAt },
      { id: 'demo-s4', groupId: 'demo-cedar', playerId: 'demo-casey', hole: 4, strokes: 4, clientSeq: 4, idempotencyKey: 'demo-cedar-4', source: 'guest', writtenAt },
      { id: 'demo-s5', groupId: 'demo-lime', playerId: 'demo-logan', hole: 1, strokes: 4, clientSeq: 1, idempotencyKey: 'demo-lime-1', source: 'guest', writtenAt },
      { id: 'demo-s6', groupId: 'demo-lime', playerId: 'demo-logan', hole: 2, strokes: 3, clientSeq: 2, idempotencyKey: 'demo-lime-2', source: 'guest', writtenAt },
      { id: 'demo-s7', groupId: 'demo-lime', playerId: 'demo-logan', hole: 3, strokes: 4, clientSeq: 3, idempotencyKey: 'demo-lime-3', source: 'guest', writtenAt },
      { id: 'demo-s8', groupId: 'demo-lime', playerId: 'demo-logan', hole: 4, strokes: 4, clientSeq: 4, idempotencyKey: 'demo-lime-4', source: 'guest', writtenAt },
    ],
    seenKeys: ['demo-cedar-1', 'demo-cedar-2', 'demo-cedar-3', 'demo-cedar-4', 'demo-lime-1', 'demo-lime-2', 'demo-lime-3', 'demo-lime-4'],
    locks: [],
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
    charityUrl: event.charityUrl,
    courseName: event.courseName,
    date: event.date,
    format: event.format,
    startStyle: event.startStyle,
    groups: event.groups.map((group) => ({
      id: group.id,
      name: group.name,
      players: group.players.map((player) => ({ id: player.id, name: player.name, role: player.role, claimed: player.claimed })),
    })),
    logos: event.logos,
    rows: leaderboard(event),
    updatedAt: event.updatedAt,
  };
}
