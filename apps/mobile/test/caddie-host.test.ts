import { describe, expect, it } from 'vitest';
import { readCaddieEnv, resetCaddieBudget, serveCaddie, setCaddieSpendForTests } from '../src/caddie-host';

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

function turn(ip: string) {
  return new Request('https://coopr.example/v1/caddie', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
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
    const response = await serveCaddie(turn('203.0.113.40'), {}, async () => {
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
    const response = await serveCaddie(turn('203.0.113.41'), { CADDIE_LLM_API_KEY: 'server-key', CADDIE_MODE: 'sample' }, async () => {
      called = true;
      throw new Error('sample mode still called the model');
    });
    expect(called).toBe(false);
    const text = await response.text();
    expect(text).toContain('"mode":"sample"');
  });

  it('sends null dispersion to the model and does not invent one', async () => {
    let prompt = '';
    const response = await serveCaddie(turn('203.0.113.42'), { CADDIE_LLM_API_KEY: 'server-key' }, async (_url, init) => {
      prompt = String(init?.body ?? '');
      const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Driver, find the short grass.' } }] })}\n\n`;
      return new Response(chunk, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    });
    const sent = JSON.parse(prompt) as { messages: { content: string }[] };
    const context = sent.messages[0]?.content ?? '';
    expect(context).toContain('"dispersionYards":null');
    expect(context).not.toContain('"dispersionYards":30');
    expect(context).not.toContain('"dispersionYards":10');
    const text = await response.text();
    expect(text).toContain('"mode":"live"');
    expect(text).toContain('Driver, find the short grass.');
  });

  it('refuses a bad secret, a huge body, a foreign origin, and a spent month', async () => {
    const denied = await serveCaddie(turn('203.0.113.50'), { COOPR_API_SECRET: 'desk' });
    expect(denied.status).toBe(401);
    const huge = new Request('https://coopr.example/v1/caddie', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '40000', 'x-coopr-secret': 'desk' },
      body: '{}',
    });
    expect((await serveCaddie(huge, { COOPR_API_SECRET: 'desk' })).status).toBe(413);
    const foreign = new Request('https://coopr.example/v1/caddie', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    const open = await serveCaddie(foreign, { ALLOWED_ORIGINS: 'https://play.coopr.app' });
    expect(open.headers.get('access-control-allow-origin')).toBeNull();
    const home = new Request('https://coopr.example/v1/caddie', { method: 'OPTIONS', headers: { origin: 'https://play.coopr.app' } });
    expect((await serveCaddie(home, { ALLOWED_ORIGINS: 'https://play.coopr.app' })).headers.get('access-control-allow-origin')).toBe('https://play.coopr.app');
    setCaddieSpendForTests(10_000);
    let called = false;
    const capped = await serveCaddie(turn('203.0.113.51'), { CADDIE_LLM_API_KEY: 'server-key' }, async () => {
      called = true;
      throw new Error('over budget');
    });
    expect(called).toBe(false);
    expect(await capped.text()).toContain('"mode":"sample"');
    resetCaddieBudget();
  });
});
