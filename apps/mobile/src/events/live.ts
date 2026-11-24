import { eventStore } from './file-store';
import { commitOnAdapter, type EventAdapter } from './adapter';
import { eventError, serveEvent } from './serve';

/** Neon connection string. Server only. Absent means the JSON file. */
export function databaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : null;
}

let hosted: Promise<EventAdapter> | null = null;

function postgresAdapter(url: string): Promise<EventAdapter> {
  if (!hosted) {
    hosted = import('./postgres')
      .then(async ({ createPostgresEventAdapter }) => {
        const adapter = createPostgresEventAdapter(url);
        await adapter.migrate();
        return adapter;
      })
      .catch((error: unknown) => {
        hosted = null;
        throw error;
      });
  }
  return hosted;
}

function replay(request: Request, body: string): Request {
  const method = request.method.toUpperCase();
  const withBody = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: withBody ? body : undefined,
  });
}

/**
 * File store when DATABASE_URL is unset. Postgres when it is set.
 * The request body is read once so a lost race can retry the score.
 */
export async function serveLiveEvent(request: Request): Promise<Response> {
  const url = databaseUrl();
  if (!url) return serveEvent(request, eventStore());
  const body = await request.text();
  try {
    const adapter = await postgresAdapter(url);
    return await commitOnAdapter(adapter, (store) => {
      store.ensureDemo();
      return serveEvent(replay(request, body), store);
    });
  } catch {
    return eventError(request, 503, 'The board could not save that. Try again.');
  }
}
