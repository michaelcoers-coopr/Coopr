import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze, DEFAULT_CONFIG, scoringByHoleType } from '@coopr/analysis';
import type { HoleInput, RoundInput } from '@coopr/analysis';
import { colors, signal } from '@coopr/tokens';
import { calendarDate } from '@coopr/games';
import { penaltiesUnlogged, toEngine, type StoredRound } from '../src/analysis/from-round';
import { homeRoundSummary } from '../src/analysis/home-rounds';
import { NEEDS_MORE_LINE, presentAnalysis, shareText, showsNeedsMore, type AnalysisPanel } from '../src/analysis/present';
import { sampleBundle } from '../src/analysis/sample-season';
import { reduceBagStack, type BagStackOp } from '../src/bag-scan/bag-nav';
import { EXTRACT_READS } from '../src/bag-scan/copy';
import { confirmReason, detailsReason } from '../src/bag-scan/logic';
import { bagSubscriptionUpdate } from '../src/device/bag-sync';
import { clearHeldDraft, dismissPlayNote, leaveDraftForShots, openAddDraft, readHeldDraft, readPlayNote, SHOTS_FIRST_NOTE } from '../src/bag-scan/play-note';
import { blankDraft } from '../src/bag-scan/types';
import { readStoredFix } from '../src/gps-fix';
import { readPlayWebFlags } from '../src/play-web-flags';
import { hasWebStorage, readRoundSync, writeRound } from '../src/round-save-io';
import type { RoundSave } from '../src/round-save';
import { readTalkPreview } from '../src/talk-preview';
import { webStore } from '../src/web-storage';

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

function sharePanel(confidence: string): AnalysisPanel {
  return {
    id: 'share',
    eyebrow: '6 · SHARE',
    title: 'Share',
    status: 'ready',
    sample: false,
    confidence,
    figure: '1.2',
    unit: 'STROKES / ROUND',
    headline: null,
    invitation: null,
    take: 'A read',
    action: null,
    caveat: null,
    fixId: null,
    rows: [],
  };
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
    expect(summary.disclaimer).toBe('Not an official handicap.');
    expect(summary.handicap).not.toMatch(/Not an official handicap/);
    expect(summary.handicap).not.toBe('Play 3 rounds to see your handicap trend');
    expect(summary.trend).toBe('avg +6 to par');
    expect(empty.disclaimer).toBeNull();
    const home = read('../app/index.tsx');
    expect(home).toContain('LAST 3 TO PAR');
    expect(home).toContain('tileDisclaimer');
    expect(home).not.toContain('>HANDICAP<');
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
    expect(short.find((panel) => panel.id === 'one_fix')?.invitation).not.toMatch(/penalties logged/);
    expect(short.find((panel) => panel.id === 'loss_ledger')?.invitation).not.toMatch(/penalties logged/);
    expect(penaltiesUnlogged([playedRound('r1', 5, 2, null)])).toBe(true);
    expect(penaltiesUnlogged([playedRound('r1', 5, 2, 0)])).toBe(false);
    const missingPutts = toEngine([playedRound('r1', 5, null, null)], []);
    expect(missingPutts.rounds[0]?.holes[0]?.putts).toBeNull();
    const withheld = presentAnalysis(analyze({ rounds: missingPutts.rounds, shots: [] }));
    expect(withheld.find((panel) => panel.id === 'one_fix')?.figure).toBeNull();
    expect(withheld.find((panel) => panel.id === 'loss_ledger')?.figure).toBeNull();
    expect(withheld.find((panel) => panel.id === 'one_fix')?.invitation).toMatch(/strokes and putts/);
    expect(withheld.find((panel) => panel.id === 'one_fix')?.invitation).not.toMatch(/log putts and penalties/);
    expect(withheld.find((panel) => panel.id === 'loss_ledger')?.invitation).toMatch(/strokes and putts/);
    expect(withheld.find((panel) => panel.id === 'loss_ledger')?.invitation).not.toMatch(/penalties logged/);
    const three = toEngine([playedRound('r1', 5, 2, null), playedRound('r2', 5, 2, null), playedRound('r3', 6, 2, null)], []);
    const panels = presentAnalysis(analyze({ rounds: three.rounds, shots: [] }));
    expect(panels.find((panel) => panel.id === 'one_fix')?.status).toBe('ready');
    expect(panels.find((panel) => panel.id === 'one_fix')?.figure).toMatch(/^\d/);
    expect(panels.find((panel) => panel.id === 'loss_ledger')?.status).toBe('ready');
    expect(panels.find((panel) => panel.id === 'loss_ledger')?.figure).toMatch(/^\d/);
    const card = presentAnalysis(analyze({ rounds: three.rounds, shots: [] }), { unloggedPenalties: true });
    expect(card.find((panel) => panel.id === 'loss_ledger')?.rows.find((row) => row.label === 'Penalty strokes')?.detail).toBe('Not logged');
    expect(three.rounds[0]?.holes[0]?.penalties).toBe(0);
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

  it('says a photo sent for extraction is read for club details, shots, scores, or distances', () => {
    const config = read('../app.json');
    expect(config).toContain(EXTRACT_READS);
    expect(config).not.toContain('only to read the club details');
    expect(config).not.toContain('Nothing is uploaded');
    const copy = read('../src/bag-scan/copy.ts');
    expect(copy).toContain('extract server');
    expect(copy).toContain(EXTRACT_READS);
    expect(copy).not.toContain('Nothing is uploaded');
    const privacy = read('../app/privacy.tsx');
    expect(privacy).toContain('DRAFT for lawyer review');
    expect(privacy).toContain('lawyer-reviewed privacy policy');
    expect(privacy).toContain(EXTRACT_READS);
    expect(privacy).toContain('not only club details');
    expect(privacy).not.toContain('only to read the club details');
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
    dismissPlayNote();
    expect(readPlayNote()).toBeNull();
    expect(readHeldDraft()?.brand).toBe('Ping');
    leaveDraftForShots(draft);
    const play = read('../app/play.tsx');
    expect(play).not.toContain('insets.top + 168');
    expect(play).toContain('Dismiss note');
    expect(play).toContain('dismissPlayNote');
    expect(play).not.toMatch(/draftBanner: \{[^}]*position: 'absolute'/);
    expect(play).toMatch(/holePillFill: \{[^}]*gap: 8/);
    expect(play).toContain('pillPair: { flexDirection: \'row\', alignItems: \'center\', gap: 6 }');
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
    expect(contrast(colors.navy, '#B7C4A4')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', '#0E1A2C')).toBeGreaterThanOrEqual(4.5);
    expect(games).toContain("goOff: { backgroundColor: '#B7C4A4' }");
    expect(games).toContain('accessibilityHint={block ?? undefined}');
    expect(games).not.toContain('opacity: 0.4');
    const chrome = read('../src/bag-scan/chrome.tsx');
    expect(chrome).toContain("disabledFill: { backgroundColor: '#B7C4A4' }");
    expect(chrome).toContain('color: scan.navy');
    expect(chrome).not.toContain('opacity: 0.45');
    expect(chrome).toContain('accessibilityHint={disabled && reason ? reason : undefined}');
    expect(read('../app/bag/confirm.tsx')).toContain('reason={reason}');
    expect(read('../app/bag/details.tsx')).toContain('reason={reason}');
    expect(confirmReason(false)).toMatch(/loft or a club number/);
    expect(detailsReason(false, false)).toMatch(/before this can save/);
    expect(detailsReason(true, true)).toMatch(/does not copy it into your bag/);
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
    const labels = scoring.value?.buckets.map((bucket) => bucket.label) ?? [];
    expect(labels).toContain('Par 3 under 140');
    expect(labels).toContain('Par 3 over 175');
    expect(labels).toContain('Par 4 under 350');
    expect(labels).toContain('Par 4 over 420');
    expect(labels).toContain('Par 5 under 500');
    expect(labels).toContain('Par 5 over 550');
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
    expect(screen).toContain('numberOfLines={2}');
    expect(screen).not.toContain('numberOfLines={1}');
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
    const early = shareText(sharePanel('Early read'));
    expect(early).toContain('Early read');
    expect(screen).toContain('Share.share');
  });

  it('asks the server when one is set, names the club fields, and survives a throwing web store', () => {
    const home = read('../app/index.tsx');
    expect(home).toContain('requestTalk');
    expect(home).not.toContain('sampleTalkReply');
    expect(home).toContain("setAskSample(reply.mode === 'sample')");
    expect(home).not.toContain("reply.mode === 'sample' && founderTools");
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

  it('stores an archived round on the local calendar date', () => {
    expect(calendarDate(new Date('2026-10-25T04:41:00.000Z'), 'America/Los_Angeles')).toBe('2026-10-24');
    const store = read('../src/local-store.tsx');
    expect(store).toContain('calendarDate(new Date())');
    expect(store).not.toContain('toISOString().slice(0, 10)');
    expect(read('../app/analysis.tsx')).toContain('calendarDate(new Date())');
  });

  it('returns to the bag without stacking the add flow again', () => {
    const typeIt: BagStackOp[] = [
      { kind: 'push', href: '/bag' },
      { kind: 'push', href: '/bag/add' },
      { kind: 'replace', href: '/bag/details' },
      { kind: 'replace', href: '/bag/card' },
      { kind: 'back' },
    ];
    expect(typeIt.reduce(reduceBagStack, ['/'])).toEqual(['/', '/bag']);
    const photo: BagStackOp[] = [
      { kind: 'push', href: '/bag' },
      { kind: 'push', href: '/bag/add' },
      { kind: 'replace', href: '/bag/scan' },
      { kind: 'replace', href: '/bag/confirm' },
      { kind: 'replace', href: '/bag/card' },
      { kind: 'back' },
    ];
    expect(photo.reduce(reduceBagStack, ['/'])).toEqual(['/', '/bag']);
    const kept: BagStackOp[] = [
      { kind: 'push', href: '/bag' },
      { kind: 'push', href: '/bag/card' },
      { kind: 'push', href: '/bag/hold' },
      { kind: 'dismiss', count: 2 },
    ];
    expect(kept.reduce(reduceBagStack, ['/'])).toEqual(['/', '/bag']);
    expect(read('../app/bag/add.tsx')).toContain("forwardBag(router, '/bag/scan')");
    expect(read('../app/bag/add.tsx')).not.toContain("router.push('/bag/scan')");
    expect(read('../app/bag/confirm.tsx')).toContain("forwardBag(router, '/bag/card')");
    expect(read('../app/bag/confirm.tsx')).not.toContain("router.push('/bag/card')");
    expect(read('../app/bag/card.tsx')).toContain('returnToBag(router)');
    expect(read('../app/bag/card.tsx')).not.toContain("router.replace('/bag')");
    expect(read('../app/bag/card.tsx')).not.toContain("router.push('/bag/add')");
  });

  it('guards gps, talk preview, and round save when storage throws', async () => {
    expect(readTalkPreview({ getItem() { throw new Error('denied'); } })).toBeNull();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const restore = () => {
      if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    };
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('denied');
        },
      });
      expect(webStore()).toBeNull();
      expect(readStoredFix()).toBeNull();
      expect(hasWebStorage()).toBe(false);
      expect(readRoundSync()).toBeNull();
      expect(readTalkPreview(webStore())).toBeNull();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem() {
            throw new Error('denied');
          },
          setItem() {
            throw new Error('denied');
          },
          removeItem() {},
          clear() {},
          key() {
            return null;
          },
          length: 0,
        },
      });
      expect(readStoredFix()).toBeNull();
      expect(readRoundSync()).toBeNull();
      expect(readTalkPreview(webStore())).toBeNull();
      await writeRound({} as RoundSave);
    } finally {
      restore();
    }
    expect(read('../src/gps-fix.ts')).not.toContain('localStorage');
    expect(read('../src/talk-overlay.tsx')).not.toContain('localStorage');
    expect(read('../src/round-save-io.ts')).not.toContain('localStorage');
    expect(read('../src/talk-overlay.tsx')).toContain('readTalkPreview');
    expect(read('../src/gps-fix.ts')).toContain('webStore');
    expect(read('../src/round-save-io.ts')).toContain('webStore');
  });

  it('keeps a held club when Add to bag opens again', () => {
    clearHeldDraft();
    const draft = { ...blankDraft(), brand: 'Titleist', type: 'wedge' as const, loftText: '56' };
    leaveDraftForShots(draft);
    expect(openAddDraft()?.brand).toBe('Titleist');
    expect(readHeldDraft()?.brand).toBe('Titleist');
    const session = read('../src/bag-scan/session.tsx');
    const at = session.indexOf('startNew: () => {');
    const start = session.slice(at, session.indexOf('discardDraft: () => {', at));
    expect(start).toContain('openAddDraft');
    expect(start).not.toContain('clearHeldDraft');
    expect(session).toContain('discardDraft:');
    expect(read('../app/bag/add.tsx')).toContain('DISCARD');
    clearHeldDraft();
    expect(openAddDraft()).toBeNull();
  });

  it('says the ranking is against players at your handicap', () => {
    const three = toEngine([playedRound('r1', 5, 2, 0), playedRound('r2', 5, 2, 0), playedRound('r3', 6, 2, 0)], []);
    const ranked = analyze({ rounds: three.rounds, shots: [] });
    expect(ranked.ranking?.value?.caveat).toMatch(/players at your handicap/);
    expect(ranked.ranking?.value?.caveat).not.toContain('players your handicap');
    expect(read('../../../packages/analysis/src/fix.ts')).not.toContain('players your handicap');
  });

  it('splits the camera sentence so a bag photo stays and a scorecard is sent', () => {
    const config = read('../app.json');
    const camera = config.slice(config.indexOf('"cameraPermission"'), config.indexOf('"photosPermission"') > config.indexOf('"cameraPermission"') ? config.indexOf('"photosPermission"') : config.indexOf('"cameraPermission"') + 500);
    expect(camera).toContain('A bag or club photo stays on this phone and is not sent.');
    expect(camera).toContain('A scorecard photo is sent');
    expect(camera).not.toContain('A club or scorecard photo is sent');
    expect(config).toContain(EXTRACT_READS);
  });
});
