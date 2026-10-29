/** Guards for the EAS Hosting routes. No key lives here. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_CADDIE_BYTES = 32 * 1024;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;
/** A live caddie month stops at this spend. One hundred dollars. */
export const MONTHLY_BUDGET_CENTS = 10_000;
/** Conservative cost of one model turn. The real bill is usually lower. */
export const CADDIE_TURN_CENTS = 2;
export const SECRET_HEADER = 'x-coopr-secret';

export function mediaTypeOf(header: string | null | undefined): string {
  return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/**
 * A missing server secret is a refusal. The compare always walks both strings
 * so a mismatch does not return on the first different character.
 */
export function secretOk(header: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim() ?? '';
  if (!expected) return false;
  const got = header ?? '';
  const length = Math.max(got.length, expected.length);
  let diff = got.length === expected.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (got.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return diff === 0;
}

/** Read the body in chunks and stop once it passes the cap. Null means too large. */
export async function readBounded(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (bodyTooLarge(request, maxBytes)) return null;
  const reader = request.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    const value = step.value;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* The caller already stopped reading. */
      }
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function allowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((item) => item.trim()).filter((item) => item.startsWith('https://') || item.startsWith('http://localhost'));
}

/** No wildcard. An origin is echoed only when it is on the list. */
export function corsHeaders(origin: string | null, allowedRaw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'access-control-allow-headers': `authorization, content-type, ${SECRET_HEADER}`,
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
    'cache-control': 'no-store',
  };
  if (origin && allowedOrigins(allowedRaw).includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const declared = request.headers.get('content-length');
  if (!declared) return false;
  const size = Number(declared);
  return Number.isFinite(size) && size > maxBytes;
}

export function budgetAllows(spentCents: number, turnCents = CADDIE_TURN_CENTS, cap = MONTHLY_BUDGET_CENTS): boolean {
  return spentCents >= 0 && turnCents >= 0 && spentCents + turnCents <= cap;
}

export function budgetMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Add this turn to the month counter in Upstash.
 * The new total above the cap is a refusal. A failed call is a refusal.
 */
export async function upstashCharge(
  fetchImpl: typeof fetch,
  baseUrl: string,
  token: string,
  key: string,
  cents: number,
  cap: number,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([
        ['INCRBY', key, String(cents)],
        ['EXPIRE', key, String(40 * 24 * 60 * 60), 'NX'],
      ]),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { result?: number }[];
    const spent = data[0]?.result;
    return typeof spent === 'number' && spent <= cap;
  } catch {
    return false;
  }
}

/** Upstash REST increment. Count above the limit is a refusal. A failed call is a refusal. */
export async function upstashAllow(
  fetchImpl: typeof fetch,
  baseUrl: string,
  token: string,
  key: string,
  limit: number,
): Promise<boolean> {
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, '70', 'NX']]),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { result?: number }[];
    const count = data[0]?.result;
    return typeof count === 'number' && count <= limit;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  const cloudflare = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

/** True when this IP is still inside the window. Mutates the store. */
export function allowRequest(
  ip: string,
  store: Map<string, number[]>,
  now: number,
  limit = RATE_LIMIT,
  windowMs = RATE_WINDOW_MS,
): boolean {
  const recent = (store.get(ip) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    store.set(ip, recent);
    return false;
  }
  recent.push(now);
  store.set(ip, recent);
  if (store.size > 2000) store.clear();
  return true;
}

export function declaredTooLarge(request: Request): boolean {
  return bodyTooLarge(request, MAX_UPLOAD_BYTES);
}
