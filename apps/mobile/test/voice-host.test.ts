import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allowRequest, declaredTooLarge, isVoiceAudioType, RATE_LIMIT } from '../src/api-guard';
import { readExtractOrigin } from '../scripts/extract-origin.mjs';
import { serveExtract } from '../src/extract-host';

const repo = fileURLToPath(new URL('../../..', import.meta.url));

describe('Ask COOPR hosting guards', () => {
  it('accepts audio types and refuses the rest', () => {
    expect(isVoiceAudioType('audio/m4a')).toBe(true);
    expect(isVoiceAudioType('audio/mp4; charset=binary')).toBe(true);
    expect(isVoiceAudioType('audio/wav')).toBe(true);
    expect(isVoiceAudioType('text/plain')).toBe(false);
    expect(isVoiceAudioType('image/jpeg')).toBe(false);
    expect(isVoiceAudioType('application/octet-stream')).toBe(false);
  });

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
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.12' },
      body: JSON.stringify({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    });
    const response = await serveExtract(request, {});
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

  it('does not print the key and stops without EXPO_TOKEN', () => {
    const script = path.join(repo, 'scripts/deploy-voice.sh');
    const source = readFileSync(script, 'utf8');
    expect(source).toMatch(/eas-cli@latest deploy/);
    expect(source).toMatch(/--prod/);
    expect(source).toMatch(/--visibility sensitive/);
    expect(source).not.toMatch(/echo[^\\n]*\$ELEVENLABS_API_KEY/);
    expect(source).not.toMatch(/echo[^\\n]*\$key/);
    expect(source).not.toMatch(/EXPO_PUBLIC_ELEVENLABS/);
    const result = spawnSync('bash', [script], {
      env: { ...process.env, EXPO_TOKEN: '', ELEVENLABS_API_KEY: 'super-secret-value' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/EXPO_TOKEN is not set/);
    expect(`${result.stdout}${result.stderr}`).not.toContain('super-secret-value');
  });

  it('verify-voice prints usage without posting', () => {
    const result = spawnSync('bash', [path.join(repo, 'scripts/verify-voice.sh')], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Usage: scripts\/verify-voice\.sh/);
  });
});
