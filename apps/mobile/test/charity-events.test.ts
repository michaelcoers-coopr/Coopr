import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseParsForRound, eventPar, foreignPars, parForHole, rememberEventCard } from '../src/events/card';
import { thruHud } from '../src/design/round-chrome';
import { HOSTED_EVENT_ORIGIN, eventOrigin, joinLink, queueEventScore, OUTBOX_KEY, saveSession, type StorageLike } from '../src/events/client';
import { recapSummary } from '../src/design/recap-math';
import { AUBURN_PARS, DEMO_ORGANIZER_TOKEN, HIGH_CEDARS_PARS, type CreateEventInput, type LiveSession } from '../src/events/types';
import { mulliganLimit } from '../src/events/mulligans';
import { reviewSurvey, SURVEY_CONSENT } from '../src/events/survey';
import { finishBlocked, nextShotgunHole, shotgunOrder, viewerScoreMessage } from '../src/events/shotgun';
import { commitOnAdapter, createMemoryEventAdapter, seedSampleEvent } from '../src/events/adapter';
import { openFileEventStore } from '../src/events/file-store';
import { databaseUrl } from '../src/events/live';
import { schemaFileMatches } from '../src/events/postgres';
import { inspectLogo } from '../src/events/logos';
import { enqueueScore, flushOutbox, type OutboxEntry } from '../src/events/outbox';
import { formatToPar, leaderboard } from '../src/events/scoring';
import { serveEvent } from '../src/events/serve';
import { createEventStore, type EventStore } from '../src/events/store';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function memory(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function store(): EventStore {
  let n = 11;
  return createEventStore({
    now: () => '2026-06-14T15:00:00.000Z',
    rng: () => {
      n = (n * 48271) % 2147483647;
      return n / 2147483647;
    },
  });
}

function scrambleInput(extra?: Partial<CreateEventInput>): CreateEventInput {
  return {
    name: 'River Day',
    charityName: 'River Fund',
    date: '2026-06-14',
    format: 'scramble',
    startStyle: 'shotgun',
    groups: [
      { name: 'Cedar', players: [{ name: 'Casey', role: 'scorer' }, { name: 'Quinn', role: 'viewer' }] },
      { name: 'Lime', players: [{ name: 'Logan', role: 'scorer' }] },
      { name: 'Tee', players: [{ name: 'Taylor', role: 'scorer' }] },
    ],
    ...extra,
  };
}

function created(events = store()) {
  const result = events.create(scrambleInput());
  if (!result.ok) throw new Error(result.error);
  return { events, ...result };
}

async function read(response: Response) {
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

describe('charity leaderboard', () => {
  it('ranks a scramble by to-par and parks an unstarted team', () => {
    const { events, event } = created();
    const groups = event.groups;
    const cedar = groups[0];
    const lime = groups[1];
    const tee = groups[2];
    if (!cedar || !lime || !tee) throw new Error('groups');
    const casey = cedar.players[0];
    const logan = lime.players[0];
    if (!casey || !logan) throw new Error('players');
    const token = events.join(event.code, { groupId: cedar.id, playerId: casey.id });
    const limeToken = events.join(event.code, { groupId: lime.id, playerId: logan.id });
    if (!token.ok || !limeToken.ok) throw new Error('join');
    const post = (guest: string, groupId: string, playerId: string, hole: number, strokes: number, seq: number) => {
      const result = events.applyScore(event.code, { organizer: null, guest }, {
        groupId, playerId, hole, strokes, clientSeq: seq, idempotencyKey: `key-${groupId}-${hole}-${seq}`,
      });
      expect(result.ok).toBe(true);
    };
    post(token.token, cedar.id, casey.id, 1, 5, 1);
    post(token.token, cedar.id, casey.id, 2, 3, 2);
    post(token.token, cedar.id, casey.id, 3, 5, 3);
    post(limeToken.token, lime.id, logan.id, 1, 4, 1);
    post(limeToken.token, lime.id, logan.id, 2, 3, 2);
    const rows = events.publicView(event.code)?.rows ?? [];
    expect(rows.map((row) => row.name)).toEqual(['Lime', 'Cedar', 'Tee']);
    expect(rows.map((row) => row.toPar)).toEqual([-1, 1, null]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, null]);
    expect(rows[2]?.thru).toBe(0);
    expect(formatToPar(-1)).toBe('-1');
    expect(formatToPar(0)).toBe('E');
  });

  it('shares a competition rank when to-par matches, in scramble and stroke', () => {
    const events = store();
    const made = events.create(scrambleInput({
      format: 'stroke',
      groups: [
        { name: 'Cedar', players: [{ name: 'Casey', role: 'scorer' }, { name: 'Quinn', role: 'viewer' }] },
        { name: 'Lime', players: [{ name: 'Logan', role: 'scorer' }] },
        { name: 'Tee', players: [{ name: 'Taylor', role: 'scorer' }] },
      ],
    }));
    if (!made.ok) throw new Error(made.error);
    const [cedar, lime, tee] = made.event.groups;
    if (!cedar || !lime || !tee) throw new Error('groups');
    const casey = cedar.players[0];
    const quinn = cedar.players[1];
    const logan = lime.players[0];
    if (!casey || !quinn || !logan) throw new Error('players');
    const write = (groupId: string, playerId: string, hole: number, strokes: number) => {
      const result = events.applyScore(made.event.code, { organizer: made.organizerToken, guest: null }, {
        groupId, playerId, hole, strokes, clientSeq: hole, idempotencyKey: `stroke-${playerId}-${hole}`,
      });
      expect(result.ok).toBe(true);
    };
    write(cedar.id, casey.id, 1, 5);
    write(cedar.id, casey.id, 2, 3);
    write(cedar.id, quinn.id, 1, 5);
    write(lime.id, logan.id, 1, 6);
    const rows = leaderboard({ format: 'stroke', groups: events.snapshot()[0]?.groups ?? [], scores: events.snapshot()[0]?.scores ?? [], pars: events.snapshot()[0]?.pars ?? [] });
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName.Casey?.toPar).toBe(0);
    expect(byName.Quinn?.toPar).toBe(0);
    expect(byName.Casey?.rank).toBe(1);
    expect(byName.Quinn?.rank).toBe(1);
    expect(byName.Logan?.rank).toBe(3);
    expect(byName.Logan?.toPar).toBe(1);
    expect(byName.Taylor?.rank).toBeNull();
    expect(byName.Casey?.thru).toBeGreaterThan(byName.Quinn?.thru ?? 0);
  });
});

describe('charity permissions and sync', () => {
  it('lets the scorer post for the group and refuses everyone else', async () => {
    const { events, event, organizerToken } = created();
    const cedar = event.groups[0];
    const lime = event.groups[1];
    if (!cedar || !lime) throw new Error('groups');
    const casey = cedar.players[0];
    const quinn = cedar.players[1];
    const logan = lime.players[0];
    if (!casey || !quinn || !logan) throw new Error('players');
    const scorer = events.join(event.code, { groupId: cedar.id, playerId: casey.id });
    const viewer = events.join(event.code, { groupId: cedar.id, playerId: quinn.id });
    if (!scorer.ok || !viewer.ok) throw new Error('join');
    expect(scorer.role).toBe('scorer');
    expect(viewer.role).toBe('viewer');
    const again = events.join(event.code, { groupId: cedar.id, playerId: casey.id });
    if (!again.ok) throw new Error('watch');
    expect(again.role).toBe('viewer');
    expect(again.token).not.toBe(scorer.token);

    const denied = events.applyScore(event.code, { organizer: null, guest: viewer.token }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 4, clientSeq: 1, idempotencyKey: 'viewer-try-1',
    });
    expect(denied).toMatchObject({ ok: false, status: 403 });
    const other = events.applyScore(event.code, { organizer: null, guest: scorer.token }, {
      groupId: lime.id, playerId: logan.id, hole: 1, strokes: 4, clientSeq: 1, idempotencyKey: 'other-group-1',
    });
    expect(other).toMatchObject({ ok: false, status: 403 });
    const stranger = events.applyScore(event.code, { organizer: 'nope', guest: 'nope' }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 4, clientSeq: 1, idempotencyKey: 'stranger-key',
    });
    expect(stranger).toMatchObject({ ok: false, status: 401 });

    const posted = events.applyScore(event.code, { organizer: null, guest: scorer.token }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 4, clientSeq: 2, idempotencyKey: 'casey-hole-1',
    });
    expect(posted.ok).toBe(true);
    const duplicate = events.applyScore(event.code, { organizer: null, guest: scorer.token }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 9, clientSeq: 9, idempotencyKey: 'casey-hole-1',
    });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true });
    expect(events.publicView(event.code)?.rows.find((row) => row.name === 'Cedar')?.toPar).toBe(-1);

    const stale = events.applyScore(event.code, { organizer: null, guest: scorer.token }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 8, clientSeq: 1, idempotencyKey: 'casey-older-1',
    });
    expect(stale).toMatchObject({ ok: true, stale: true });
    expect(events.publicView(event.code)?.rows.find((row) => row.name === 'Cedar')?.toPar).toBe(-1);

    const locked = events.lockHole(event.code, organizerToken, { groupId: cedar.id, hole: 1, locked: true });
    expect(locked.ok).toBe(true);
    const held = events.applyScore(event.code, { organizer: null, guest: scorer.token }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 7, clientSeq: 4, idempotencyKey: 'casey-held-01',
    });
    expect(held).toMatchObject({ ok: false, status: 409 });
    const fixed = events.applyScore(event.code, { organizer: organizerToken, guest: null }, {
      groupId: cedar.id, playerId: casey.id, hole: 1, strokes: 6, clientSeq: 3, idempotencyKey: 'organizer-fix1',
    });
    expect(fixed.ok).toBe(true);
    expect(events.publicView(event.code)?.rows.find((row) => row.name === 'Cedar')?.toPar).toBe(1);

    const board = await read(await serveEvent(new Request(`http://local/v1/events/${event.code}`, {
      headers: { 'x-coopr-secret': 'not-the-event-gate' },
    }), events));
    expect(board.status).toBe(200);
    const encoded = JSON.stringify(board.body);
    expect(encoded).not.toContain(organizerToken);
    expect(encoded).not.toContain(scorer.token);
    expect(encoded).not.toContain('organizerToken');
    const wrong = await read(await serveEvent(new Request(`http://local/v1/events/${event.code}`, {
      headers: { 'x-coopr-organizer': 'sample-organizer-token' },
    }), events));
    expect(wrong.status).toBe(401);
  });

  it('keeps an offline score, sends it once, and does not let a viewer queue one', async () => {
    const { events, event } = created();
    const cedar = event.groups[0];
    const casey = cedar?.players[0];
    const quinn = cedar?.players[1];
    if (!cedar || !casey || !quinn) throw new Error('roster');
    const scorer = events.join(event.code, { groupId: cedar.id, playerId: casey.id });
    const viewer = events.join(event.code, { groupId: cedar.id, playerId: quinn.id });
    if (!scorer.ok || !viewer.ok) throw new Error('join');
    const disk = memory();
    const session: LiveSession = {
      code: event.code,
      eventName: event.name,
      format: 'scramble',
      groupId: cedar.id,
      playerId: casey.id,
      name: 'Casey',
      role: 'scorer',
      token: scorer.token,
    };
    saveSession(session, disk);
    expect(queueEventScore(1, 4, disk)?.hole).toBe(1);
    queueEventScore(1, 5, disk);
    const queued = JSON.parse(disk.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
    expect(queued).toHaveLength(1);
    expect(queued[0]?.strokes).toBe(5);

    let calls = 0;
    const offline = await flushOutbox(queued, async () => {
      calls += 1;
      throw new Error('offline');
    });
    expect(offline).toHaveLength(1);
    expect(offline[0]?.status).toBe('pending');

    const held = await flushOutbox(offline, async () => ({ status: 409, error: 'Held. The organizer locked this hole.' }));
    expect(held[0]?.status).toBe('conflict');
    queueEventScore(1, 4, disk);
    const retried = JSON.parse(disk.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
    expect(retried).toHaveLength(1);
    expect(retried[0]?.status).toBe('pending');
    expect(retried[0]?.strokes).toBe(4);

    const sent = await flushOutbox(retried, async (entry) => {
      calls += 1;
      const result = events.applyScore(event.code, { organizer: null, guest: scorer.token }, entry);
      if (!result.ok) return { status: result.status, error: result.error };
      return { status: 200 };
    });
    expect(sent).toHaveLength(0);
    const again = await flushOutbox(sent, async () => {
      calls += 1;
      return { status: 200 };
    });
    expect(again).toHaveLength(0);
    const duplicate = events.applyScore(event.code, { organizer: null, guest: scorer.token }, retried[0] ?? {});
    expect(duplicate).toMatchObject({ ok: true, duplicate: true });
    expect(events.publicView(event.code)?.rows.find((row) => row.name === 'Cedar')?.gross).toBe(4);
    expect(calls).toBe(2);

    const watching = memory();
    saveSession({ ...session, role: 'viewer', token: viewer.token, playerId: quinn.id }, watching);
    expect(queueEventScore(2, 3, watching)).toBeNull();
    expect(watching.getItem(OUTBOX_KEY)).toBeNull();
  });
});

describe('charity logos and the sample event', () => {
  it('rejects a huge file and a script, and keeps the sample sponsors fake', async () => {
    expect(inspectLogo(TINY_PNG).ok).toBe(true);
    const script = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')}`;
    expect(inspectLogo(script)).toMatchObject({ ok: false });
    const handler = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')}`;
    expect(inspectLogo(handler)).toMatchObject({ ok: false });
    expect(inspectLogo(`data:image/png;base64,${'A'.repeat(900_000)}`).ok).toBe(false);

    const events = store();
    const seeded = await read(await serveEvent(new Request('http://local/v1/events/demo', { method: 'POST' }), events));
    const event = seeded.body.event as { logos: { name: string; slot: string; hole: number | null }[]; rows: { name: string; toPar: number | null; rank: number | null }[] };
    const seededEvent = event as typeof event & {
      name: string;
      charityName: string;
      charityDetail: string;
      courseName: string;
      courseAddress: string;
      date: string;
      startTime: string;
      accent: string;
      pars: number[];
      teamSize: number;
      includesCart: boolean;
      mulliganPriceLabel: string;
      mulliganScope: string;
      mulliganMax: number;
      startStyle: string;
      tiebreak: string;
      contests: { closestToPin: number[]; longestDrive: number[] };
      friends: string[];
      groups: { name: string; waitlist: boolean; players: { name: string }[] }[];
    };
    expect(seededEvent.name).toBe('Panthers Golf Classic');
    expect(seededEvent.charityName).toBe('Bonney Lake Jr. Panthers');
    expect(seededEvent.charityDetail).toContain('501(c)(3)');
    expect(seededEvent.courseName).toBe('Auburn Golf Course');
    expect(seededEvent.courseAddress).toContain('29630 Green River Rd SE');
    expect(seededEvent.date).toBe('2027-05-23');
    expect(seededEvent.startTime).toBe('07:30');
    expect(seededEvent.accent).toBe('#1EC8C8');
    expect(seededEvent.pars.reduce((sum, par) => sum + par, 0)).toBe(71);
    expect(seededEvent.teamSize).toBe(4);
    expect(seededEvent.includesCart).toBe(true);
    expect(seededEvent.mulliganPriceLabel).toBe('');
    expect(seededEvent.mulliganScope).toBe('team');
    expect(seededEvent.mulliganMax).toBe(4);
    expect(seededEvent.startStyle).toBe('modified-shotgun');
    expect(seededEvent.tiebreak).toBe('back-nine');
    expect(seededEvent.contests).toEqual({ closestToPin: [], longestDrive: [] });
    expect(seededEvent.groups.filter((group) => !group.waitlist)).toHaveLength(34);
    expect(seededEvent.groups.filter((group) => group.waitlist)).toHaveLength(2);
    expect(seededEvent.groups[0]?.players).toHaveLength(4);
    expect(event.logos.map((logo) => logo.name)).toEqual([
      'Sample Title Sponsor',
      'Sample Team Hole',
      'Sample Hole Sponsor',
      'Sample Player Photo',
      'Sample Panther Cup',
      'Sample Mulligan Sponsor',
      'Sample Prize Partner',
      'Sample Share Card',
    ]);
    expect(event.logos.every((logo) => logo.dataUrl.startsWith('data:image/svg+xml'))).toBe(true);
    expect(event.logos.find((logo) => logo.slot === 'hole')?.hole).toBe(1);
    expect(event.logos.find((logo) => logo.slot === 'kid-photo')?.hole).toBe(1);
    expect(seededEvent.friends).toEqual(['Sample Friend A', 'Sample Friend B']);
    expect(event.rows.find((row) => row.name === 'Sample Team B')?.toPar).toBe(-1);
    expect(event.rows.find((row) => row.name === 'Team 03')?.rank).toBeNull();
    expect(event.rows.find((row) => row.name === 'Waitlist 1')?.waitlist).toBe(true);
    expect(JSON.stringify(seeded.body)).not.toContain(DEMO_ORGANIZER_TOKEN);

    const { events: live, event: made, organizerToken } = created();
    const added = live.addLogo(made.code, organizerToken, 'Sample Sponsor A', TINY_PNG);
    expect(added.ok).toBe(true);
    const logoId = live.publicView(made.code)?.logos[0]?.id;
    const assigned = live.assignLogo(made.code, organizerToken, logoId, 'hole', 7);
    expect(assigned.ok).toBe(true);
    expect(live.publicView(made.code)?.logos[0]).toMatchObject({ slot: 'hole', hole: 7 });
    const guest = live.addLogo(made.code, 'nope', 'Nope', TINY_PNG);
    expect(guest).toMatchObject({ ok: false, status: 401 });
  });

  it('reloads scores from the file and does not reset the sample', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coopr-events-'));
    const file = join(dir, 'charity-events.json');
    const first = openFileEventStore(file);
    const demo = first.ensureDemo();
    const team = demo.groups[0];
    const player = team?.players[0];
    if (!team || !player) throw new Error('demo');
    const joined = first.join(demo.code, { groupId: team.id, playerId: player.id });
    if (!joined.ok) throw new Error('join');
    const posted = first.applyScore(demo.code, { organizer: null, guest: joined.token }, {
      groupId: team.id, playerId: player.id, hole: 5, strokes: 4, clientSeq: 9, idempotencyKey: 'file-score-5',
    });
    expect(posted.ok).toBe(true);
    const second = openFileEventStore(file);
    expect(second.publicView('SAMPLE')?.rows.find((row) => row.name === 'Sample Team A')?.thru).toBe(5);
    second.ensureDemo();
    expect(second.publicView('SAMPLE')?.rows.find((row) => row.name === 'Sample Team A')?.thru).toBe(5);
    const queued = enqueueScore([], {
      idempotencyKey: 'file-score-5b', eventCode: 'SAMPLE', groupId: team.id, playerId: player.id, hole: 6, strokes: 4, clientSeq: 10, status: 'pending', error: null,
    });
    expect(queued).toHaveLength(1);
  });
});

describe('Panthers Classic rules', () => {
  it('caps mulligans per player and per team without taking payment', () => {
    expect(mulliganLimit('team', 4, 4)).toBe(4);
    expect(mulliganLimit('player', 2, 4)).toBe(8);
    expect(SURVEY_CONSENT).toContain('I agree');
    const events = store();
    events.ensureDemo();
    const board = events.publicView('SAMPLE');
    const team = board?.groups[0];
    const players = team?.players ?? [];
    const scorer = players[0];
    const partner = players[1];
    if (!team || !scorer || !partner) throw new Error('roster');
    const joined = events.join('SAMPLE', { groupId: team.id, playerId: scorer.id, playerName: 'Casey' });
    if (!joined.ok) throw new Error('join');
    const use = (key: string, playerId?: string) => events.useMulligan('SAMPLE', joined.token, { hole: 1, idempotencyKey: key, playerId });
    expect(use('mulligan-key-1').ok).toBe(true);
    expect(use('mulligan-key-1')).toMatchObject({ ok: true, duplicate: true });
    expect(use('mulligan-key-2').ok).toBe(true);
    expect(use('mulligan-key-3').ok).toBe(true);
    expect(use('mulligan-key-4').ok).toBe(true);
    expect(use('mulligan-key-5')).toMatchObject({ ok: false, status: 409 });
    expect(events.publicView('SAMPLE')?.rows.find((row) => row.groupId === team.id)?.mulligansUsed).toBe(4);
    expect(partner.role).toBe('viewer');
    expect(reviewSurvey({ name: 'Casey', ease: 'easy', wouldUse: 'yes', email: 'casey@example.com', emailConsent: false }).ok).toBe(false);
    const saved = events.saveSurvey('SAMPLE', joined.token, { ease: 'easy', wouldUse: 'maybe', next: 'A watch', email: 'casey@example.com', emailConsent: true });
    expect(saved.ok).toBe(true);
    const refused = events.saveSurvey('SAMPLE', joined.token, { ease: 'easy', wouldUse: 'yes', email: 'other@example.com', emailConsent: false });
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(events.publicView('SAMPLE'))).not.toContain('casey@example.com');
    const organizer = events.organizerView('SAMPLE', DEMO_ORGANIZER_TOKEN);
    if ('ok' in organizer) throw new Error('organizer');
    expect(organizer.surveys[0]?.email).toBe('casey@example.com');
    expect(organizer.surveys[0]?.emailConsent).toBe(true);
  });

  it('lets a team claim its name once, and keeps a waitlist score off the ranking', () => {
    const events = store();
    events.ensureDemo();
    const board = events.publicView('SAMPLE');
    const open = board?.groups.find((group) => group.name === 'Team 03');
    const wait = board?.groups.find((group) => group.name === 'Waitlist 1');
    const scorer = open?.players[0];
    const waiting = wait?.players[0];
    if (!open || !scorer || !wait || !waiting) throw new Error('teams');
    const joined = events.join('SAMPLE', { groupId: open.id, playerId: scorer.id, playerName: 'Riley', teamName: 'River Cats' });
    if (!joined.ok) throw new Error('join');
    expect(events.publicView('SAMPLE')?.groups.find((group) => group.id === open.id)?.name).toBe('River Cats');
    const again = events.claimTeam('SAMPLE', joined.token, 'Other Name');
    expect(again).toMatchObject({ ok: false, status: 409 });
    const bench = events.join('SAMPLE', { groupId: wait.id, playerId: waiting.id });
    if (!bench.ok) throw new Error('wait');
    const posted = events.applyScore('SAMPLE', { organizer: null, guest: bench.token }, {
      groupId: wait.id, playerId: waiting.id, hole: 1, strokes: 3, clientSeq: 1, idempotencyKey: 'waitlist-birdie',
    });
    expect(posted.ok).toBe(true);
    const row = events.publicView('SAMPLE')?.rows.find((item) => item.groupId === wait.id);
    expect(row?.waitlist).toBe(true);
    expect(row?.rank).toBeNull();
    expect(events.publicView('SAMPLE')?.rows.find((item) => item.name === 'Sample Team B')?.rank).toBe(1);
    const themed = events.update('SAMPLE', DEMO_ORGANIZER_TOKEN, { closestToPin: [7, 14], longestDrive: [6] });
    expect(themed.ok).toBe(true);
    if (!themed.ok) return;
    expect(themed.event.contests).toEqual({ closestToPin: [7, 14], longestDrive: [6] });
    expect(JSON.stringify(events.publicView('SAMPLE'))).not.toContain('Pro Golf');
    expect(JSON.stringify(events.publicView('SAMPLE'))).not.toContain('hole-in-one');
  });

  it('imports a Jotform CSV, shares a starting hole, and breaks a tie from the back nine', () => {
    const events = store();
    const made = events.create(scrambleInput({
      groups: [
        { name: 'Cedar', players: [{ name: 'Casey', role: 'scorer' }] },
        { name: 'Lime', players: [{ name: 'Logan', role: 'scorer' }] },
      ],
    }));
    if (!made.ok) throw new Error(made.error);
    const imported = events.importTeams(made.event.code, made.organizerToken, 'Team name,Golfer 1,Golfer 2,Golfer 3,Golfer 4\nRiver Cats,Casey,Quinn,Riley,Avery\n"Lime, Squad",Logan,Pat');
    if (!imported.ok) throw new Error(imported.error);
    expect(imported.teams).toBe(2);
    expect(imported.event.groups[0]?.name).toBe('River Cats');
    expect(imported.event.groups[0]?.players).toHaveLength(4);
    expect(imported.event.groups[0]?.players[0]?.role).toBe('scorer');
    expect(imported.event.groups[1]?.name).toBe('Lime, Squad');
    const tooMany = events.importTeams(made.event.code, made.organizerToken, 'Full,A,B,C,D,E');
    expect(tooMany).toMatchObject({ ok: false, status: 400 });
    const cats = imported.event.groups[0];
    const lime = imported.event.groups[1];
    if (!cats || !lime) throw new Error('imported');
    const starts = events.update(made.event.code, made.organizerToken, { starts: [{ groupId: cats.id, hole: 7 }, { groupId: lime.id, hole: 7 }] });
    expect(starts.ok).toBe(true);
    const view = events.publicView(made.event.code);
    expect(view?.groups.filter((group) => group.startingHole === 7)).toHaveLength(2);
    const card = view?.pars ?? [];
    const write = (groupId: string, playerId: string, hole: number, strokes: number) => {
      const result = events.applyScore(made.event.code, { organizer: made.organizerToken, guest: null }, {
        groupId, playerId, hole, strokes, clientSeq: hole, idempotencyKey: `card-${groupId}-${hole}`,
      });
      expect(result.ok).toBe(true);
    };
    const catScorer = cats.players[0];
    const limeScorer = lime.players[0];
    if (!catScorer || !limeScorer) throw new Error('scorers');
    for (let hole = 10; hole <= 18; hole += 1) {
      const par = card[hole - 1] ?? 4;
      write(cats.id, catScorer.id, hole, hole === 18 ? par + 1 : hole === 10 ? par - 1 : par);
      write(lime.id, limeScorer.id, hole, par);
    }
    const rows = events.publicView(made.event.code)?.rows ?? [];
    expect(rows.find((row) => row.name === 'Lime, Squad')?.rank).toBe(1);
    expect(rows.find((row) => row.name === 'River Cats')?.rank).toBe(2);
    const blocked = events.importTeams(made.event.code, made.organizerToken, 'Late,Ada');
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    const cleared = events.clearScores(made.event.code, made.organizerToken);
    expect(cleared.ok).toBe(true);
    const again = events.importTeams(made.event.code, made.organizerToken, 'Late Team,Ada,Bea');
    expect(again.ok).toBe(true);
  });

  it('opens a shotgun on the assigned hole and will not finish with holes still open', () => {
    expect(shotgunOrder(10)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(nextShotgunHole(18, 10, 'next')).toBe(1);
    expect(nextShotgunHole(9, 10, 'next')).toBeNull();
    const open = Array.from({ length: 18 }, () => 4);
    open[2] = null as unknown as number;
    const blocked = finishBlocked(open, 10);
    expect(blocked).toEqual({ ok: false, open: [3] });
    expect(finishBlocked(Array.from({ length: 18 }, () => 4), 10)).toEqual({ ok: true });
    expect(viewerScoreMessage('Casey')).toBe('Only Casey can post scores');
    const events = store();
    const made = events.create(scrambleInput());
    if (!made.ok) throw new Error(made.error);
    expect(made.event.mulliganMax).toBe(4);
    expect(made.event.mulliganScope).toBe('team');
    expect(made.event.accent).toBe('#1EC8C8');
    const group = made.event.groups[0];
    if (!group) throw new Error('group');
    const started = events.update(made.event.code, made.organizerToken, { starts: [{ groupId: group.id, hole: 10 }] });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.event.groups.find((item) => item.id === group.id)?.startingHole).toBe(10);
  });

  it('scores an event round on that event card, offline and on the recap', () => {
    const disk = memory();
    const session: LiveSession = {
      code: 'SAMPLE',
      eventName: 'Panthers Golf Classic',
      format: 'scramble',
      groupId: 'demo-team-1',
      playerId: 'demo-team-1-p1',
      name: 'Casey',
      role: 'scorer',
      token: 'guest-token',
      pars: [...AUBURN_PARS],
      courseName: 'Auburn Golf Course',
    };
    saveSession(session, disk);
    rememberEventCard({ code: 'SAMPLE', courseName: 'Auburn Golf Course', pars: [...AUBURN_PARS] }, disk);
    const used = AUBURN_PARS.map((_, index) => parForHole(index + 1, AUBURN_PARS, HIGH_CEDARS_PARS[index] ?? null));
    expect(foreignPars([...AUBURN_PARS], used)).toEqual([]);
    expect(eventPar(9, disk)).toBe(5);
    expect(HIGH_CEDARS_PARS[8]).toBe(4);
    expect(parForHole(9, AUBURN_PARS, HIGH_CEDARS_PARS[8] ?? null)).toBe(5);
    const seven = [...AUBURN_PARS.slice(0, 7), ...Array.from({ length: 11 }, () => null)];
    const hudPars = courseParsForRound(HIGH_CEDARS_PARS, AUBURN_PARS);
    expect(foreignPars([...AUBURN_PARS], hudPars)).toEqual([]);
    expect(thruHud(seven, hudPars)).toBe('Thru 7 · E');
    expect(thruHud(seven, HIGH_CEDARS_PARS)).not.toBe('Thru 7 · E');
    const rows = AUBURN_PARS.map((par, index) => ({
      strokes: par,
      par: parForHole(index + 1, AUBURN_PARS, HIGH_CEDARS_PARS[index] ?? null),
      putts: null,
      fairway: null,
      gir: null,
    }));
    expect(recapSummary(rows).headline).toBe('Gross 71 · E');
    const homeCourse = AUBURN_PARS.map((par, index) => ({
      strokes: par,
      par: HIGH_CEDARS_PARS[index] ?? null,
      putts: null,
      fairway: null,
      gir: null,
    }));
    expect(recapSummary(homeCourse).headline).not.toBe('Gross 71 · E');
    const events = store();
    const made = events.create(scrambleInput());
    if (!made.ok) throw new Error(made.error);
    const added = events.addLogo(made.event.code, made.organizerToken, 'Sample Hole Sponsor', TINY_PNG);
    expect(added.ok).toBe(true);
    const logoId = events.publicView(made.event.code)?.logos[0]?.id;
    const assigned = events.assignLogo(made.event.code, made.organizerToken, logoId, 'hole', 9);
    expect(assigned.ok).toBe(true);
    expect(events.publicView(made.event.code)?.logos.find((logo) => logo.slot === 'hole' && logo.hole === 9)?.name).toBe('Sample Hole Sponsor');
  });
});

describe('durable event store', () => {
  it('keeps concurrent posts, replays an idempotency key once, and seeds SAMPLE', async () => {
    expect(schemaFileMatches()).toBe(true);
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(databaseUrl()).toBeNull();
    process.env.DATABASE_URL = 'postgresql://example.neon.tech/coopr';
    expect(databaseUrl()).toBe('postgresql://example.neon.tech/coopr');
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;

    const adapter = createMemoryEventAdapter();
    await seedSampleEvent(adapter);
    const actor = { organizer: DEMO_ORGANIZER_TOKEN, guest: null };
    const post = (team: number, hole: number, key: string) => commitOnAdapter(adapter, (store) => store.applyScore('SAMPLE', actor, {
      groupId: `demo-team-${team}`,
      playerId: `demo-team-${team}-p1`,
      hole,
      strokes: 4,
      clientSeq: hole,
      idempotencyKey: key,
    }));
    const results = await Promise.all([1, 2, 3, 4].map((team) => post(team, 10, `team-${team}-hole-10`)));
    expect(results.every((result) => result.ok && result.duplicate === false && result.stale === false)).toBe(true);
    const saved = await adapter.read('SAMPLE');
    expect(saved?.event.scores.filter((score) => score.hole === 10).map((score) => score.groupId).sort()).toEqual([
      'demo-team-1',
      'demo-team-2',
      'demo-team-3',
      'demo-team-4',
    ]);
    const replay = await post(1, 10, 'team-1-hole-10');
    expect(replay).toMatchObject({ ok: true, duplicate: true });
    const parallel = await Promise.all([0, 1, 2, 3].map(() => post(6, 12, 'replay-team-6')));
    expect(parallel.filter((result) => result.ok && result.duplicate === false && result.stale === false)).toHaveLength(1);
    const again = await adapter.read('SAMPLE');
    expect(again?.event.scores.filter((score) => score.idempotencyKey === 'replay-team-6')).toHaveLength(1);
    expect(again?.event.scores.filter((score) => score.hole === 10)).toHaveLength(4);
    const revision = again?.revision;
    await seedSampleEvent(adapter);
    const seeded = await adapter.read('SAMPLE');
    expect(seeded?.event.name).toBe('Panthers Golf Classic');
    expect(seeded?.event.mulliganMax).toBe(4);
    expect(seeded?.revision).toBe(revision);
    expect(seeded?.event.scores.filter((score) => score.hole === 10)).toHaveLength(4);
  });

  it('points the phone, the board, and the join link at one origin', () => {
    const previous = process.env.EXPO_PUBLIC_EVENT_ORIGIN;
    const previousNode = process.env.NODE_ENV;
    const previousNav = globalThis.navigator;
    const globalFlags = globalThis as { __DEV__?: boolean; location?: { origin?: string } };
    const previousDev = globalFlags.__DEV__;
    const previousLocation = globalFlags.location;
    try {
      process.env.EXPO_PUBLIC_EVENT_ORIGIN = 'https://coopr.expo.app/';
      expect(eventOrigin()).toBe(HOSTED_EVENT_ORIGIN);
      expect(joinLink('SAMPLE')).toBe('https://coopr.expo.app/event/join?code=SAMPLE');
      delete process.env.EXPO_PUBLIC_EVENT_ORIGIN;
      globalFlags.location = { origin: 'https://coopr.expo.app' };
      expect(eventOrigin()).toBe(HOSTED_EVENT_ORIGIN);
      expect(joinLink('SAMPLE')).toBe('https://coopr.expo.app/event/join?code=SAMPLE');
      globalFlags.location = undefined;
      Object.defineProperty(globalThis, 'navigator', { value: { product: 'ReactNative' }, configurable: true });
      globalFlags.__DEV__ = true;
      expect(() => eventOrigin()).toThrow(/EXPO_PUBLIC_EVENT_ORIGIN/);
      globalFlags.__DEV__ = false;
      process.env.NODE_ENV = 'production';
      expect(eventOrigin()).toBe(HOSTED_EVENT_ORIGIN);
    } finally {
      if (previous === undefined) delete process.env.EXPO_PUBLIC_EVENT_ORIGIN;
      else process.env.EXPO_PUBLIC_EVENT_ORIGIN = previous;
      if (previousNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNode;
      Object.defineProperty(globalThis, 'navigator', { value: previousNav, configurable: true });
      globalFlags.__DEV__ = previousDev;
      globalFlags.location = previousLocation;
    }
  });
});
