/** Guards for the EAS Hosting routes. No key lives here. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;

export const VOICE_AUDIO_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/ogg',
] as const;

const AUDIO = new Set<string>(VOICE_AUDIO_TYPES);

export function mediaTypeOf(header: string | null | undefined): string {
  return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

export function isVoiceAudioType(value: string | null | undefined): boolean {
  return AUDIO.has(mediaTypeOf(value));
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
  const declared = request.headers.get('content-length');
  if (!declared) return false;
  const size = Number(declared);
  return Number.isFinite(size) && size > MAX_UPLOAD_BYTES;
}
