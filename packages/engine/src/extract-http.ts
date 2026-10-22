import { parsePhotoExtraction, SAMPLE_PHOTO_PAYLOAD, type PhotoExtraction } from './photo-import';

export const EXTRACT_PROMPT = `You extract golf numbers from one photo. Return one JSON object and nothing else.
Use null for any field you cannot read. Do not guess, round from memory, or copy one number into another field.
kind is launch_monitor, external_app, scorecard, clubs, or unknown.
sourceApp is the name printed on the screen, or null.
capturedOn is YYYY-MM-DD only when a full date is printed, otherwise null.
shots are individual launch-monitor rows. carry and total are different. Leave the one that is not labeled null. side is yards, positive to the right, or null.
reported is a club average from another golf app. metric is carry, total, or ambiguous when the screen does not say which. sampleSize is the printed count, or null.
holes use hole 1-18. par, strokeIndex, yardage, and strokes are null when not printed. Do not turn a blank score into 0.
clubs use brand, model, loft, and shaft. Each has a matching confidence of high, low, or unreadable.
If a value is unreadable, confidence is unreadable and the value is null.
Do not include the image, a person, or any field you were not asked for.`;

export interface ExtractEnv {
  EXTRACT_MODE?: string;
  EXTRACT_TOKEN?: string;
  COOPR_VISION_API_KEY?: string;
  COOPR_VISION_BASE_URL?: string;
  COOPR_VISION_MODEL?: string;
}

export interface ExtractHttpResult {
  status: number;
  body: PhotoExtraction | { error: string; imageRetained: false };
}

type VisionFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function stubExtraction(): PhotoExtraction {
  const parsed = parsePhotoExtraction(SAMPLE_PHOTO_PAYLOAD, 'stub');
  if ('error' in parsed) throw new Error(parsed.error);
  parsed.notes = ['Stub mode. The photo was discarded and was not read. These rows are a sample, not your picture.'];
  parsed.readFromImage = false;
  parsed.imageRetained = false;
  return parsed;
}

function tokenOk(header: string | null, env: ExtractEnv): boolean {
  if (!env.EXTRACT_TOKEN) return true;
  return header === `Bearer ${env.EXTRACT_TOKEN}`;
}

export async function handleExtractRequest(input: {
  authorization: string | null;
  payload: unknown;
  env: ExtractEnv;
  fetchImpl?: VisionFetch;
}): Promise<ExtractHttpResult> {
  if (!tokenOk(input.authorization, input.env)) {
    return { status: 401, body: { error: 'The extraction token does not match.', imageRetained: false } };
  }
  const record = typeof input.payload === 'object' && input.payload !== null ? (input.payload as Record<string, unknown>) : null;
  const imageBase64 = typeof record?.imageBase64 === 'string' ? record.imageBase64 : '';
  const mediaType = typeof record?.mediaType === 'string' ? record.mediaType : 'image/jpeg';
  const live = input.env.EXTRACT_MODE === 'live' && Boolean(input.env.COOPR_VISION_API_KEY);
  if (!live) return { status: 200, body: stubExtraction() };

  const fetchImpl = input.fetchImpl ?? (typeof fetch === 'function' ? (fetch as unknown as VisionFetch) : undefined);
  if (!fetchImpl) return { status: 500, body: { error: 'Live extraction has no HTTP client.', imageRetained: false } };
  const base = (input.env.COOPR_VISION_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = input.env.COOPR_VISION_MODEL || 'gpt-4o-mini';
  let response: { ok: boolean; status: number; json: () => Promise<unknown> };
  try {
    response = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.env.COOPR_VISION_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACT_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });
  } catch {
    return { status: 502, body: { error: 'The vision service could not be reached. The photo was not kept.', imageRetained: false } };
  }
  if (!response.ok) {
    return { status: 502, body: { error: `The vision service returned ${response.status}. The photo was not kept.`, imageRetained: false } };
  }
  const raw = await response.json();
  const content = readMessageContent(raw);
  if (!content) return { status: 502, body: { error: 'The vision service returned no JSON. Nothing was invented.', imageRetained: false } };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return { status: 502, body: { error: 'The vision service did not return JSON. Nothing was invented.', imageRetained: false } };
  }
  const extraction = parsePhotoExtraction(parsedJson, 'live');
  if ('error' in extraction) return { status: 422, body: { error: extraction.error, imageRetained: false } };
  extraction.readFromImage = true;
  extraction.imageRetained = false;
  extraction.mode = 'live';
  return { status: 200, body: extraction };
}

function readMessageContent(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === 'string' ? message.content : null;
}

/** Reads a JSON body, answers, and wipes the image bytes. */
export async function handleExtractBuffer(body: Uint8Array, authorization: string | null, env: ExtractEnv, fetchImpl?: VisionFetch): Promise<ExtractHttpResult> {
  let payload: unknown = null;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    body.fill(0);
    return { status: 400, body: { error: 'The request was not JSON.', imageRetained: false } };
  }
  const result = await handleExtractRequest({ authorization, payload, env, fetchImpl });
  body.fill(0);
  const serialized = JSON.stringify(result.body);
  if (typeof payload === 'object' && payload && typeof (payload as { imageBase64?: unknown }).imageBase64 === 'string') {
    const secret = (payload as { imageBase64: string }).imageBase64;
    if (secret && serialized.includes(secret)) {
      return { status: 500, body: { error: 'Refusing to return the image.', imageRetained: false } };
    }
  }
  return result;
}
