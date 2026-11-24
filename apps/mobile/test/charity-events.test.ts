import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { queueEventScore, OUTBOX_KEY, saveSession, type StorageLike } from '../src/events/client';
import { DEMO_ORGANIZER_TOKEN } from '../src/events/types';
import { openFileEventStore } from '../src/events/file-store';
import { inspectLogo } from '../src/events/logos';
import { enqueueScore, flushOutbox, type OutboxEntry } from '../src/events/outbox';
import { formatToPar, leaderboard } from '../src/events/scoring';
import { serveEvent } from '../src/events/serve';
import { createEventStore, type EventStore } from '../src/events/store';
import type { CreateEventInput, LiveSession } from '../src/events/types';

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
    expect(event.logos.map((logo) => logo.name)).toEqual(['Sample Sponsor A', 'Sample Sponsor B', 'Sample Sponsor C', 'Sample Sponsor D']);
    expect(event.logos.find((logo) => logo.slot === 'hole')?.hole).toBe(1);
    expect(event.rows.find((row) => row.name === 'Sample Team Lime')?.toPar).toBe(-1);
    expect(event.rows.find((row) => row.name === 'Sample Team Tee')?.rank).toBeNull();
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
    expect(second.publicView('SAMPLE')?.rows.find((row) => row.name === 'Sample Team Cedar')?.thru).toBe(5);
    second.ensureDemo();
    expect(second.publicView('SAMPLE')?.rows.find((row) => row.name === 'Sample Team Cedar')?.thru).toBe(5);
    const queued = enqueueScore([], {
      idempotencyKey: 'file-score-5b', eventCode: 'SAMPLE', groupId: team.id, playerId: player.id, hole: 6, strokes: 4, clientSeq: 10, status: 'pending', error: null,
    });
    expect(queued).toHaveLength(1);
  });
});
