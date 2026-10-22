/** The sample Mike can hear with no key. It is not a recording of him. */
export const SAMPLE_VOICE_TRANSCRIPT = '165 yards out, got a bunker on left, what should i hit off the rough?';

export interface VoiceEnv {
  ELEVENLABS_API_KEY?: string;
  /** Scribe model id. Default scribe_v1. Set scribe_v2 when the account uses it. */
  ELEVENLABS_STT_MODEL?: string;
  ELEVENLABS_STT_URL?: string;
  EXTRACT_TOKEN?: string;
  /** sample forces the canned transcript even when a key is present. */
  VOICE_MODE?: string;
}

export interface VoiceTranscript {
  transcript: string;
  mode: 'sample' | 'live';
  /** False in sample mode: the audio was not sent and was not heard. */
  heard: boolean;
  audioRetained: false;
}

export interface VoiceHttpResult {
  status: number;
  body: VoiceTranscript | { error: string; audioRetained: false };
}

type VoiceFetch = (url: string, init: { method: string; headers: Record<string, string>; body: FormData }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function tokenOk(header: string | null, env: VoiceEnv): boolean {
  if (!env.EXTRACT_TOKEN) return true;
  return header === `Bearer ${env.EXTRACT_TOKEN}`;
}

function bytesFromBase64(audioBase64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function sampleBody(): VoiceTranscript {
  return { transcript: SAMPLE_VOICE_TRANSCRIPT, mode: 'sample', heard: false, audioRetained: false };
}

export async function handleVoiceRequest(input: {
  authorization: string | null;
  payload: unknown;
  env: VoiceEnv;
  fetchImpl?: VoiceFetch;
}): Promise<VoiceHttpResult> {
  if (!tokenOk(input.authorization, input.env)) {
    return { status: 401, body: { error: 'The voice token does not match.', audioRetained: false } };
  }
  const record = typeof input.payload === 'object' && input.payload !== null ? (input.payload as Record<string, unknown>) : null;
  const audioBase64 = typeof record?.audioBase64 === 'string' ? record.audioBase64 : '';
  const mediaType = typeof record?.mediaType === 'string' ? record.mediaType : 'audio/m4a';
  const live = Boolean(input.env.ELEVENLABS_API_KEY) && input.env.VOICE_MODE !== 'sample';
  if (!live) return { status: 200, body: sampleBody() };
  if (!audioBase64) return { status: 400, body: { error: 'No audio was sent. Nothing was heard.', audioRetained: false } };

  const fetchImpl = input.fetchImpl ?? (typeof fetch === 'function' ? (fetch as unknown as VoiceFetch) : undefined);
  if (!fetchImpl) return { status: 500, body: { error: 'Live transcription has no HTTP client.', audioRetained: false } };

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = bytesFromBase64(audioBase64);
  } catch {
    return { status: 400, body: { error: 'The audio was not base64. Nothing was heard.', audioRetained: false } };
  }
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mediaType }), 'ask.m4a');
  form.append('model_id', input.env.ELEVENLABS_STT_MODEL?.trim() || 'scribe_v1');
  const url = (input.env.ELEVENLABS_STT_URL || 'https://api.elevenlabs.io/v1/speech-to-text').replace(/\/$/, '');
  let response: { ok: boolean; status: number; json: () => Promise<unknown> };
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'xi-api-key': input.env.ELEVENLABS_API_KEY ?? '' },
      body: form,
    });
  } catch {
    return { status: 502, body: { error: 'Scribe could not be reached. Nothing was invented.', audioRetained: false } };
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { status: 502, body: { error: 'Scribe did not return JSON. Nothing was invented.', audioRetained: false } };
  }
  const text = typeof payload === 'object' && payload && typeof (payload as { text?: unknown }).text === 'string' ? (payload as { text: string }).text.trim() : '';
  if (!response.ok || !text) {
    return { status: 502, body: { error: 'Scribe did not return a transcript. Nothing was invented.', audioRetained: false } };
  }
  if (audioBase64 && text.includes(audioBase64)) {
    return { status: 500, body: { error: 'Refusing to return the audio.', audioRetained: false } };
  }
  return { status: 200, body: { transcript: text, mode: 'live', heard: true, audioRetained: false } };
}

/** Reads a JSON body, answers, and wipes the audio bytes. */
export async function handleVoiceBuffer(body: Uint8Array, authorization: string | null, env: VoiceEnv, fetchImpl?: VoiceFetch): Promise<VoiceHttpResult> {
  let payload: unknown = null;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    body.fill(0);
    return { status: 400, body: { error: 'The request was not JSON.', audioRetained: false } };
  }
  const result = await handleVoiceRequest({ authorization, payload, env, fetchImpl });
  const secret = typeof payload === 'object' && payload && typeof (payload as { audioBase64?: unknown }).audioBase64 === 'string' ? (payload as { audioBase64: string }).audioBase64 : '';
  body.fill(0);
  if (secret && JSON.stringify(result.body).includes(secret)) {
    return { status: 500, body: { error: 'Refusing to return the audio.', audioRetained: false } };
  }
  return result;
}
