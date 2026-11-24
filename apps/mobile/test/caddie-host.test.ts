import { describe, expect, it } from 'vitest';
import { CADDIE_MAX_TOKENS, readCaddieEnv, serveCaddie } from '../src/caddie-host';

const driver = {
  clubId: 'driver',
  clubLabel: 'Driver',
  metric: 'carry',
  stockYards: 186,
  blended: false,
  dispersionKnown: false,
  p20: 170,
  p80: 200,
  sampleSize: 12,
};

const SECRET = 'desk';

function hostEnv(extra: Record<string, string> = {}) {
  return { COOPR_API_SECRET: SECRET, ...extra };
}

function turn(ip: string, secret = SECRET) {
  return new Request('https://coopr.example/v1/caddie', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, 'x-coopr-secret': secret },
    body: JSON.stringify({
      transcript: 'What should I hit?',
      context: {
        hole: 1,
        par: 5,
        atTee: true,
        gpsYards: 460,
        profiles: [driver],
        selectedClubId: 'driver',
        selectedClubLabel: 'Driver',
        persona: 'chirpy',
      },
    }),
  });
}

describe('caddie conversation host', () => {
  it('reads the server model key and ignores a public one', () => {
    const env = readCaddieEnv({
      CADDIE_LLM_API_KEY: 'server-key',
      EXPO_PUBLIC_CADDIE_LLM_API_KEY: 'public-key',
    });
    expect(env.CADDIE_LLM_API_KEY).toBe('server-key');
    expect(env.CADDIE_LLM_API_KEY).not.toBe('public-key');
  });

  it('returns a labeled sample reply when no model key is set', async () => {
    let called = false;
    const response = await serveCaddie(turn('203.0.113.40'), hostEnv(), async () => {
      called = true;
      throw new Error('no model');
    });
    expect(called).toBe(false);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"mode":"sample"');
    expect(text).toContain('Nobody\'s getting home');
    expect(text).not.toContain('460');
    expect(text).not.toContain('443');
  });

  it('stays in sample mode when a key is present and sample mode is forced', async () => {
    let called = false;
    const response = await serveCaddie(turn('203.0.113.41'), hostEnv({ CADDIE_LLM_API_KEY: 'server-key', CADDIE_MODE: 'sample' }), async () => {
      called = true;
      throw new Error('sample mode still called the model');
    });
    expect(called).toBe(false);
    const text = await response.text();
    expect(text).toContain('"mode":"sample"');
  });

  it('sends null dispersion to the model and does not invent one', async () => {
    let prompt = '';
    const response = await serveCaddie(turn('203.0.113.42'), hostEnv({ CADDIE_LLM_API_KEY: 'server-key' }), async (_url, init) => {
      prompt = String(init?.body ?? '');
      const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Driver, find the short grass.' } }] })}\n\n`;
      return new Response(chunk, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });
    const sent = JSON.parse(prompt) as { messages: { content: string }[]; max_tokens?: number };
    const context = sent.messages[0]?.content ?? '';
    expect(sent.max_tokens).toBe(CADDIE_MAX_TOKENS);
    expect(context).toContain('"dispersionYards":null');
    expect(context).not.toContain('"dispersionYards":30');
    expect(context).not.toContain('"dispersionYards":10');
    const text = await response.text();
    expect(text).toContain('"mode":"live"');
    expect(text).toContain('Driver, find the short grass.');
  });

  it('refuses a bad secret, a huge body, a foreign origin, and a spent month', async () => {
    const missing = await serveCaddie(turn('203.0.113.49'), {});
    expect(missing.status).toBe(401);
    const denied = await serveCaddie(turn('203.0.113.50', 'nope'), hostEnv());
    expect(denied.status).toBe(401);
    const huge = new Request('https://coopr.example/v1/caddie', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '40000', 'x-coopr-secret': 'desk' },
      body: '{}',
    });
    expect((await serveCaddie(huge, hostEnv())).status).toBe(413);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(40_000));
        controller.close();
      },
    });
    const streamed = new Request('https://coopr.example/v1/caddie', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coopr-secret': SECRET },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await serveCaddie(streamed, hostEnv())).status).toBe(413);
    const foreign = new Request('https://coopr.example/v1/caddie', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    const open = await serveCaddie(foreign, { ALLOWED_ORIGINS: 'https://play.coopr.app' });
    expect(open.headers.get('access-control-allow-origin')).toBeNull();
    const home = new Request('https://coopr.example/v1/caddie', { method: 'OPTIONS', headers: { origin: 'https://play.coopr.app' } });
    expect((await serveCaddie(home, { ALLOWED_ORIGINS: 'https://play.coopr.app' })).headers.get('access-control-allow-origin')).toBe('https://play.coopr.app');
    let called = false;
    const unlocked = await serveCaddie(turn('203.0.113.51'), hostEnv({ CADDIE_LLM_API_KEY: 'server-key' }), async () => {
      called = true;
      const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Seven iron.' } }] })}\n\n`;
      return new Response(chunk, { status: 200 });
    });
    expect(called).toBe(true);
    expect(await unlocked.text()).toContain('"mode":"live"');
    for (let index = 0; index < 24; index += 1) {
      const again = await serveCaddie(turn('203.0.113.51'), hostEnv({ CADDIE_LLM_API_KEY: 'server-key' }), async () => {
        const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Seven iron.' } }] })}\n\n`;
        return new Response(chunk, { status: 200 });
      });
      expect(again.status).not.toBe(429);
      await again.text();
    }
  });

  it('uses the Upstash month even when this instance has not spent anything', async () => {
    const env = hostEnv({
      CADDIE_LLM_API_KEY: 'server-key',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const over = (async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      if (body.includes('INCRBY')) return new Response(JSON.stringify([{ result: 10_002 }]), { status: 200 });
      if (body.includes('"INCR"')) return new Response(JSON.stringify([{ result: 1 }]), { status: 200 });
      throw new Error('model should not be called');
    }) as typeof fetch;
    const capped = await serveCaddie(turn('203.0.113.70'), env, over);
    expect(await capped.text()).toContain('"mode":"sample"');

    let model = false;
    const under = (async (url: string, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      if (String(url).includes('/pipeline') && body.includes('INCRBY')) return new Response(JSON.stringify([{ result: 2 }]), { status: 200 });
      if (String(url).includes('/pipeline')) return new Response(JSON.stringify([{ result: 1 }]), { status: 200 });
      model = true;
      const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Seven iron.' } }] })}\n\n`;
      return new Response(chunk, { status: 200 });
    }) as typeof fetch;
    const live = await serveCaddie(turn('203.0.113.71'), env, under);
    expect(model).toBe(true);
    const liveText = await live.text();
    expect(liveText).toContain('"mode":"live"');
    expect(liveText).toContain('Seven iron.');

    const down = (async (_url: string, init?: RequestInit) => {
      const body = String(init?.body ?? '');
      if (body.includes('INCRBY')) return new Response('no', { status: 500 });
      return new Response(JSON.stringify([{ result: 1 }]), { status: 200 });
    }) as typeof fetch;
    const refused = await serveCaddie(turn('203.0.113.72'), env, down);
    expect(await refused.text()).toContain('"mode":"sample"');
  });

  it('turns an Upstash failure into a refusal instead of a server error', async () => {
    const env = hostEnv({
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const down = (async () => {
      throw new Error('upstash down');
    }) as typeof fetch;
    const response = await serveCaddie(turn('203.0.113.90'), env, down);
    expect(response.status).toBe(429);
  });
});
