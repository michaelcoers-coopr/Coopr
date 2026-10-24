import { describe, expect, it } from 'vitest';
import type { DistanceProfile } from '../src/profile';
import {
  buildTalkContext,
  createTalkMachine,
  proactiveCallout,
  runTalkTool,
  sampleTalkReply,
  talkTransition,
} from '../src/conversation';

function profile(patch: Partial<DistanceProfile> & Pick<DistanceProfile, 'clubId' | 'clubLabel' | 'metric' | 'stockYards'>): DistanceProfile {
  return {
    environment: 'range',
    swingMode: 'full',
    sampleSize: 12,
    p20: patch.stockYards - 5,
    p50: patch.stockYards,
    p80: patch.stockYards + 5,
    iqr: 6,
    mad: 3,
    shortMissCount: 1,
    longMissCount: 1,
    shortMissShare: 0.1,
    longMissShare: 0.1,
    confidence: 'solid',
    longestYards: patch.stockYards + 8,
    lateralMiss: 'none',
    blended: false,
    reported: false,
    dispersionKnown: true,
    sampleWarning: null,
    ...patch,
  };
}

const driver = profile({ clubId: 'driver', clubLabel: 'Driver', metric: 'carry', stockYards: 186, dispersionKnown: false, p20: 170, p80: 200 });
const seven = profile({ clubId: '7i', clubLabel: '7-iron', metric: 'carry', stockYards: 152 });

describe('talk context', () => {
  it('keeps an unmeasured dispersion null and does not invent plays-like', () => {
    const context = buildTalkContext({
      hole: 1,
      par: 5,
      atTee: true,
      gpsYards: 460,
      headwindMph: null,
      elevationFeet: 12,
      temperatureF: 70,
      profiles: [driver, seven],
      selectedClubId: 'driver',
      selectedClubLabel: 'Driver',
      persona: 'chirpy',
    });
    const inHand = context.clubs.find((club) => club.clubId === 'driver');
    expect(inHand?.carryYards).toBe(186);
    expect(inHand?.totalYards).toBeNull();
    expect(inHand?.dispersionYards).toBeNull();
    expect(context.playsLikeYards).toBeNull();
    expect(context.playsLikeMissing).toContain('wind');
    expect(context.clubs.find((club) => club.clubId === '7i')?.dispersionYards).toBe(10);
  });
});

describe('talk tools', () => {
  const context = buildTalkContext({
    hole: 1,
    par: 4,
    gpsYards: 152,
    headwindMph: 0,
    elevationFeet: 0,
    temperatureF: 75,
    profiles: [seven],
    selectedClubId: '7i',
    persona: 'chill',
  });

  it('returns null plays-like when wind is missing and does not fill it', () => {
    const blank = buildTalkContext({ hole: 1, par: 4, gpsYards: 152, profiles: [seven] });
    const result = runTalkTool('get_plays_like', {}, blank);
    expect(result.data.playsLikeYards).toBeNull();
    expect(result.data.missing).toContain('wind');
    expect(result.line).toMatch(/blank/i);
    expect(result.line).not.toMatch(/\d{3}/);
  });

  it('calls a measured club and refuses a score or a club that was not real', () => {
    const called = runTalkTool('recommend_club', {}, context);
    expect(called.data.clubLabel).toBe('7-iron');
    expect(called.data.yards).not.toBeNull();
    expect(called.line).toMatch(/7-iron/);
    const score = runTalkTool('log_score', { strokes: 0, putts: 'two' }, context);
    expect(score.ok).toBe(false);
    expect(score.action).toBeNull();
    expect(score.data).toEqual({ strokes: null, putts: null });
    const logged = runTalkTool('log_score', { strokes: 4 }, context);
    expect(logged.action).toEqual({ tool: 'log_score', strokes: 4 });
    expect(logged.data.putts).toBeNull();
    const missing = runTalkTool('set_club', { clubId: '3-wood' }, context);
    expect(missing.ok).toBe(false);
    expect(missing.action).toBeNull();
    const marked = runTalkTool('mark_shot', { side: 'sideways' }, context);
    expect(marked.ok).toBe(false);
    const left = runTalkTool('mark_shot', { side: 'left' }, context);
    expect(left.action).toEqual({ tool: 'mark_shot', miss: 'left' });
  });

  it('speaks a sample tee line from real context and labels it sample', async () => {
    const tee = buildTalkContext({
      hole: 1,
      par: 5,
      atTee: true,
      gpsYards: 460,
      headwindMph: 4,
      elevationFeet: 0,
      temperatureF: 75,
      profiles: [driver],
      selectedClubId: 'driver',
      selectedClubLabel: 'Driver',
      persona: 'chirpy',
    });
    const reply = await sampleTalkReply(tee, 'What should I hit?');
    expect(reply.mode).toBe('sample');
    expect(reply.heard).toBe(false);
    expect(reply.line).toBe("Par 5. Nobody's getting home. Driver, find the short grass.");
    expect(reply.line).not.toMatch(/443|460/);
    const chill = await sampleTalkReply({ ...tee, persona: 'chill' }, 'What should I hit?');
    expect(chill.line).toBe('Par 5. Driver will not reach the green.');
  });

  it('answers wind, elevation, temperature, and distance from the readings, or says they are missing', async () => {
    const quiet = buildTalkContext({ hole: 3, par: 4, atTee: false, gpsYards: 158, profiles: [seven] });
    expect((await sampleTalkReply(quiet, "What's the wind doing?")).line).toBe('No wind reading yet.');
    expect((await sampleTalkReply(quiet, "What's the elevation?")).line).toBe('No elevation reading yet.');
    expect((await sampleTalkReply(quiet, 'How hot is it?')).line).toBe('No temperature reading yet.');
    expect((await sampleTalkReply(quiet, 'How far is it?')).line).toBe('158 yards.');
    const live = buildTalkContext({
      hole: 3,
      par: 4,
      atTee: false,
      gpsYards: 158,
      windMph: 6,
      headwindMph: -4,
      elevationFeet: 18,
      temperatureF: 72,
      profiles: [seven],
    });
    const wind = await sampleTalkReply(live, "What's the wind doing?");
    expect(wind.line).toMatch(/Wind 6 miles per hour/);
    expect(wind.line).toMatch(/Helping/);
    expect(wind.line).not.toMatch(/7-iron|Grip it/);
    expect((await sampleTalkReply(live, "What's the elevation?")).line).toMatch(/18 feet up/);
    expect((await sampleTalkReply(live, 'How hot is it?')).line).toBe('72 degrees.');
    const blank = buildTalkContext({ hole: 3, par: 4, atTee: false, gpsYards: null, profiles: [seven] });
    expect((await sampleTalkReply(blank, 'How far is it?')).line).toBe('No distance yet.');
  });

  it('calls the total club the card would, not the closest carry', async () => {
    const driverTotal = profile({ clubId: 'driver', clubLabel: 'Driver', metric: 'total', stockYards: 213 });
    const sevenTotal = profile({ clubId: '7i', clubLabel: '7-iron', metric: 'total', stockYards: 160 });
    const approach = buildTalkContext({
      hole: 3,
      par: 4,
      atTee: false,
      gpsYards: 165,
      headwindMph: 0,
      elevationFeet: 0,
      temperatureF: 75,
      profiles: [driver, seven, driverTotal, sevenTotal],
      persona: 'chirpy',
    });
    const reply = await sampleTalkReply(approach, 'hit');
    expect(reply.line).toMatch(/7-iron/);
    expect(reply.line).not.toMatch(/closest carry/i);
    expect(reply.line).not.toMatch(/Driver/);
  });

  it('calls an easy swing in whole yards when the shot is shorter than every club', async () => {
    const context = buildTalkContext({
      hole: 7,
      par: 3,
      atTee: false,
      gpsYards: 40,
      headwindMph: 0,
      elevationFeet: 0,
      temperatureF: 70,
      profiles: [driver, profile({ clubId: 'pw', clubLabel: 'Pitching wedge', metric: 'carry', stockYards: 90.4 })],
    });
    const reply = await sampleTalkReply(context, 'What should I hit?');
    expect(reply.line).toMatch(/Pitching wedge/);
    expect(reply.line).toMatch(/90/);
    expect(reply.line).not.toMatch(/No club/);
    expect(reply.line).not.toMatch(/\d+\.\d/);
  });
});

describe('barge-in', () => {
  it('stops speech only when the player talks over the caddie', () => {
    let state = createTalkMachine(false);
    state = talkTransition(state, 'listen');
    state = talkTransition(state, 'think');
    state = talkTransition(state, 'speak');
    const cut = talkTransition(state, 'barge');
    expect(cut.phase).toBe('listening');
    expect(cut.stopSpeech).toBe(true);
    const idle = talkTransition(createTalkMachine(false), 'barge');
    expect(idle.phase).toBe('idle');
    expect(idle.stopSpeech).toBe(false);
    let hands = createTalkMachine(true);
    hands = talkTransition(hands, 'listen');
    hands = talkTransition(hands, 'think');
    hands = talkTransition(hands, 'speak');
    const again = talkTransition(hands, 'finish');
    expect(again.phase).toBe('listening');
    expect(again.stopSpeech).toBe(false);
    const closed = talkTransition(state, 'close');
    expect(closed.phase).toBe('idle');
    expect(closed.stopSpeech).toBe(true);
  });

  it('speaks a tee or a near-shot line once', () => {
    const first = proactiveCallout({
      enabled: true,
      persona: 'chill',
      hole: 2,
      par: 4,
      atTee: true,
      clubLabel: null,
      stockYards: null,
      greenYards: null,
      yardsFromLastShot: 10,
      lastShotId: 'm1',
      spokenKey: null,
    });
    expect(first).toEqual({ key: 'tee:2', line: 'Hole 2. Par 4.' });
    expect(
      proactiveCallout({
        enabled: true,
        persona: 'chirpy',
        hole: 2,
        par: 4,
        atTee: false,
        clubLabel: null,
        stockYards: null,
        greenYards: null,
        yardsFromLastShot: 18,
        lastShotId: 'm1',
        spokenKey: null,
      })?.line,
    ).toBe("You're 18 from the last mark.");
    expect(
      proactiveCallout({
        enabled: false,
        persona: 'chirpy',
        hole: 2,
        par: 4,
        atTee: true,
        clubLabel: null,
        stockYards: null,
        greenYards: null,
        yardsFromLastShot: null,
        lastShotId: null,
        spokenKey: null,
      }),
    ).toBeNull();
  });
});
