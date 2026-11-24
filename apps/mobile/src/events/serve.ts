import { corsHeaders } from '../api-guard';
import type { EventStore } from './store';
import type { CreateEventInput } from './types';

const MAX_BODY = 800_000;

/**
 * Event routes do not use the caddie secret. A public board is a GET.
 * The organizer sends x-coopr-organizer. A scorer sends x-coopr-guest.
 * See docs/CHARITY_EVENTS.md.
 */
function headersFor(origin: string | null): Record<string, string> {
  const headers = corsHeaders(origin, process.env.ALLOWED_ORIGINS);
  headers['access-control-allow-headers'] = 'content-type, x-coopr-organizer, x-coopr-guest';
  headers['access-control-allow-methods'] = 'GET, POST, PATCH, DELETE, OPTIONS';
  return headers;
}

function json(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(origin), 'content-type': 'application/json' },
  });
}

function partsOf(request: Request): string[] {
  let path = request.url;
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = request.url.split('?')[0] ?? '';
  }
  const marker = '/v1/events';
  const index = path.indexOf(marker);
  if (index < 0) return [];
  const rest = path.slice(index + marker.length).replace(/^\/+|\/+$/g, '');
  if (!rest) return [];
  return rest.split('/');
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

export async function serveEvent(request: Request, store: EventStore): Promise<Response> {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(origin) });
  try {
    const result = await routeEvent(request, store);
    return json(origin, result.status, result.body);
  } catch {
    return json(origin, 400, { error: 'Bad request.' });
  }
}

async function routeEvent(request: Request, store: EventStore): Promise<{ status: number; body: unknown }> {
  const parts = partsOf(request);
  const method = request.method.toUpperCase();
  const organizer = request.headers.get('x-coopr-organizer');
  const guest = request.headers.get('x-coopr-guest');
  if (parts.length === 0) {
    if (method === 'GET') {
      return { status: 200, body: { events: store.snapshot().map((event) => ({ code: event.code, name: event.name, charityName: event.charityName, date: event.date, format: event.format, courseName: event.courseName })) } };
    }
    if (method === 'POST') {
      const body = await readBody(request);
      if (body == null) return { status: 413, body: { error: 'That upload is too large.' } };
      const created = store.create(body as unknown as CreateEventInput);
      if (!created.ok) return { status: created.status, body: { error: created.error } };
      return { status: 201, body: { event: created.event, organizerToken: created.organizerToken, joinPath: `/event/join?code=${created.event.code}` } };
    }
  }
  if (parts.length === 1 && parts[0] === 'demo' && method === 'POST') {
    return { status: 200, body: { event: store.ensureDemo() } };
  }
  const code = parts[0] ?? '';
  const action = parts[1] ?? '';
  if (!code || parts.length > 2) return { status: 404, body: { error: 'No event with that code.' } };
  if (parts.length === 1 && method === 'GET') {
    if (organizer) {
      const view = store.organizerView(code, organizer);
      if ('ok' in view) return { status: view.status, body: { error: view.error } };
      return { status: 200, body: { event: view } };
    }
    const event = store.publicView(code);
    if (!event) return { status: 404, body: { error: 'No event with that code.' } };
    return { status: 200, body: { event } };
  }
  if (parts.length === 1 && method === 'PATCH') {
    const body = await readBody(request);
    if (body == null) return { status: 413, body: { error: 'That upload is too large.' } };
    const updated = store.update(code, organizer, body);
    if (!updated.ok) return { status: updated.status, body: { error: updated.error } };
    return { status: 200, body: { event: updated.event } };
  }
  const body = await readBody(request);
  if (body == null) return { status: 413, body: { error: 'That upload is too large.' } };
  if (action === 'join' && method === 'POST') {
    const joined = store.join(code, body);
    if (!joined.ok) return { status: joined.status, body: { error: joined.error } };
    return { status: 200, body: joined };
  }
  if (action === 'score' && method === 'POST') {
    const posted = store.applyScore(code, { organizer, guest }, body);
    if (!posted.ok) return { status: posted.status, body: { error: posted.error } };
    return { status: 200, body: { ok: true, duplicate: posted.duplicate, stale: posted.stale } };
  }
  if (action === 'lock' && method === 'POST') {
    const locked = store.lockHole(code, organizer, body);
    if (!locked.ok) return { status: locked.status, body: { error: locked.error } };
    return { status: 200, body: { ok: true } };
  }
  if (action === 'logos' && method === 'POST') {
    const added = store.addLogo(code, organizer, body.name, body.dataUrl);
    if (!added.ok) return { status: added.status, body: { error: added.error } };
    return { status: 201, body: { event: added.event } };
  }
  if (action === 'logos' && method === 'PATCH') {
    const assigned = store.assignLogo(code, organizer, body.id, body.slot, body.hole);
    if (!assigned.ok) return { status: assigned.status, body: { error: assigned.error } };
    return { status: 200, body: { event: assigned.event } };
  }
  if (action === 'logos' && method === 'DELETE') {
    const removed = store.removeLogo(code, organizer, body.id);
    if (!removed.ok) return { status: removed.status, body: { error: removed.error } };
    return { status: 200, body: { event: removed.event } };
  }
  return { status: 404, body: { error: 'No event with that code.' } };
}
