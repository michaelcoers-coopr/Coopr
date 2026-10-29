import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allowRequest, declaredTooLarge, RATE_LIMIT } from '../src/api-guard';
import { readExtractOrigin } from '../scripts/extract-origin.mjs';
import { serveExtract } from '../src/extract-host';

const repo = fileURLToPath(new URL('../../..', import.meta.url));

describe('Ask COOPR hosting guards', () => {
  it('stops the 21st call inside a minute', () => {
    const store = new Map<string, number[]>();
    for (let index = 0; index < RATE_LIMIT; index += 1) {
      expect(allowRequest('10.0.0.8', store, 1_000, RATE_LIMIT, 60_000)).toBe(true);
    }
    expect(allowRequest('10.0.0.8', store, 1_000, RATE_LIMIT, 60_000)).toBe(false);
    expect(allowRequest('10.0.0.9', store, 1_000, RATE_LIMIT, 60_000)).toBe(true);
    expect(allowRequest('10.0.0.8', store, 61_001, RATE_LIMIT, 60_000)).toBe(true);
  });

  it('refuses an oversized content length before reading a body', () => {
    const request = new Request('https://coopr.example/v1/voice', {
      method: 'POST',
      headers: { 'content-length': String(9 * 1024 * 1024), 'content-type': 'audio/m4a' },
    });
    expect(declaredTooLarge(request)).toBe(true);
  });

  it('answers a photo extract without a vision key', async () => {
    const request = new Request('https://coopr.example/v1/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.12', 'x-coopr-secret': 'desk' },
      body: JSON.stringify({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    });
    const response = await serveExtract(request, { COOPR_API_SECRET: 'desk' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode?: string; readFromImage?: boolean; imageRetained?: boolean };
    expect(body.mode).toBe('stub');
    expect(body.readFromImage).toBe(false);
    expect(body.imageRetained).toBe(false);
  });
});

describe('deploy and preview scripts', () => {
  it('reads the extract origin from the env, then from the file', () => {
    expect(readExtractOrigin({ env: { EXPO_PUBLIC_EXTRACT_URL: 'https://coopr.expo.app/v1/voice' }, fileText: 'https://other.expo.app' })).toBe(
      'https://coopr.expo.app',
    );
    expect(readExtractOrigin({ env: {}, fileText: '# note\nhttps://coopr.expo.app\n' })).toBe('https://coopr.expo.app');
    expect(readExtractOrigin({ env: {}, fileText: '# not yet\n' })).toBeNull();
    expect(() => readExtractOrigin({ env: { EXPO_PUBLIC_EXTRACT_URL: 'http://coopr.expo.app' }, fileText: '' })).toThrow(/https/);
  });

  it('parses the production origin from eas deploy JSON', () => {
    const script = path.join(repo, 'scripts/deploy-origin.mjs');
    const result = spawnSync(process.execPath, [script], {
      input: 'noise\n{"url":"https://coopr--abc.expo.app","production":{"url":"https://coopr.expo.app/path"}}\n',
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('https://coopr.expo.app');
  });

  it('documents the caddie server and no longer ships the voice deploy scripts', () => {
    const doc = readFileSync(path.join(repo, 'docs/CADDIE_SERVER.md'), 'utf8');
    expect(doc).toContain('COOPR_API_SECRET');
    expect(doc).toContain('UPSTASH_REDIS_REST_URL');
    expect(doc).toContain('ALLOWED_ORIGINS');
    expect(doc).toContain('100');
    expect(doc).toContain('EXPO_PUBLIC_EXTRACT_URL');
    expect(doc).toContain('EXPO_PUBLIC_CADDIE_SECRET');
    expect(doc).not.toContain('deploy-voice.sh');
    expect(doc).toMatch(/do not deploy|Do not deploy/i);
    expect(doc).toContain('scripts/deploy-caddie.sh');
    expect(doc).toContain('caddie-budget:');
    expect(existsSync(path.join(repo, 'scripts/deploy-voice.sh'))).toBe(false);
    expect(existsSync(path.join(repo, 'scripts/verify-voice.sh'))).toBe(false);
    expect(existsSync(path.join(repo, 'apps/mobile/app/v1/voice+api.ts'))).toBe(false);
  });

  it('stops the caddie deploy script without EXPO_TOKEN and does not print a secret', () => {
    const script = path.join(repo, 'scripts/deploy-caddie.sh');
    const source = readFileSync(script, 'utf8');
    expect(source).toContain('eas-cli@latest env:set');
    expect(source).toContain('deploy --prod');
    expect(source).toContain('deploy-origin.mjs');
    expect(source).not.toContain('deploy-voice.sh');
    expect(source).not.toMatch(/echo .*(COOPR_API_SECRET|CADDIE_LLM_API_KEY|UPSTASH_REDIS_REST_TOKEN)/);
    const secret = 'super-secret-not-for-logs';
    const result = spawnSync('bash', [script], {
      env: { ...process.env, EXPO_TOKEN: '', COOPR_API_SECRET: secret, CADDIE_LLM_API_KEY: secret },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
    expect(result.stderr).toMatch(/EXPO_TOKEN is required/);
  });
});
