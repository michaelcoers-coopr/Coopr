import { extractionUrl } from './extract-client';

/** Same origin as photo extract. The key stays on the server. */
export async function requestTranscript(input: {
  audioBase64: string;
  mediaType: string;
}): Promise<{ transcript: string; mode: 'sample' | 'live' } | { error: string }> {
  const url = extractionUrl();
  if (!url) return { error: 'No voice server is set. The recording was not sent and was not heard.' };
  let response: Response;
  try {
    response = await fetch(`${url}/v1/voice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64: input.audioBase64, mediaType: input.mediaType }),
    });
  } catch {
    return { error: 'The voice server could not be reached. The recording was not kept there.' };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { error: 'The voice server did not return JSON. Nothing was invented.' };
  }
  if (!response.ok || !payload || typeof payload !== 'object' || typeof (payload as { transcript?: unknown }).transcript !== 'string') {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Transcription failed (${response.status}). Nothing was invented.`;
    return { error: message };
  }
  const mode = (payload as { mode?: unknown }).mode === 'live' ? 'live' : 'sample';
  return { transcript: (payload as { transcript: string }).transcript, mode };
}

export async function audioUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}
