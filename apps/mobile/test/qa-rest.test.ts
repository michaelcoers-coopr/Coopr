import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG, scoringByHoleType } from '@coopr/analysis';
import type { HoleInput, RoundInput } from '@coopr/analysis';
import { colors, signal } from '@coopr/tokens';
import { toEngine, type StoredRound } from '../src/analysis/from-round';
import { homeRoundSummary } from '../src/analysis/home-rounds';
import { NEEDS_MORE_LINE, presentAnalysis, shareText, showsNeedsMore } from '../src/analysis/present';
import { sampleBundle } from '../src/analysis/sample-season';
import { bagSubscriptionUpdate } from '../src/device/bag-sync';
import { clearHeldDraft, leaveDraftForShots, readHeldDraft, readPlayNote, SHOTS_FIRST_NOTE } from '../src/bag-scan/play-note';
import { blankDraft } from '../src/bag-scan/types';
import { readPlayWebFlags } from '../src/play-web-flags';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');

function contrast(front: string, back: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const channel = (value: number) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const lighter = Math.max(lum(front), lum(back));
  const darker = Math.min(lum(front), lum(back));
  return (lighter + 0.05) / (darker + 0.05);
}

function playedRound(id: string, strokes: number, putts: number | null, penalties: number | null): StoredRound {
  return {
    id,
    playedOn: `2026-10-${id.slice(-2).padStart(2, '0')}`,
    courseName: 'High Cedars',
    holes: Array.from({ length: 18 }, (_, index) => ({
      number: index + 1,
      par: 4,
      yards: 380,
      strokeIndex: (index % 18) + 1,
      strokes,
      putts,
      penalties,
    })),
  };
}

describe('rest of PR 5', () => {
  it('counts archived rounds and shows a trend only after three scored rounds', () => {
    const empty = homeRoundSummary([]);
    expect(empty.kept).toBe(0);
    expect(empty.last).toBeNull();
    expect(empty.handicap).toBe('Play 3 rounds to see your handicap trend');
    expect(empty.trend).toBeNull();
    const four = [0, 1, 2, 3].map((index) => playedRound(`r${index + 1}`, 5 - (index % 2), 2, null));
    const summary = homeRoundSummary(four);
    expect(summary.kept).toBe(4);
    expect(summary.last?.gross).toBe(18 * 4);
    expect(summary.handicap).toMatch(/Last 3 rounds/);
    expect(summary.handicap).toMatch(/Not an official handicap/);
    expect(summary.handicap).not.toBe('Play 3 rounds to see your handicap trend');
    expect(summary.trend).toBeTruthy();
    const home = read('../app/index.tsx');
    expect(home).toContain('homeRoundSummary');
    expect(home).toContain('readArchive');
    expect(home).toContain('No rounds yet. Your first one lands here.');
    expect(read('../app/rounds.tsx')).toContain('homeRoundSummary');
  });

  it('treats an unlogged penalty as zero for analysis once strokes are logged', () => {
    const one = toEngine([playedRound('r1', 5, 2, null)], []);
    expect(one.rounds[0]?.holes[0]?.penalties).toBe(0);
    expect(playedRound('r1', 5, 2, null).holes[0]?.penalties).toBeNull();
    const short = presentAnalysis(analyze({ rounds: one.rounds, shots: [] }));
    expect(short.find((panel) => panel.id === 'one_fix')?.status).toBe('needs_more');
    expect(short.find((panel) => panel.id === 'one_fix')?.invitation).toMatch(/Needs/);
    expect(short.find((panel) => panel.id === 'one_fix')?.invitation).not.toMatch(/log putts and penalties/);
    const missingPutts = toEngine([playedRound('r1', 5, null, null)], []);
    expect(missingPutts.rounds[0]?.holes[0]?.putts).toBeNull();
    const withheld = presentAnalysis(analyze({ rounds: missingPutts.rounds, shots: [] }));
    expect(withheld.find((panel) => panel.id === 'one_fix')?.figure).toBeNull();
    expect(withheld.find((panel) => panel.id === 'loss_ledger')?.figure).toBeNull();
    expect(withheld.find((panel) => panel.id === 'one_fix')?.invitation).toMatch(/log putts and penalties/);
    const three = toEngine([playedRound('r1', 5, 2, null), playedRound('r2', 5, 2, null), playedRound('r3', 6, 2, null)], []);
    const panels = presentAnalysis(analyze({ rounds: three.rounds, shots: [] }));
    expect(panels.find((panel) => panel.id === 'one_fix')?.status).toBe('ready');
    expect(panels.find((panel) => panel.id === 'one_fix')?.figure).toMatch(/^\d/);
    expect(panels.find((panel) => panel.id === 'loss_ledger')?.status).toBe('ready');
    expect(panels.find((panel) => panel.id === 'loss_ledger')?.figure).toMatch(/^\d/);
  });

  it('keeps iOS light when the splash plugin runs on the resolved config', () => {
    const { getIosSplashConfig } = require(join(here, '../../../node_modules/expo-splash-screen/plugin/build/getIosSplashConfig.js')) as {
      getIosSplashConfig: (props: Record<string, unknown>) => { dark?: { image?: string; backgroundColor?: string } };
    };
    const { setSplashInfoPlist } = require(join(here, '../../../node_modules/expo-splash-screen/plugin/build/withIosSplashInfoPlist.js')) as {
      setSplashInfoPlist: (config: { userInterfaceStyle?: string }, info: Record<string, string>, splash: unknown) => Record<string, string>;
    };
    const appJson = require(join(here, '../app.json')) as { expo: Record<string, unknown> };
    const configure = require(join(here, '../app.config.js')) as (ctx: { config: Record<string, unknown> }) => {
      userInterfaceStyle?: string;
      plugins?: unknown[];
      ios?: { infoPlist?: { UIUserInterfaceStyle?: string } };
    };
    const resolved = configure({ config: appJson.expo });
    const splashPlugin = resolved.plugins?.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') as [string, Record<string, unknown>] | undefined;
    expect(splashPlugin?.[1]?.dark).toBeUndefined();
    expect((splashPlugin?.[1]?.android as { dark?: unknown } | undefined)?.dark).toBeUndefined();
    const splash = getIosSplashConfig(splashPlugin?.[1] ?? {});
    expect(splash.dark?.image).toBeUndefined();
    expect(splash.dark?.backgroundColor).toBeUndefined();
    const plist = setSplashInfoPlist(
      { userInterfaceStyle: resolved.userInterfaceStyle },
      { UIUserInterfaceStyle: resolved.ios?.infoPlist?.UIUserInterfaceStyle ?? '' },
      splash,
    );
    expect(plist.UIUserInterfaceStyle).toBe('Light');
    expect(read('../app.json')).not.toMatch(/"dark"\s*:/);
  });

  it('says a photo sent for extraction is used only to read club details', () => {
    const config = read('../app.json');
    expect(config).toContain('only to read the club details');
    expect(config).not.toContain('Nothing is uploaded');
    const copy = read('../src/bag-scan/copy.ts');
    expect(copy).toContain('extract server');
    expect(copy).not.toContain('Nothing is uploaded');
    const privacy = read('../app/privacy.tsx');
    expect(privacy).toContain('DRAFT for lawyer review');
    expect(privacy).toContain('lawyer-reviewed privacy policy');
    expect(privacy).toContain('only to read the club details');
  });

  it('clears a live bag when the last club is deleted and leaves founder seed alone', () => {
    expect(bagSubscriptionUpdate({ bagLength: 2, founderTools: true, sawBag: false })).toEqual({ clear: false, sawBag: true });
    expect(bagSubscriptionUpdate({ bagLength: 0, founderTools: true, sawBag: false })).toEqual({ clear: false, sawBag: false });
    expect(bagSubscriptionUpdate({ bagLength: 0, founderTools: true, sawBag: true })).toEqual({ clear: true, sawBag: false });
    expect(bagSubscriptionUpdate({ bagLength: 0, founderTools: false, sawBag: false })).toEqual({ clear: true, sawBag: false });
    const store = read('../src/local-store.tsx');
    expect(store).toContain('bagSubscriptionUpdate');
    expect(store).toContain('setWedges({})');
    expect(store).not.toContain('if (snap.bag.length === 0) return;');
  });

  it('keeps a draft when shots are logged first and shows the note on the hole', () => {
    clearHeldDraft();
    const draft = { ...blankDraft(), brand: 'Ping', type: 'iron' as const, loftText: '30' };
    leaveDraftForShots(draft);
    expect(readHeldDraft()?.brand).toBe('Ping');
    expect(readPlayNote()).toBe(SHOTS_FIRST_NOTE);
    const hold = read('../app/bag/hold.tsx');
    expect(hold).toContain('leaveDraftForShots');
    expect(hold.slice(hold.indexOf('LOG SHOTS FIRST'))).not.toContain('saveDraft');
    expect(read('../app/play.tsx')).toContain('readPlayNote');
    clearHeldDraft();
    expect(readPlayNote()).toBeNull();
  });

  it('gives hole navigation 44 point targets, a bag back control, and a readable start button', () => {
    const play = read('../app/play.tsx');
    expect(play).toContain('pillArrow: { width: 44, height: 44');
    expect(play).toContain('pillBallHit: { width: 44, height: 44');
    expect(read('../src/design/floating-ask.tsx')).toContain("root === 'onboard'");
    expect(read('../src/bag-scan/chrome.tsx')).toContain('paddingRight: 20');
    expect(read('../src/bag-scan/chrome.tsx')).not.toContain('paddingRight: 88');
    expect(read('../app/bag/card.tsx')).toContain('backTo="/bag"');
    const games = read('../app/games.tsx');
    expect(games).toContain('goText: { color: colors.navy');
    expect(games).toContain('backgroundColor: signal.go');
    expect(contrast(colors.navy, signal.go)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', signal.go)).toBeLessThan(4.5);
  });

  it('shows one bucket once, a concrete ledger action, and a share of computed facts', () => {
    const holes: HoleInput[] = Array.from({ length: 8 }, (_, index) => ({
      number: index + 1,
      par: 4,
      yards: 400,
      strokeIndex: index + 1,
      strokes: 6,
      putts: 2,
      penalties: 0,
      fairway: null,
      gir: null,
      firstPuttFeet: null,
      teeClub: null,
      pressure: [],
      bbNet: null,
    }));
    const round: RoundInput = {
      id: 'one-bucket',
      playedOn: '2026-10-25',
      courseId: null,
      courseName: 'High Cedars',
      teeName: null,
      startPeriod: null,
      format: null,
      targetScore: null,
      isSample: false,
      quality: 'user_confirmed',
      holes,
    };
    const scoring = scoringByHoleType([round], DEFAULT_CONFIG);
    expect(scoring.value?.worst).toBe(scoring.value?.best);
    expect(scoring.take).toMatch(/One bucket so far/);
    expect(scoring.take).not.toMatch(/Best:/);
    const three = toEngine([playedRound('r1', 5, 2, null), playedRound('r2', 5, 2, null), playedRound('r3', 6, 2, null)], []);
    const panels = presentAnalysis(analyze({ rounds: three.rounds, shots: [] }));
    const home = panels.find((panel) => panel.id === 'one_fix');
    const ledger = panels.find((panel) => panel.id === 'loss_ledger');
    expect(home?.take).toMatch(/Next round:/);
    expect(home?.action?.match(/Next round:/g)?.length ?? 0).toBe(0);
    expect(ledger?.action).toMatch(/^Next round, start with /);
    expect(read('../../../packages/analysis/src/shots.ts')).not.toContain('Tap the gap');
    const screen = read('../app/analysis.tsx');
    expect(screen).toContain('numberOfLines={1}');
    expect(screen).toContain('Share these facts');
    expect(screen).toContain('showsNeedsMore');
    const sample = presentAnalysis(analyze(sampleBundle()));
    for (const panel of sample) {
      if (panel.confidence === 'Solid read') expect(showsNeedsMore(panel)).toBe(false);
      if (showsNeedsMore(panel)) expect(panel.confidence).not.toBe('Solid read');
    }
    const share = sample.find((panel) => panel.id === 'share');
    const text = share ? shareText(share) : null;
    expect(text).toBeTruthy();
    expect(text).not.toContain(NEEDS_MORE_LINE);
    expect(screen).toContain('Share.share');
  });

  it('asks the server when one is set, names the club fields, and survives a throwing web store', () => {
    const home = read('../app/index.tsx');
    expect(home).toContain('requestTalk');
    expect(home).not.toContain('sampleTalkReply');
    expect(home).toContain("reply.mode === 'sample' && founderTools");
    expect(home).toContain('cardLine:');
    const privacy = read('../app/privacy.tsx');
    expect(privacy).toContain('selected club');
    expect(privacy).toContain('card line');
    const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['expo-file-system']).toMatch(/^~58\./);
    expect(readPlayWebFlags(undefined)).toEqual({ sample: false, scrub: null });
    expect(readPlayWebFlags({ getItem: () => { throw new Error('denied'); } })).toEqual({ sample: false, scrub: null });
    expect(readPlayWebFlags({ getItem: (key) => (key === 'coopr.sample.signature' ? '1' : '4') })).toEqual({ sample: true, scrub: 4 });
    expect(read('../app/play.tsx')).toContain('readPlayWebFlags');
  });
});
