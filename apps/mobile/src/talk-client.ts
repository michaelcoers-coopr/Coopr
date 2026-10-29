import { sampleTalkReply, type TalkAction, type TalkContext, type TalkReply, type TalkToolResult } from '@coopr/engine';
import { SECRET_HEADER } from './api-guard';
import { extractionUrl } from './extract-client';

/** Marked stand-in in the beta profile until Mike puts the same string as COOPR_API_SECRET here. */
export const CADDIE_SECRET_PLACEHOLDER = 'REPLACE-WITH-CADDIE-SECRET';

function caddieSecret(): string | null {
  const value = process.env.EXPO_PUBLIC_CADDIE_SECRET?.trim();
  if (!value || value.includes('REPLACE')) return null;
  return value;
}

/** Shown whenever the reply is the on-phone script, including when no server is set. */
export const SAMPLE_ANSWER_LABEL = 'Sample answer. Not from a live caddie.';

function parseStream(text: string): TalkReply | null {
  let mode: TalkReply['mode'] = 'sample';
  const sentences: string[] = [];
  const tools: TalkToolResult[] = [];
  let line = '';
  for (const block of text.split('\n\n')) {
    const row = block.split('\n').find((item) => item.startsWith('data:'));
    if (!row) continue;
    let payload: { type?: string; mode?: string; text?: string; line?: string; name?: string; ok?: boolean; data?: Record<string, unknown>; action?: TalkAction | null };
    try {
      payload = JSON.parse(row.slice(5).trim()) as typeof payload;
    } catch {
      continue;
    }
    if (payload.type === 'mode' && (payload.mode === 'live' || payload.mode === 'sample')) mode = payload.mode;
    if (payload.type === 'delta' && payload.text) sentences.push(payload.text);
    if (payload.type === 'tool' && payload.name) {
      tools.push({
        name: payload.name,
        ok: payload.ok === true,
        data: payload.data ?? {},
        action: payload.action ?? null,
        line: '',
      });
    }
    if (payload.type === 'done' && payload.line) line = payload.line;
  }
  if (!line && sentences.length === 0) return null;
  return { mode, line: line || sentences.join(' '), sentences: sentences.length > 0 ? sentences : [line], tools, heard: mode === 'live' };
}

/** The hosted caddie when EXPO_PUBLIC_EXTRACT_URL is a real origin. Otherwise a labeled sample. */
export async function requestTalk(transcript: string, context: TalkContext): Promise<TalkReply> {
  const base = extractionUrl();
  if (!base) return sampleTalkReply(context, transcript);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const secret = caddieSecret();
    if (secret) headers[SECRET_HEADER] = secret;
    const response = await fetch(`${base}/v1/caddie`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transcript, context }),
    });
    if (!response.ok) return sampleTalkReply(context, transcript);
    const text = await response.text();
    return parseStream(text) ?? sampleTalkReply(context, transcript);
  } catch {
    return sampleTalkReply(context, transcript);
  }
}
