import { parsePhotoExtraction, type PhotoExtraction } from '@coopr/engine';

/** Marked stand-in in eas.json until Mike puts the real EAS Hosting origin here. */
export const EXTRACT_URL_PLACEHOLDER = 'https://REPLACE-WITH-EAS-HOSTING-ORIGIN.expo.app';

/** Marked stand-in until Mike puts a real inbox here. A placeholder does not send mail. */
export const FEEDBACK_EMAIL_PLACEHOLDER = 'REPLACE-WITH-FEEDBACK-EMAIL@example.com';

/** A blank value or a REPLACE placeholder is not a real address. */
export function configuredAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || /REPLACE/i.test(trimmed)) return null;
  return trimmed;
}

/** Publish-time URL only. Never an API key. A placeholder is treated as unset. */
export function extractionUrl(): string | null {
  const url = configuredAddress(process.env.EXPO_PUBLIC_EXTRACT_URL);
  return url ? url.replace(/\/$/, '') : null;
}

/** Inbox for the feedback screen. A placeholder stays unset so mail is not opened. */
export function feedbackEmail(): string | null {
  return configuredAddress(process.env.EXPO_PUBLIC_FEEDBACK_EMAIL);
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
