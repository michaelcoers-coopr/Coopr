import {
  buildTalkContext,
  sampleTalkReply,
  talkPromptView,
  talkToolSpecs,
  runTalkTool,
  talkSentences,
  type TalkContext,
  type TalkReply,
  type TalkToolResult,
} from '@coopr/engine';
import { bodyTooLarge, budgetMonth, CADDIE_TURN_CENTS, clientIp, corsHeaders, MAX_CADDIE_BYTES, MONTHLY_BUDGET_CENTS, readBounded, SECRET_HEADER, secretOk, upstashAllow, upstashCharge } from './api-guard';

/** A spoken answer is one or two sentences. The model cannot run on. */
export const CADDIE_MAX_TOKENS = 120;

export interface CaddieEnv {
  CADDIE_LLM_API_KEY?: string;
  CADDIE_LLM_URL?: string;
  CADDIE_LLM_MODEL?: string;
  CADDIE_MODE?: string;
  COOPR_API_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export function readCaddieEnv(env: Record<string, string | undefined> = process.env): CaddieEnv {
  return {
    CADDIE_LLM_API_KEY: env.CADDIE_LLM_API_KEY,
    CADDIE_LLM_URL: env.CADDIE_LLM_URL,
    CADDIE_LLM_MODEL: env.CADDIE_LLM_MODEL,
    CADDIE_MODE: env.CADDIE_MODE,
    COOPR_API_SECRET: env.COOPR_API_SECRET,
    ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

function headersFor(request: Request, env: CaddieEnv, contentType: string): Record<string, string> {
  return { 'content-type': contentType, ...corsHeaders(request.headers.get('origin'), env.ALLOWED_ORIGINS) };
}

function json(request: Request, env: CaddieEnv, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: headersFor(request, env, 'application/json') });
}

function sse(request: Request, env: CaddieEnv, chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: headersFor(request, env, 'text/event-stream') });
}

function event(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function replyEvents(reply: TalkReply): string[] {
  const chunks = [event({ type: 'mode', mode: reply.mode, sample: reply.mode === 'sample' })];
  for (const sentence of reply.sentences) chunks.push(event({ type: 'delta', text: sentence }));
  for (const tool of reply.tools) {
    chunks.push(event({ type: 'tool', name: tool.name, ok: tool.ok, data: tool.data, action: tool.action }));
  }
  chunks.push(event({ type: 'done', mode: reply.mode, line: reply.line, actions: reply.tools.flatMap((tool) => (tool.action ? [tool.action] : [])) }));
  return chunks;
}

function contextFrom(body: Record<string, unknown>): TalkContext {
  const posted = body.context;
  const record = typeof posted === 'object' && posted != null ? (posted as Record<string, unknown>) : {};
  const profiles = Array.isArray(record.profiles) ? record.profiles : [];
  return buildTalkContext({
    hole: typeof record.hole === 'number' ? record.hole : 0,
    par: typeof record.par === 'number' ? record.par : null,
    atTee: record.atTee === true,
    gpsYards: typeof record.gpsYards === 'number' ? record.gpsYards : null,
    frontYards: typeof record.frontYards === 'number' ? record.frontYards : null,
    backYards: typeof record.backYards === 'number' ? record.backYards : null,
    headwindMph: typeof record.headwindMph === 'number' ? record.headwindMph : null,
    elevationFeet: typeof record.elevationFeet === 'number' ? record.elevationFeet : null,
    temperatureF: typeof record.temperatureF === 'number' ? record.temperatureF : null,
    windMph: typeof record.windMph === 'number' ? record.windMph : null,
    profiles: profiles as TalkContext['profiles'],
    selectedClubId: typeof record.selectedClubId === 'string' ? record.selectedClubId : null,
    selectedClubLabel: typeof record.selectedClubLabel === 'string' ? record.selectedClubLabel : null,
    scoreStrokes: typeof record.scoreStrokes === 'number' ? record.scoreStrokes : null,
    scorePutts: typeof record.scorePutts === 'number' ? record.scorePutts : null,
    thruLabel: typeof record.thruLabel === 'string' ? record.thruLabel : null,
    persona: record.persona === 'chill' ? 'chill' : 'chirpy',
    turns: Array.isArray(record.turns) ? (record.turns as TalkContext['turns']) : [],
    cardLine: typeof record.cardLine === 'string' ? record.cardLine : null,
  });
}

interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}

async function liveReply(transcript: string, context: TalkContext, env: CaddieEnv, fetchImpl: typeof fetch): Promise<TalkReply> {
  const url = env.CADDIE_LLM_URL || 'https://api.openai.com/v1/chat/completions';
  const model = env.CADDIE_LLM_MODEL || 'gpt-4o-mini';
  const view = talkPromptView(context);
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content: [
        'You are the COOPR caddie on a phone. Speak one or two short sentences.',
        context.persona === 'chill' ? 'Voice: Chill. Quiet, no slang.' : 'Voice: Chirpy. Loose, still only real numbers.',
        'Null means unknown. Never invent a yardage, a dispersion, a wind, or a club.',
        'Use a tool for plays-like, a club call, a score, a club change, or a marked shot.',
        `Context: ${JSON.stringify(view)}`,
      ].join(' '),
    },
    ...context.turns.map((turn) => ({ role: turn.role === 'player' ? ('user' as const) : ('assistant' as const), content: turn.text })),
    { role: 'user', content: transcript },
  ];
  const tools = talkToolSpecs().map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
  const ran: TalkToolResult[] = [];
  let spoken = '';
  for (let round = 0; round < 3; round += 1) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CADDIE_LLM_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, stream: true, max_tokens: CADDIE_MAX_TOKENS }),
    });
    if (!response.ok || !response.body) throw new Error('model');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const calls = new Map<number, { id: string; name: string; arguments: string }>();
    const take = (block: string) => {
      const line = block.split('\n').find((item) => item.startsWith('data:'));
      if (!line) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      const parsed = JSON.parse(data) as {
        choices?: { delta?: { content?: string; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
      };
      const delta = parsed.choices?.[0]?.delta;
      if (delta?.content) content += delta.content;
      for (const call of delta?.tool_calls ?? []) {
        const current = calls.get(call.index) ?? { id: '', name: '', arguments: '' };
        if (call.id) current.id = call.id;
        if (call.function?.name) current.name += call.function.name;
        if (call.function?.arguments) current.arguments += call.function.arguments;
        calls.set(call.index, current);
      }
    };
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      buffer += decoder.decode(step.value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) take(block);
    }
    if (buffer.trim()) take(buffer);
    if (calls.size === 0) {
      spoken = content.trim();
      break;
    }
    messages.push({
      role: 'assistant',
      content: content,
      tool_calls: [...calls.values()].map((call) => ({ id: call.id || call.name, type: 'function', function: { name: call.name, arguments: call.arguments } })),
    });
    for (const call of calls.values()) {
      let args: unknown = {};
      try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        args = {};
      }
      const result = runTalkTool(call.name, args, context);
      ran.push(result);
      messages.push({ role: 'tool', tool_call_id: call.id || call.name, content: JSON.stringify({ ok: result.ok, data: result.data, line: result.line }) });
    }
  }
  const line = spoken || ran.map((tool) => tool.line).filter(Boolean).join(' ');
  if (!line) throw new Error('empty');
  return { mode: 'live', line, sentences: talkSentences(line), tools: ran, heard: true };
}

async function rateOk(request: Request, env: CaddieEnv, fetchImpl: typeof fetch): Promise<boolean> {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  return upstashAllow(fetchImpl, url, token, `caddie:${clientIp(request)}`, 20);
}

async function chargeTurn(env: CaddieEnv, fetchImpl: typeof fetch, now = new Date()): Promise<boolean> {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  return upstashCharge(fetchImpl, url, token, `caddie-budget:${budgetMonth(now)}`, CADDIE_TURN_CENTS, MONTHLY_BUDGET_CENTS);
}

export async function serveCaddie(request: Request, env: CaddieEnv = readCaddieEnv(), fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request, env, 'text/plain') });
  if (request.method !== 'POST') return json(request, env, 405, { error: 'POST the turn.' });
  if (!secretOk(request.headers.get(SECRET_HEADER), env.COOPR_API_SECRET)) {
    return json(request, env, 401, { error: 'The caddie secret did not match.' });
  }
  if (bodyTooLarge(request, MAX_CADDIE_BYTES)) return json(request, env, 413, { error: 'The turn is too large.' });
  if (!(await rateOk(request, env, fetchImpl))) {
    return json(request, env, 429, { error: 'Too many questions. Wait a minute.' });
  }
  let body: Record<string, unknown>;
  try {
    const bytes = await readBounded(request, MAX_CADDIE_BYTES);
    if (!bytes) return json(request, env, 413, { error: 'The turn is too large.' });
    const raw = new TextDecoder().decode(bytes);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    body = typeof parsed === 'object' && parsed != null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return json(request, env, 400, { error: 'The turn was not JSON.' });
  }
  const transcript = typeof body.transcript === 'string' ? body.transcript.slice(0, 500) : '';
  const context = contextFrom(body);
  const sample = !env.CADDIE_LLM_API_KEY || env.CADDIE_MODE === 'sample' || !(await chargeTurn(env, fetchImpl));
  if (sample) return sse(request, env, replyEvents(await sampleTalkReply(context, transcript)));
  try {
    return sse(request, env, replyEvents(await liveReply(transcript, context, env, fetchImpl)));
  } catch {
    const fallback = await sampleTalkReply(context, transcript);
    return sse(request, env, replyEvents(fallback));
  }
}
