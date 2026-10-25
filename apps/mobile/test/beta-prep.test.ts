import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTalkContext } from '@coopr/engine';
import { describe, expect, it } from 'vitest';
import { EXTRACT_URL_PLACEHOLDER, FEEDBACK_EMAIL_PLACEHOLDER, configuredAddress, extractionUrl, feedbackEmail } from '../src/extract-client';
import { feedbackBody, feedbackMailto } from '../src/feedback-note';
import { rememberScreen, rememberedScreen } from '../src/screen-name';
import { requestTalk, SAMPLE_ANSWER_LABEL } from '../src/talk-client';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');

describe('beta profile and permission strings', () => {
  it('keeps preview as it was and ships founder tools off on beta', () => {
    const eas = JSON.parse(read('../eas.json')) as {
      build: {
        preview: { channel: string; env: Record<string, string> };
        production: { env: Record<string, string> };
        beta: { distribution: string; channel: string; env: Record<string, string>; ios: { simulator: boolean } };
      };
      submit: { beta: { ios: Record<string, never> } };
    };
    expect(eas.build.preview.env).toEqual({ APP_VARIANT: 'preview', EXPO_PUBLIC_FOUNDER_TOOLS: '1' });
    expect(eas.build.preview.channel).toBe('preview');
    expect(eas.build.production.env).toEqual({ APP_VARIANT: 'production', EXPO_PUBLIC_FOUNDER_TOOLS: '0' });
    expect(eas.build.beta).toMatchObject({
      distribution: 'store',
      channel: 'beta',
      ios: { simulator: false },
    });
    expect(eas.build.beta.env).toEqual({
      APP_VARIANT: 'production',
      EXPO_PUBLIC_FOUNDER_TOOLS: '0',
      EXPO_PUBLIC_EXTRACT_URL: EXTRACT_URL_PLACEHOLDER,
      EXPO_PUBLIC_FEEDBACK_EMAIL: FEEDBACK_EMAIL_PLACEHOLDER,
    });
    expect(eas.submit.beta).toEqual({ ios: {} });
    expect(EXTRACT_URL_PLACEHOLDER).toContain('REPLACE');
    expect(FEEDBACK_EMAIL_PLACEHOLDER).toContain('REPLACE');
  });

  it('describes on-device speech and drops Always, motion, and background audio', () => {
    const app = JSON.parse(read('../app.json')) as { expo: { icon?: string; plugins: unknown[] } };
    expect(app.expo.icon).toBe('./assets/brand/icon.png');
    const plugins = app.expo.plugins;
    const speech = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-speech-recognition') as [string, Record<string, string>];
    const audio = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-audio') as [string, Record<string, unknown>];
    const location = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location') as [string, Record<string, unknown>];
    expect(speech[1].microphonePermission).toBe(
      'COOPR listens while you hold Ask, or while hands-free is on. On this iPhone, speech is turned into text on the device and the audio is not kept.',
    );
    expect(speech[1].speechRecognitionPermission).toBe('COOPR turns your question into text on this iPhone. The audio is not kept.');
    expect(audio[1].microphonePermission).toBe(speech[1].microphonePermission);
    expect(audio[1].enableBackgroundPlayback).toBe(false);
    expect(audio[1].enableBackgroundRecording).toBe(false);
    expect(location[1].locationWhenInUsePermission).toBe(
      'COOPR uses your location while the app is open to show your distance to the green. Your position is not saved as a shot.',
    );
    expect(location[1].locationAlwaysAndWhenInUsePermission).toBe(false);
    expect(location[1].locationAlwaysPermission).toBe(false);
    expect(location[1].motionUsagePermission).toBe(false);
    expect(JSON.stringify(app)).not.toContain('goes to the server to be transcribed');
    expect(JSON.stringify(app)).not.toContain('UIBackgroundModes');
  });
});

describe('on-device voice and labeled samples', () => {
  it('requires on-device recognition and no longer posts audio', () => {
    const recognize = read('../src/speech/recognize.ts');
    expect(recognize).toContain('supportsOnDeviceRecognition()');
    expect(recognize).toContain('requiresOnDeviceRecognition: true');
    expect(recognize.indexOf('supportsOnDeviceRecognition()')).toBeLessThan(recognize.indexOf('speech.start('));
    const ask = read('../src/ask-coopr.tsx');
    expect(ask).not.toContain('useAudioRecorder');
    expect(ask).not.toContain('requestTranscript');
    expect(ask).not.toContain('audioUriToBase64');
    expect(ask).not.toContain('/v1/voice');
    expect(ask).toContain('onAsk?.()');
    expect(existsSync(join(here, '../src/voice-client.ts'))).toBe(false);
  });

  it('uses the hosted origin and labels a sample when that origin is unset', async () => {
    const previousExtract = process.env.EXPO_PUBLIC_EXTRACT_URL;
    const previousMail = process.env.EXPO_PUBLIC_FEEDBACK_EMAIL;
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response('not json', { status: 500 });
    }) as typeof fetch;
    try {
      delete process.env.EXPO_PUBLIC_EXTRACT_URL;
      delete process.env.EXPO_PUBLIC_FEEDBACK_EMAIL;
      expect(extractionUrl()).toBeNull();
      expect(feedbackEmail()).toBeNull();
      const context = buildTalkContext({ hole: 1, par: 4, gpsYards: null, profiles: [] });
      const quiet = await requestTalk('How far is it?', context);
      expect(quiet.mode).toBe('sample');
      expect(calls).toEqual([]);
      process.env.EXPO_PUBLIC_EXTRACT_URL = EXTRACT_URL_PLACEHOLDER;
      process.env.EXPO_PUBLIC_FEEDBACK_EMAIL = FEEDBACK_EMAIL_PLACEHOLDER;
      expect(configuredAddress(EXTRACT_URL_PLACEHOLDER)).toBeNull();
      expect(extractionUrl()).toBeNull();
      expect(feedbackEmail()).toBeNull();
      const placeholder = await requestTalk('How far is it?', context);
      expect(placeholder.mode).toBe('sample');
      expect(calls).toEqual([]);
      process.env.EXPO_PUBLIC_EXTRACT_URL = 'https://caddie.example';
      await requestTalk('How far is it?', context);
      expect(calls).toEqual(['https://caddie.example/v1/caddie']);
    } finally {
      globalThis.fetch = original;
      if (previousExtract === undefined) delete process.env.EXPO_PUBLIC_EXTRACT_URL;
      else process.env.EXPO_PUBLIC_EXTRACT_URL = previousExtract;
      if (previousMail === undefined) delete process.env.EXPO_PUBLIC_FEEDBACK_EMAIL;
      else process.env.EXPO_PUBLIC_FEEDBACK_EMAIL = previousMail;
    }
    expect(SAMPLE_ANSWER_LABEL).toMatch(/^Sample answer/);
    const play = read('../app/play.tsx');
    const home = read('../app/index.tsx');
    const overlay = read('../src/talk-overlay.tsx');
    expect(play).toContain('SAMPLE_ANSWER_LABEL');
    expect(home).toContain('SAMPLE_ANSWER_LABEL');
    expect(overlay).toContain('SAMPLE_ANSWER_LABEL');
    expect(read('../src/talk-client.ts')).not.toContain("fetch('/v1/caddie'");
  });
});

describe('feedback, privacy, and a founder-off first run', () => {
  it('shows the note before mail and leaves out location', () => {
    rememberScreen('play');
    rememberScreen('feedback');
    expect(rememberedScreen()).toBe('play');
    const body = feedbackBody({
      category: 'Wrong data',
      note: 'Hole 3 yardage looked short',
      contact: '',
      facts: { version: '2.0.0', build: '1', model: 'iPhone', os: 'iOS 18.0', screen: rememberedScreen() },
    });
    expect(body).toContain('Category: Wrong data');
    expect(body).toContain('Hole 3 yardage looked short');
    expect(body).toContain('Contact: not given');
    expect(body).toContain('App version: 2.0.0');
    expect(body).toContain('Build: 1');
    expect(body).toContain('Device: iPhone');
    expect(body).toContain('System: iOS 18.0');
    expect(body).toContain('Screen: play');
    expect(body.toLowerCase()).not.toMatch(/latitude|longitude|\bgps\b|location/);
    const mail = feedbackMailto('friend@example.com', body);
    expect(mail.startsWith('mailto:friend@example.com?')).toBe(true);
    expect(decodeURIComponent(mail)).toContain('COOPR beta feedback');
    expect(decodeURIComponent(mail)).toContain('Screen: play');
    const screen = read('../app/feedback.tsx');
    expect(screen).toContain('This is the note that will be sent');
    expect(screen.indexOf('feedbackBody(')).toBeLessThan(screen.indexOf('Linking.openURL'));
    expect(screen).toContain('Feedback email is not set');
    const privacy = read('../app/privacy.tsx');
    expect(privacy).toContain('DRAFT for lawyer review');
    expect(privacy).toContain('Open-Meteo');
    expect(privacy).toContain('on the device');
    expect(privacy).toContain('stay on this phone');
    const more = read('../app/more.tsx');
    const home = read('../app/index.tsx');
    expect(more).toContain("router.push('/feedback')");
    expect(more).toContain("router.push('/privacy')");
    expect(home).toContain("router.push('/more')");
  });

  it('labels an empty bag and does not load founder history when tools are off', () => {
    const store = read('../src/local-store.tsx');
    expect(store).toContain('if (!FOUNDER_TOOLS_ENABLED) return null');
    expect(store).toContain("displayName: SHELL?.displayName ?? ''");
    const bag = read('../app/bag/index.tsx');
    const setup = read('../app/setup.tsx');
    expect(bag).toContain('No clubs in the bag yet. Add one in Setup. Nothing was filled in for you.');
    expect(setup).toContain('No clubs yet. Add a name below, or import a CSV. This build does not include a sample bag.');
    const stub = read('../../../packages/seed/src/store-stub.ts');
    expect(stub).toContain('Founder tools are off in this build');
    expect(stub).not.toMatch(/Coers|TrackMan/);
    const flag = read('../src/founder-flag.ts');
    expect(flag).toContain("process.env.EXPO_PUBLIC_FOUNDER_TOOLS !== '0'");
  });
});
