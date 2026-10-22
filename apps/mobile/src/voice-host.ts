import { handleVoiceBuffer, type VoiceEnv } from '@coopr/engine';
import { allowRequest, clientIp, declaredTooLarge, isVoiceAudioType, MAX_UPLOAD_BYTES, mediaTypeOf } from './api-guard';

const HITS = new Map<string, number[]>();

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
};

/** Server env only. EXPO_PUBLIC_ values are client bundle text and are ignored. */
export function readVoiceEnv(env: Record<string, string | undefined> = process.env): VoiceEnv {
  return {
    ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY,
    ELEVENLABS_STT_MODEL: env.ELEVENLABS_STT_MODEL,
    ELEVENLABS_STT_URL: env.ELEVENLABS_STT_URL,
    EXTRACT_TOKEN: env.EXTRACT_TOKEN,
    VOICE_MODE: env.VOICE_MODE,
  };
}

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS, ...extra },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

export async function serveVoice(request: Request, env: VoiceEnv = readVoiceEnv()): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') {
    return json(405, { error: 'POST the recording.', audioRetained: false });
  }
  if (!allowRequest(clientIp(request), HITS, Date.now())) {
    return json(429, { error: 'Too many recordings. Wait a minute and try again.', audioRetained: false }, { 'retry-after': '60' });
  }
  if (declaredTooLarge(request)) {
    return json(413, { error: 'The upload is larger than 8 MB. It was not kept.', audioRetained: false });
  }

  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_UPLOAD_BYTES) {
    raw.fill(0);
    return json(413, { error: 'The upload is larger than 8 MB. It was not kept.', audioRetained: false });
  }

  const type = mediaTypeOf(request.headers.get('content-type'));
  let payload = raw;
  if (type === 'application/json') {
    let record: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
      record = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      raw.fill(0);
      return json(400, { error: 'The request was not JSON.', audioRetained: false });
    }
    const media = typeof record?.mediaType === 'string' ? record.mediaType : '';
    if (!isVoiceAudioType(media)) {
      raw.fill(0);
      return json(415, { error: 'The recording was not an audio file. Nothing was heard.', audioRetained: false });
    }
  } else if (isVoiceAudioType(type)) {
    if (raw.byteLength === 0) {
      return json(400, { error: 'No audio was sent. Nothing was heard.', audioRetained: false });
    }
    const audioBase64 = bytesToBase64(raw);
    raw.fill(0);
    payload = new TextEncoder().encode(JSON.stringify({ audioBase64, mediaType: type }));
  } else {
    raw.fill(0);
    return json(415, { error: 'The recording was not an audio file. Nothing was heard.', audioRetained: false });
  }

  const authorization = request.headers.get('authorization');
  const result = await handleVoiceBuffer(payload, authorization, env);
  return json(result.status, result.body);
}
