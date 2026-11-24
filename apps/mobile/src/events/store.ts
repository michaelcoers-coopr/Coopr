import { secretOk } from '../api-guard';
import { buildDemoEvent } from './demo';
import { inspectLogo } from './logos';
import { decideMulligan, mulliganCap } from './mulligans';
import { holeStrokes, leaderboard } from './scoring';
import { reviewSurvey } from './survey';
import {
  DEMO_CODE,
  DEMO_SEED_VERSION,
  GROUP_MAX,
  HIGH_CEDARS_KEY,
  HIGH_CEDARS_NAME,
  HIGH_CEDARS_PARS,
  HOLE_COUNT,
  HOLE_SLOTS,
  LOGO_MAX_COUNT,
  isLogoSlot,
  type CreateEventInput,
  type EventFormat,
  type GuestRole,
  type HoleScore,
  type OrganizerView,
  type PublicEvent,
  type PublicMulligan,
  type ScoreSource,
  type StartStyle,
  type StoredEvent,
} from './types';

export interface StoreOptions {
  now?: () => string;
  rng?: () => number;
  onChange?: (events: StoredEvent[]) => void;
}

export type StoreFailure = { ok: false; status: 400 | 401 | 403 | 404 | 409; error: string };

export type ApplyResult =
  | { ok: true; duplicate: boolean; stale: boolean; score: HoleScore | null }
  | StoreFailure;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultRng(): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] ?? 0) / 256;
}

function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  return trimmed;
}

/**
 * LEGAL REVIEW: a plain http(s) link. COOPR does not collect the gift.
 */
export function cleanCharityUrl(value: unknown): string | null | 'bad' {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return 'bad';
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed) || trimmed.length > 300) return 'bad';
  return trimmed;
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function isFormat(value: unknown): value is EventFormat {
  return value === 'scramble' || value === 'stroke';
}

function isStart(value: unknown): value is StartStyle {
  return value === 'shotgun' || value === 'tee-times';
}

function isRole(value: unknown): value is GuestRole {
  return value === 'scorer' || value === 'viewer';
}

export function createEventStore(options: StoreOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString());
  const rng = options.rng ?? defaultRng;
  const events = new Map<string, StoredEvent>();

  const persist = () => {
    options.onChange?.(clone([...events.values()]));
  };

  const put = (event: StoredEvent) => {
    event.updatedAt = now();
    events.set(event.code, event);
    persist();
  };

  const id = () => {
    let value = '';
    for (let index = 0; index < 16; index += 1) value += Math.floor(rng() * 16).toString(16);
    return value;
  };

  const token = () => {
    let value = '';
    for (let index = 0; index < 32; index += 1) value += Math.floor(rng() * 16).toString(16);
    return value;
  };

  const code = () => {
    let value = '';
    for (let index = 0; index < 6; index += 1) {
      const pick = ALPHABET[Math.floor(rng() * ALPHABET.length)] ?? 'A';
      value += pick;
    }
    return value;
  };

  const freshCode = () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const next = code();
      if (next !== DEMO_CODE && !events.has(next)) return next;
    }
    return `E${id().slice(0, 5).toUpperCase()}`;
  };

  const toPublic = (event: StoredEvent): PublicEvent => ({
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
    mulliganMaxPerPlayer: event.mulliganMaxPerPlayer,
    accent: event.accent,
    contests: { closestToPin: [...event.contests.closestToPin], longestDrive: [...event.contests.longestDrive] },
    friends: [...event.friends],
    groups: event.groups.map((group) => ({
      id: group.id,
      name: group.name,
      nameClaimed: group.nameClaimed,
      waitlist: group.waitlist,
      players: group.players.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        claimed: player.claimed,
      })),
    })),
    logos: event.logos.map((logo) => ({ ...logo })),
    rows: leaderboard(event).map((row) => {
      const group = event.groups.find((item) => item.id === row.groupId);
      const used = event.mulligans.filter((item) => item.groupId === row.groupId).length;
      return { ...row, mulligansUsed: used, mulliganCap: mulliganCap(group?.players.length ?? 0, event.mulliganMaxPerPlayer) };
    }),
    mulligans: mulliganTotals(event),
    updatedAt: event.updatedAt,
  });

  const organizerOk = (event: StoredEvent, header: string | null) => secretOk(header, event.organizerToken);

  const findGuest = (event: StoredEvent, header: string | null) => {
    if (!header) return null;
    for (const group of event.groups) {
      for (const player of group.players) {
        if (player.token && secretOk(header, player.token)) return { group, player, watcher: false };
      }
    }
    for (const watcher of event.watchers) {
      if (secretOk(header, watcher.token)) {
        const group = event.groups.find((item) => item.id === watcher.groupId) ?? null;
        if (!group) return null;
        return { group, player: null, watcher: true };
      }
    }
    return null;
  };

  return {
    load(saved: StoredEvent[]) {
      events.clear();
      for (const event of saved) events.set(event.code, hydrate(clone(event)));
    },
    snapshot(): StoredEvent[] {
      return clone([...events.values()]);
    },
    ensureDemo(): PublicEvent {
      const existing = events.get(DEMO_CODE);
      if (existing && existing.seedVersion >= DEMO_SEED_VERSION) return toPublic(existing);
      const demo = buildDemoEvent();
      events.set(demo.code, demo);
      persist();
      return toPublic(demo);
    },
    create(input: CreateEventInput): { ok: true; organizerToken: string; event: PublicEvent } | StoreFailure {
      const name = cleanName(input.name, 80);
      const charityName = cleanName(input.charityName, 80);
      const date = cleanDate(input.date);
      const charityUrl = cleanCharityUrl(input.charityUrl ?? null);
      if (!name || !charityName || !date || charityUrl === 'bad' || !isFormat(input.format) || !isStart(input.startStyle)) {
        return { ok: false, status: 400, error: 'Add a name, a charity, and a date.' };
      }
      if (!Array.isArray(input.groups) || input.groups.length < 1 || input.groups.length > GROUP_MAX) {
        return { ok: false, status: 400, error: 'Add at least one group.' };
      }
      const groups = [];
      for (const group of input.groups) {
        const groupName = cleanName(group.name, 60);
        if (!groupName) return { ok: false, status: 400, error: 'Name each group.' };
        if (!Array.isArray(group.players) || group.players.length < 1 || group.players.length > 6) {
          return { ok: false, status: 400, error: 'Each group needs a scorer.' };
        }
        const players = [];
        for (const player of group.players) {
          const playerName = cleanName(player.name, 60);
          if (!playerName || !isRole(player.role)) return { ok: false, status: 400, error: 'Name each player.' };
          players.push({ id: id(), name: playerName, role: player.role, token: null, claimed: false });
        }
        if (players.filter((player) => player.role === 'scorer').length !== 1) {
          return { ok: false, status: 400, error: 'Each group needs one scorer.' };
        }
        groups.push({ id: id(), name: groupName, nameClaimed: true, waitlist: false, players });
      }
      const stamp = now();
      const event: StoredEvent = {
        id: id(),
        code: freshCode(),
        name,
        charityName,
        charityUrl,
        courseKey: HIGH_CEDARS_KEY,
        courseName: HIGH_CEDARS_NAME,
        pars: [...HIGH_CEDARS_PARS],
        courseAddress: '',
        charityDetail: '',
        date,
        startTime: '',
        format: input.format,
        startStyle: input.startStyle,
        teamSize: input.format === 'scramble' ? 4 : 1,
        includesCart: false,
        mulliganPriceLabel: '',
        mulliganMaxPerPlayer: 0,
        accent: null,
        contests: { closestToPin: [], longestDrive: [] },
        friends: [],
        groups,
        watchers: [],
        logos: [],
        scores: [],
        mulligans: [],
        surveys: [],
        seenKeys: [],
        locks: [],
        seedVersion: 0,
        organizerToken: token(),
        createdAt: stamp,
        updatedAt: stamp,
      };
      events.set(event.code, event);
      persist();
      return { ok: true, organizerToken: event.organizerToken, event: toPublic(event) };
    },
    publicView(code: string): PublicEvent | null {
      const event = events.get(code.trim().toUpperCase());
      return event ? toPublic(event) : null;
    },
    organizerView(code: string, header: string | null): OrganizerView | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      const scores = [];
      if (event.format === 'scramble') {
        for (const group of event.groups) {
          for (let hole = 1; hole <= HOLE_COUNT; hole += 1) {
            const strokes = holeStrokes(event, group.id, null, hole);
            const writer = group.players.find((player) => player.role === 'scorer')?.id ?? group.players[0]?.id;
            if (strokes == null || !writer) continue;
            scores.push({ groupId: group.id, playerId: writer, hole, strokes });
          }
        }
      } else {
        for (const group of event.groups) {
          for (const player of group.players) {
            for (let hole = 1; hole <= HOLE_COUNT; hole += 1) {
              const strokes = holeStrokes(event, group.id, player.id, hole);
              if (strokes == null) continue;
              scores.push({ groupId: group.id, playerId: player.id, hole, strokes });
            }
          }
        }
      }
      return { ...toPublic(event), scores, surveys: event.surveys.map((item) => ({ ...item })) };
    },
    update(code: string, header: string | null, patch: { name?: unknown; charityName?: unknown; charityUrl?: unknown; date?: unknown; closestToPin?: unknown; longestDrive?: unknown; friends?: unknown; accent?: unknown }): { ok: true; event: PublicEvent } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      if (patch.name !== undefined) {
        const name = cleanName(patch.name, 80);
        if (!name) return { ok: false, status: 400, error: 'Add a name.' };
        event.name = name;
      }
      if (patch.charityName !== undefined) {
        const charityName = cleanName(patch.charityName, 80);
        if (!charityName) return { ok: false, status: 400, error: 'Add the charity.' };
        event.charityName = charityName;
      }
      if (patch.charityUrl !== undefined) {
        const charityUrl = cleanCharityUrl(patch.charityUrl);
        if (charityUrl === 'bad') return { ok: false, status: 400, error: 'The charity link must start with http:// or https://.' };
        event.charityUrl = charityUrl;
      }
      if (patch.date !== undefined) {
        const date = cleanDate(patch.date);
        if (!date) return { ok: false, status: 400, error: 'Use a date like 2026-06-14.' };
        event.date = date;
      }
      if (patch.closestToPin !== undefined || patch.longestDrive !== undefined) {
        const closest = patch.closestToPin === undefined ? event.contests.closestToPin : holeList(patch.closestToPin);
        const drive = patch.longestDrive === undefined ? event.contests.longestDrive : holeList(patch.longestDrive);
        if (!closest || !drive) return { ok: false, status: 400, error: 'Contest holes are 1 to 18, with no repeats.' };
        event.contests = { closestToPin: closest, longestDrive: drive };
      }
      if (patch.friends !== undefined) {
        const friends = nameList(patch.friends);
        if (!friends) return { ok: false, status: 400, error: 'Friend of the Panthers is a list of names.' };
        event.friends = friends;
      }
      if (patch.accent !== undefined) {
        const accent = cleanAccent(patch.accent);
        if (accent === 'bad') return { ok: false, status: 400, error: 'Use a color like #1EC8C8.' };
        event.accent = accent;
      }
      put(event);
      return { ok: true, event: toPublic(event) };
    },
    addLogo(code: string, header: string | null, name: unknown, dataUrl: unknown): { ok: true; event: PublicEvent } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      const label = cleanName(name, 60);
      if (!label) return { ok: false, status: 400, error: 'Name the sponsor.' };
      if (typeof dataUrl !== 'string') return { ok: false, status: 400, error: 'Choose a logo file.' };
      const checked = inspectLogo(dataUrl);
      if (!checked.ok) return { ok: false, status: 400, error: checked.error };
      if (event.logos.length >= LOGO_MAX_COUNT) return { ok: false, status: 400, error: 'This event already has its logos.' };
      event.logos.push({ id: id(), name: label, dataUrl, slot: 'library', hole: null });
      put(event);
      return { ok: true, event: toPublic(event) };
    },
    assignLogo(code: string, header: string | null, logoId: unknown, slot: unknown, hole: unknown): { ok: true; event: PublicEvent } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      const logo = event.logos.find((item) => item.id === logoId);
      if (!logo || typeof logoId !== 'string') return { ok: false, status: 404, error: 'That logo is gone.' };
      if (!isLogoSlot(slot)) return { ok: false, status: 400, error: 'Pick a place for the logo.' };
      const needsHole = HOLE_SLOTS.includes(slot);
      const nextHole = needsHole ? Number(hole) : null;
      if (needsHole && (!Number.isInteger(nextHole) || nextHole == null || nextHole < 1 || nextHole > HOLE_COUNT)) {
        return { ok: false, status: 400, error: 'Pick a hole from 1 to 18.' };
      }
      for (const other of event.logos) {
        if (other.id === logo.id) continue;
        const samePlace = needsHole ? other.slot === slot && other.hole === nextHole : other.slot === slot && slot !== 'library';
        if (samePlace) {
          other.slot = 'library';
          other.hole = null;
        }
      }
      logo.slot = slot;
      logo.hole = needsHole ? nextHole : null;
      put(event);
      return { ok: true, event: toPublic(event) };
    },
    removeLogo(code: string, header: string | null, logoId: unknown): { ok: true; event: PublicEvent } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      const before = event.logos.length;
      event.logos = event.logos.filter((logo) => logo.id !== logoId);
      if (event.logos.length === before) return { ok: false, status: 404, error: 'That logo is gone.' };
      put(event);
      return { ok: true, event: toPublic(event) };
    },
    join(code: string, body: { groupId?: unknown; playerId?: unknown; name?: unknown; playerName?: unknown; teamName?: unknown }):
      | { ok: true; token: string; role: GuestRole; groupId: string; playerId: string; name: string; eventName: string; format: EventFormat }
      | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      const group = event.groups.find((item) => item.id === body.groupId);
      if (!group || typeof body.groupId !== 'string') return { ok: false, status: 400, error: 'Pick a group.' };
      if (typeof body.playerId === 'string' && body.playerId) {
        const player = group.players.find((item) => item.id === body.playerId);
        if (!player) return { ok: false, status: 404, error: 'That player is not on this group.' };
        if (!player.claimed || !player.token) {
          const playerName = cleanName(body.playerName, 60);
          if (playerName) player.name = playerName;
          if (player.role === 'scorer') claimName(group, body.teamName);
          player.token = token();
          player.claimed = true;
          put(event);
          return { ok: true, token: player.token, role: player.role, groupId: group.id, playerId: player.id, name: player.name, eventName: event.name, format: event.format };
        }
        const watchToken = token();
        const watcherId = id();
        event.watchers.push({ id: watcherId, groupId: group.id, name: player.name, token: watchToken });
        put(event);
        return { ok: true, token: watchToken, role: 'viewer', groupId: group.id, playerId: watcherId, name: player.name, eventName: event.name, format: event.format };
      }
      const name = cleanName(body.name, 60);
      if (!name) return { ok: false, status: 400, error: 'Add your name.' };
      const watchToken = token();
      const watcherId = id();
      event.watchers.push({ id: watcherId, groupId: group.id, name, token: watchToken });
      put(event);
      return { ok: true, token: watchToken, role: 'viewer', groupId: group.id, playerId: watcherId, name, eventName: event.name, format: event.format };
    },
    lockHole(code: string, header: string | null, body: { groupId?: unknown; playerId?: unknown; hole?: unknown; locked?: unknown }): { ok: true } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      if (!organizerOk(event, header)) return { ok: false, status: 401, error: 'This phone cannot edit the event.' };
      const hole = Number(body.hole);
      if (!Number.isInteger(hole) || hole < 1 || hole > HOLE_COUNT) return { ok: false, status: 400, error: 'Pick a hole from 1 to 18.' };
      const group = event.groups.find((item) => item.id === body.groupId);
      if (!group) return { ok: false, status: 400, error: 'Pick a group.' };
      const playerId = event.format === 'stroke' ? (typeof body.playerId === 'string' ? body.playerId : null) : null;
      if (event.format === 'stroke' && !group.players.some((player) => player.id === playerId)) {
        return { ok: false, status: 400, error: 'Pick a player.' };
      }
      event.locks = event.locks.filter((lock) => !(lock.groupId === group.id && lock.hole === hole && lock.playerId === playerId));
      if (body.locked !== false) event.locks.push({ groupId: group.id, playerId, hole });
      put(event);
      return { ok: true };
    },
    applyScore(code: string, actor: { organizer: string | null; guest: string | null }, body: {
      groupId?: unknown;
      playerId?: unknown;
      hole?: unknown;
      strokes?: unknown;
      clientSeq?: unknown;
      idempotencyKey?: unknown;
    }): ApplyResult {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      const hole = Number(body.hole);
      const clientSeq = Number(body.clientSeq);
      const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
      if (!Number.isInteger(hole) || hole < 1 || hole > HOLE_COUNT) return { ok: false, status: 400, error: 'Pick a hole from 1 to 18.' };
      if (!Number.isInteger(clientSeq) || clientSeq < 1) return { ok: false, status: 400, error: 'The score needs a sequence.' };
      if (key.length < 8 || key.length > 80) return { ok: false, status: 400, error: 'The score needs an idempotency key.' };
      const strokes = body.strokes == null ? null : Number(body.strokes);
      if (strokes != null && (!Number.isInteger(strokes) || strokes < 1 || strokes > 25)) {
        return { ok: false, status: 400, error: 'Enter a score from 1 to 25.' };
      }
      if (event.seenKeys.includes(key)) {
        const groupId = typeof body.groupId === 'string' ? body.groupId : '';
        const playerId = typeof body.playerId === 'string' ? body.playerId : null;
        return { ok: true, duplicate: true, stale: false, score: currentScore(event, groupId, playerId, hole) };
      }
      const group = event.groups.find((item) => item.id === body.groupId);
      if (!group || typeof body.groupId !== 'string') return { ok: false, status: 400, error: 'Pick a group.' };
      const player = group.players.find((item) => item.id === body.playerId);
      if (!player || typeof body.playerId !== 'string') return { ok: false, status: 400, error: 'Pick a player.' };
      let source: ScoreSource = 'guest';
      if (organizerOk(event, actor.organizer)) {
        source = 'organizer';
      } else {
        const guest = findGuest(event, actor.guest);
        if (!guest) return { ok: false, status: 401, error: 'Join the event before posting a score.' };
        if (guest.watcher || !guest.player || guest.player.role !== 'scorer' || guest.group.id !== group.id) {
          return { ok: false, status: 403, error: 'Only the scorer for this group can post.' };
        }
      }
      const cardPlayer = event.format === 'scramble' ? null : player.id;
      const locked = event.locks.some((lock) => lock.groupId === group.id && lock.hole === hole && lock.playerId === cardPlayer);
      if (locked && source !== 'organizer') return { ok: false, status: 409, error: 'Held. The organizer locked this hole.' };
      const existing = event.scores.filter((score) => sameCard(event, score, group.id, player.id, hole));
      const winner = existing.length === 0 ? null : existing.reduce((best, item) => (item.clientSeq >= best.clientSeq ? item : best));
      const older = winner != null && winner.clientSeq > clientSeq;
      const sameMoment = winner != null && winner.clientSeq === clientSeq && source !== 'organizer';
      if (winner && (older || sameMoment)) {
        event.seenKeys.push(key);
        put(event);
        return { ok: true, duplicate: false, stale: true, score: winner };
      }
      const score: HoleScore = {
        id: id(),
        groupId: group.id,
        playerId: player.id,
        hole,
        strokes,
        clientSeq,
        idempotencyKey: key,
        source,
        writtenAt: now(),
      };
      event.scores = event.scores.filter((item) => !sameCard(event, item, group.id, player.id, hole));
      event.scores.push(score);
      event.seenKeys.push(key);
      put(event);
      return { ok: true, duplicate: false, stale: false, score };
    },
    claimTeam(code: string, guest: string | null, teamName: unknown): { ok: true; event: PublicEvent } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      const actor = findGuest(event, guest);
      if (!actor || actor.watcher || !actor.player) return { ok: false, status: 401, error: 'Join the team before naming it.' };
      if (actor.player.role !== 'scorer') return { ok: false, status: 403, error: 'The scorer names the team.' };
      const name = cleanName(teamName, 60);
      if (!name) return { ok: false, status: 400, error: 'Add a team name.' };
      if (actor.group.nameClaimed && actor.group.name !== name) return { ok: false, status: 409, error: 'This team already has a name.' };
      actor.group.name = name;
      actor.group.nameClaimed = true;
      put(event);
      return { ok: true, event: toPublic(event) };
    },
    useMulligan(code: string, guest: string | null, body: { hole?: unknown; idempotencyKey?: unknown; playerId?: unknown }): { ok: true; duplicate: boolean; used: number; cap: number } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      const actor = findGuest(event, guest);
      if (!actor || actor.watcher || !actor.player) return { ok: false, status: 401, error: 'Join the team before counting a mulligan.' };
      if (actor.player.role !== 'scorer') return { ok: false, status: 403, error: 'The scorer counts mulligans.' };
      const requested = typeof body.playerId === 'string'
        ? actor.group.players.find((player) => player.id === body.playerId) ?? null
        : actor.group.players.find((player) => event.mulligans.filter((item) => item.playerId === player.id).length < event.mulliganMaxPerPlayer) ?? null;
      if (typeof body.playerId === 'string' && !requested) return { ok: false, status: 400, error: 'That player is not on this team.' };
      if (!requested) return { ok: false, status: 409, error: 'This team has used its mulligans.' };
      const hole = Number(body.hole);
      const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
      if (!Number.isInteger(hole) || hole < 1 || hole > HOLE_COUNT) return { ok: false, status: 400, error: 'Pick a hole from 1 to 18.' };
      if (key.length < 8 || key.length > 80) return { ok: false, status: 400, error: 'The mulligan needs an idempotency key.' };
      const decision = decideMulligan({
        uses: event.mulligans,
        groupId: actor.group.id,
        playerId: requested.id,
        playerCount: actor.group.players.length,
        maxPerPlayer: event.mulliganMaxPerPlayer,
        idempotencyKey: key,
      });
      if (!decision.ok) return { ok: false, status: 409, error: decision.error };
      if (!decision.duplicate) {
        event.mulligans.push({ id: id(), groupId: actor.group.id, playerId: requested.id, hole, idempotencyKey: key });
        put(event);
      }
      const used = event.mulligans.filter((item) => item.groupId === actor.group.id).length;
      return { ok: true, duplicate: decision.duplicate, used, cap: mulliganCap(actor.group.players.length, event.mulliganMaxPerPlayer) };
    },
    saveSurvey(code: string, guest: string | null, body: Record<string, unknown>): { ok: true } | StoreFailure {
      const event = events.get(code.trim().toUpperCase());
      if (!event) return { ok: false, status: 404, error: 'No event with that code.' };
      const actor = findGuest(event, guest);
      if (!actor || actor.watcher || !actor.player) return { ok: false, status: 401, error: 'Join the event before answering.' };
      if (event.surveys.some((item) => item.playerId === actor.player?.id)) return { ok: false, status: 409, error: 'This phone already sent the three questions.' };
      const reviewed = reviewSurvey({ ...body, name: actor.player.name });
      if (!reviewed.ok) return { ok: false, status: 400, error: reviewed.error };
      event.surveys.push({
        id: id(),
        groupId: actor.group.id,
        playerId: actor.player.id,
        name: reviewed.name,
        ease: reviewed.ease,
        wouldUse: reviewed.wouldUse,
        next: reviewed.next,
        email: reviewed.email,
        emailConsent: reviewed.emailConsent,
        createdAt: now(),
      });
      put(event);
      return { ok: true };
    },
  };
}

function sameCard(event: StoredEvent, score: HoleScore, groupId: string, playerId: string, hole: number): boolean {
  if (score.groupId !== groupId || score.hole !== hole) return false;
  if (event.format === 'scramble') return true;
  return score.playerId === playerId;
}

function currentScore(event: StoredEvent, groupId: string, playerId: string | null, hole: number): HoleScore | null {
  const matches = event.scores.filter((score) => sameCard(event, score, groupId, playerId ?? '', hole) || (event.format === 'scramble' && score.groupId === groupId && score.hole === hole));
  if (event.format === 'stroke' && playerId) {
    return matches.find((score) => score.playerId === playerId && score.hole === hole) ?? null;
  }
  return matches[matches.length - 1] ?? null;
}

function claimName(group: { name: string; nameClaimed: boolean }, teamName: unknown) {
  if (group.nameClaimed) return;
  const name = cleanName(teamName, 60);
  if (!name) return;
  group.name = name;
  group.nameClaimed = true;
}

function holeList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const holes: number[] = [];
  for (const item of value) {
    const hole = Number(item);
    if (!Number.isInteger(hole) || hole < 1 || hole > HOLE_COUNT || holes.includes(hole)) return null;
    holes.push(hole);
  }
  return holes;
}

function nameList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 80) return null;
  const names: string[] = [];
  for (const item of value) {
    const name = cleanName(item, 60);
    if (!name) return null;
    names.push(name);
  }
  return names;
}

function cleanAccent(value: unknown): string | null | 'bad' {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value)) return 'bad';
  return value.toUpperCase();
}

function mulliganTotals(event: StoredEvent): PublicMulligan[] {
  const totals = new Map<string, PublicMulligan>();
  for (const use of event.mulligans) {
    const key = `${use.groupId}:${use.playerId}`;
    const current = totals.get(key) ?? { groupId: use.groupId, playerId: use.playerId, count: 0 };
    current.count += 1;
    totals.set(key, current);
  }
  return [...totals.values()];
}

function hydrate(event: StoredEvent): StoredEvent {
  return {
    ...event,
    courseAddress: event.courseAddress ?? '',
    charityDetail: event.charityDetail ?? '',
    startTime: event.startTime ?? '',
    teamSize: event.teamSize ?? 1,
    includesCart: event.includesCart ?? false,
    mulliganPriceLabel: event.mulliganPriceLabel ?? '',
    mulliganMaxPerPlayer: event.mulliganMaxPerPlayer ?? 0,
    accent: event.accent ?? null,
    contests: event.contests ?? { closestToPin: [], longestDrive: [] },
    friends: event.friends ?? [],
    mulligans: event.mulligans ?? [],
    surveys: event.surveys ?? [],
    seedVersion: event.seedVersion ?? 0,
    groups: event.groups.map((group) => ({
      ...group,
      nameClaimed: group.nameClaimed ?? true,
      waitlist: group.waitlist ?? false,
    })),
  };
}

export type EventStore = ReturnType<typeof createEventStore>;
