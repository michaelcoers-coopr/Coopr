import { handleExtractBuffer, type ExtractEnv } from '@coopr/engine';
import { allowRequest, clientIp, declaredTooLarge, MAX_UPLOAD_BYTES, mediaTypeOf } from './api-guard';

const HITS = new Map<string, number[]>();

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

export function readExtractEnv(env: Record<string, string | undefined> = process.env): ExtractEnv {
  return {
    EXTRACT_MODE: env.EXTRACT_MODE,
    EXTRACT_TOKEN: env.EXTRACT_TOKEN,
    COOPR_VISION_API_KEY: env.COOPR_VISION_API_KEY,
    COOPR_VISION_BASE_URL: env.COOPR_VISION_BASE_URL,
    COOPR_VISION_MODEL: env.COOPR_VISION_MODEL,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

export async function serveExtract(request: Request, env: ExtractEnv = readExtractEnv()): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST the photo.', imageRetained: false });
  if (!allowRequest(clientIp(request), HITS, Date.now())) {
    return json(429, { error: 'Too many photos. Wait a minute and try again.', imageRetained: false });
  }
  if (declaredTooLarge(request)) {
    return json(413, { error: 'The upload is larger than 8 MB. It was not kept.', imageRetained: false });
  }
  const type = mediaTypeOf(request.headers.get('content-type'));
  if (type !== 'application/json' && !type.startsWith('image/')) {
    return json(415, { error: 'The upload was not a photo. Nothing was read.', imageRetained: false });
  }
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_UPLOAD_BYTES) {
    raw.fill(0);
    return json(413, { error: 'The upload is larger than 8 MB. It was not kept.', imageRetained: false });
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
  return json(result.status, result.body);
}
