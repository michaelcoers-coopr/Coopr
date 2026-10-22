import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const easPath = path.join(root, 'eas.json');
const scriptPath = path.join(root, 'scripts', 'preview-publish.mjs');
const configure = require('../app.config.js') as (ctx: { config: Record<string, unknown> }) => {
  name?: string;
  runtimeVersion?: { policy?: string };
  ios?: { bundleIdentifier?: string; infoPlist?: { ITSAppUsesNonExemptEncryption?: boolean } };
  android?: { package?: string };
  updates?: { url?: string; enabled?: boolean };
  extra?: { eas?: { projectId?: string } };
};

const appJson = require('../app.json') as { expo: Record<string, unknown> };
const mobilePackage = require('../package.json') as { dependencies: Record<string, string> };
const rootPackage = JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8')) as {
  dependencies?: Record<string, string>;
  scripts: Record<string, string>;
};

describe('Expo Go preview and TestFlight profile', () => {
  it('matches App Store Expo Go SDK 58 and does not add a dev client', () => {
    expect(mobilePackage.dependencies.expo).toMatch(/^[\^~]58\./);
    expect(mobilePackage.dependencies.react).toBe('19.3.0');
    expect(mobilePackage.dependencies['react-native']).toBe('0.88.0');
    expect(mobilePackage.dependencies['expo-sqlite']).toMatch(/^~58\./);
    expect(mobilePackage.dependencies['expo-router']).toMatch(/^~58\./);
    expect(mobilePackage.dependencies['expo-dev-client']).toBeUndefined();
    expect(rootPackage.dependencies?.['expo-dev-client']).toBeUndefined();
    expect(rootPackage.scripts['preview:publish']).toBe('npm run preview:publish -w @coopr/mobile');
  });

  it('uses a distinct preview bundle id and keeps founder tools off the production profile', () => {
    const previous = process.env.APP_VARIANT;
    const previousProject = process.env.EXPO_PROJECT_ID;
    process.env.APP_VARIANT = 'preview';
    process.env.EXPO_PROJECT_ID = '11111111-1111-1111-1111-111111111111';
    const preview = configure({ config: appJson.expo });
    process.env.APP_VARIANT = 'production';
    const production = configure({ config: appJson.expo });
    process.env.APP_VARIANT = previous;
    if (previousProject === undefined) delete process.env.EXPO_PROJECT_ID;
    else process.env.EXPO_PROJECT_ID = previousProject;

    expect(preview.name).toBe('COOPR Preview');
    expect(preview.ios?.bundleIdentifier).toBe('app.coopr.mobile.preview');
    expect(preview.android?.package).toBe('app.coopr.mobile.preview');
    expect(preview.runtimeVersion).toEqual({ policy: 'sdkVersion' });
    expect(preview.updates?.url).toBe('https://u.expo.dev/11111111-1111-1111-1111-111111111111');
    expect(preview.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(production.ios?.bundleIdentifier).toBe('app.coopr.mobile');
    expect(production.name).toBe('COOPR');

    const staticConfig = appJson.expo as {
      owner?: string;
      updates?: { url?: string };
      extra?: { eas?: { projectId?: string } };
    };
    expect(staticConfig.owner).toBe('mikecoers');
    expect(staticConfig.extra?.eas?.projectId).toBe('998f1644-05ec-4980-a0b9-58e5703951d7');
    expect(staticConfig.updates?.url).toBe('https://u.expo.dev/998f1644-05ec-4980-a0b9-58e5703951d7');
    delete process.env.EXPO_PROJECT_ID;
    delete process.env.APP_VARIANT;
    const linked = configure({ config: appJson.expo });
    expect(linked.extra?.eas?.projectId).toBe('998f1644-05ec-4980-a0b9-58e5703951d7');
    expect(linked.updates?.url).toBe('https://u.expo.dev/998f1644-05ec-4980-a0b9-58e5703951d7');
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
    if (previousProject === undefined) delete process.env.EXPO_PROJECT_ID;
    else process.env.EXPO_PROJECT_ID = previousProject;

    const eas = JSON.parse(readFileSync(easPath, 'utf8')) as {
      build: {
        preview: { distribution: string; channel: string; env: Record<string, string> };
        production: { distribution: string; channel: string; env: Record<string, string> };
      };
    };
    expect(eas.build.preview).toMatchObject({
      distribution: 'store',
      channel: 'preview',
      env: { APP_VARIANT: 'preview', EXPO_PUBLIC_FOUNDER_TOOLS: '1' },
    });
    expect(eas.build.production.env.EXPO_PUBLIC_FOUNDER_TOOLS).toBe('0');
    expect(eas.build.production.channel).toBe('production');
  });

  it('refuses to publish without EXPO_TOKEN and does not embed one', () => {
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toMatch(/EXPO_PUBLIC_FOUNDER_TOOLS: '1'/);
    expect(source).toMatch(/exposdk:58\.0\.0/);
    expect(source).not.toMatch(/EXPO_TOKEN\s*=\s*['"][A-Za-z0-9]{8,}/);
    const result = spawnSync(process.execPath, [scriptPath], {
      env: { ...process.env, EXPO_TOKEN: '' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/EXPO_TOKEN is not set/);
    expect(result.stderr).toMatch(/preview:publish/);
  });
});
