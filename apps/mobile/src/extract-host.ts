import { handleExtractBuffer, type ExtractEnv } from '@coopr/engine';
import { clientIp, corsHeaders, declaredTooLarge, MAX_UPLOAD_BYTES, mediaTypeOf, readBounded, SECRET_HEADER, secretOk, upstashAllow } from './api-guard';

export function readExtractEnv(env: Record<string, string | undefined> = process.env): ExtractEnv & { COOPR_API_SECRET?: string; ALLOWED_ORIGINS?: string; UPSTASH_REDIS_REST_URL?: string; UPSTASH_REDIS_REST_TOKEN?: string } {
  return {
    EXTRACT_MODE: env.EXTRACT_MODE,
    EXTRACT_TOKEN: env.EXTRACT_TOKEN,
    COOPR_VISION_API_KEY: env.COOPR_VISION_API_KEY,
    COOPR_VISION_BASE_URL: env.COOPR_VISION_BASE_URL,
    COOPR_VISION_MODEL: env.COOPR_VISION_MODEL,
    COOPR_API_SECRET: env.COOPR_API_SECRET,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

function json(request: Request, env: { ALLOWED_ORIGINS?: string }, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(request.headers.get('origin'), env.ALLOWED_ORIGINS) },
  });
}

export async function serveExtract(request: Request, env: ReturnType<typeof readExtractEnv> = readExtractEnv(), fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin'), env.ALLOWED_ORIGINS) });
  if (request.method !== 'POST') return json(request, env, 405, { error: 'POST the photo.', imageRetained: false });
  if (!secretOk(request.headers.get(SECRET_HEADER), env.COOPR_API_SECRET)) {
    return json(request, env, 401, { error: 'The extract secret did not match.', imageRetained: false });
  }
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  const allowed = !url || !token ? true : await upstashAllow(fetchImpl, url, token, `extract:${clientIp(request)}`, 20);
  if (!allowed) {
    return json(request, env, 429, { error: 'Too many photos. Wait a minute and try again.', imageRetained: false });
  }
  if (declaredTooLarge(request)) {
    return json(request, env, 413, { error: 'The upload is larger than 8 MB. It was not kept.', imageRetained: false });
  }
  const type = mediaTypeOf(request.headers.get('content-type'));
  if (type !== 'application/json' && !type.startsWith('image/')) {
    return json(request, env, 415, { error: 'The upload was not a photo. Nothing was read.', imageRetained: false });
  }
  const raw = await readBounded(request, MAX_UPLOAD_BYTES);
  if (!raw) {
    return json(request, env, 413, { error: 'The upload is larger than 8 MB. It was not kept.', imageRetained: false });
  }
  let payload = raw;
  if (type.startsWith('image/')) {
    let binary = '';
    const step = 0x8000;
    for (let index = 0; index < raw.length; index += step) {
      binary += String.fromCharCode(...raw.subarray(index, index + step));
    }
    raw.fill(0);
    payload = new TextEncoder().encode(JSON.stringify({ imageBase64: btoa(binary), mediaType: type }));
  }
  const result = await handleExtractBuffer(payload, request.headers.get('authorization'), env);
  return json(request, env, result.status, result.body);
}
