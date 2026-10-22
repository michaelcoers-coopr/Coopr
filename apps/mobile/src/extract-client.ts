import { parsePhotoExtraction, type PhotoExtraction } from '@coopr/engine';

/** Publish-time URL only. Never an API key. */
export function extractionUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_EXTRACT_URL?.trim();
  return url ? url.replace(/\/$/, '') : null;
}

export async function requestExtraction(input: {
  imageBase64: string;
  mediaType: string;
  token: string;
}): Promise<PhotoExtraction | { error: string }> {
  const url = extractionUrl();
  if (!url) return { error: 'No extraction server is set. The photo was not sent and was not read.' };
  let response: Response;
  try {
    response = await fetch(`${url}/v1/extract`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.token.trim() ? { authorization: `Bearer ${input.token.trim()}` } : {}),
      },
      body: JSON.stringify({ imageBase64: input.imageBase64, mediaType: input.mediaType }),
    });
  } catch {
    return { error: 'The extraction server could not be reached. The photo was not kept there.' };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { error: 'The extraction server did not return JSON. Nothing was invented.' };
  }
  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload && !('shots' in payload))) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Extraction failed (${response.status}). Nothing was invented.`;
    return { error: message };
  }
  const mode = payload && typeof payload === 'object' && (payload as { mode?: unknown }).mode === 'live' ? 'live' : 'stub';
  const parsed = parsePhotoExtraction(payload, mode);
  if ('error' in parsed) return parsed;
  parsed.readFromImage = Boolean(payload && typeof payload === 'object' && (payload as { readFromImage?: unknown }).readFromImage === true);
  parsed.imageRetained = false;
  parsed.mode = mode;
  return parsed;
}
