import { describe, expect, it } from 'vitest';
import type { DistanceProfile } from '@coopr/engine';
import {
  answerAsk,
  cycleAskChip,
  handleVoiceBuffer,
  handleVoiceRequest,
  lieEstimateYards,
  parseAsk,
  SAMPLE_VOICE_TRANSCRIPT,
  type AskIntent,
} from '@coopr/engine';

function stock(partial: Partial<DistanceProfile> & Pick<DistanceProfile, 'clubId' | 'clubLabel' | 'stockYards'>): DistanceProfile {
  const stockYards = partial.stockYards;
  return {
    clubId: partial.clubId,
    clubLabel: partial.clubLabel,
    environment: 'course',
    swingMode: 'full',
    metric: 'total',
    sampleSize: 10,
    p20: stockYards - 6,
    p50: stockYards,
    p80: stockYards + 6,
    iqr: 8,
    mad: 4,
    shortMissCount: 0,
    longMissCount: 0,
    shortMissShare: 0,
    longMissShare: 0,
    confidence: 'moderate',
    longestYards: stockYards + 8,
    stockYards,
    lateralMiss: 'none',
    blended: false,
    reported: false,
    dispersionKnown: true,
    sampleWarning: null,
    ...partial,
  };
}

const irons = [
  stock({ clubId: '7i', clubLabel: '7-iron', stockYards: 154 }),
  stock({ clubId: '6i', clubLabel: '6-iron', stockYards: 170 }),
];

const phrases: Array<{ text: string; expect: Partial<AskIntent> & { hazard?: string } }> = [
  { text: '165 yards out, got a bunker on left, what should i hit off the rough?', expect: { distanceYards: 165, lie: 'rough', question: 'club', hazard: 'bunker L' } },
  { text: "I'm in the sand 30 out", expect: { distanceYards: 30, lie: 'sand', question: 'club' } },
  { text: "what's it play like", expect: { question: 'plays_like', distanceYards: null, lie: null, command: null } },
  { text: 'I made a 5', expect: { command: { kind: 'score', strokes: 5 }, distanceYards: null, question: null } },
  { text: 'two putts', expect: { command: { kind: 'putts', putts: 2 }, distanceYards: null } },
  { text: 'next hole', expect: { command: { kind: 'next' } } },
  { text: 'I hit it right', expect: { command: { kind: 'miss', side: 'right' }, question: null } },
  { text: 'what should I hit', expect: { question: 'club', distanceYards: null, lie: null } },
  { text: '150 out', expect: { distanceYards: 150, question: 'club' } },
  { text: "I'm in the rough", expect: { lie: 'rough', question: 'club', distanceYards: null } },
  { text: 'fairway, 140', expect: { lie: 'fairway', distanceYards: 140, question: 'club' } },
  { text: 'on the tee, 230 yards', expect: { lie: 'tee', distanceYards: 230, question: 'club' } },
  { text: 'bunker on the right, 155', expect: { distanceYards: 155, lie: null, question: 'club', hazard: 'bunker R' } },
  { text: 'water left', expect: { hazard: 'water L', distanceYards: null, lie: null, question: null, command: null } },
  { text: 'hazard in front', expect: { hazard: 'hazard front', question: null } },
  { text: 'should I lay up', expect: { question: 'layup', distanceYards: null } },
  { text: "what's my miss", expect: { question: 'miss' } },
  { text: 'I hit it left', expect: { command: { kind: 'miss', side: 'left' } } },
  { text: 'pulled it left', expect: { command: { kind: 'miss', side: 'left' } } },
  { text: 'pushed it right', expect: { command: { kind: 'miss', side: 'right' } } },
  { text: 'I made a 4', expect: { command: { kind: 'score', strokes: 4 } } },
  { text: 'score is 6', expect: { command: { kind: 'score', strokes: 6 }, distanceYards: null } },
  { text: '3 putts', expect: { command: { kind: 'putts', putts: 3 } } },
  { text: 'one putt', expect: { command: { kind: 'putts', putts: 1 } } },
  { text: 'no putts', expect: { command: { kind: 'putts', putts: 0 } } },
  { text: 'go to the next hole', expect: { command: { kind: 'next' } } },
  { text: "I'm on the green", expect: { lie: 'green', question: 'club' } },
  { text: '30 yards from the pin in the sand', expect: { distanceYards: 30, lie: 'sand', question: 'club' } },
  { text: 'what club from the fairway, 175 yards', expect: { lie: 'fairway', distanceYards: 175, question: 'club' } },
  { text: 'how does it play', expect: { question: 'plays_like' } },
  { text: "what's the wind doing?", expect: { question: 'wind', distanceYards: null, command: null } },
  { text: "what's the elevation?", expect: { question: 'elevation', distanceYards: null } },
  { text: 'how hot is it?', expect: { question: 'temperature' } },
  { text: 'how far is it?', expect: { question: 'distance', distanceYards: null } },
  { text: 'I made five', expect: { command: { kind: 'score', strokes: 5 }, distanceYards: null } },
  { text: 'two putt', expect: { command: { kind: 'putts', putts: 2 } } },
  { text: 'next', expect: { command: { kind: 'next' } } },
  { text: 'I hit it short', expect: { command: { kind: 'miss', side: 'short' } } },
  { text: 'I hit the fairway', expect: { command: { kind: 'miss', side: 'fairway' }, lie: null } },
  { text: 'rough 120, bunker right, what do I hit', expect: { distanceYards: 120, lie: 'rough', question: 'club', hazard: 'bunker R' } },
  { text: "I'm 90 out", expect: { distanceYards: 90, question: 'club' } },
  { text: 'yards to the pin 155', expect: { distanceYards: 155, question: 'club' } },
  { text: 'off the tee what should I hit', expect: { lie: 'tee', question: 'club' } },
  { text: 'in the junk 140', expect: { lie: 'rough', distanceYards: 140, question: 'club' } },
  { text: 'I hit it in the hazard', expect: { command: { kind: 'miss', side: 'hazard' } } },
];

function hazardLabel(intent: AskIntent): string | null {
  const hazard = intent.hazards[0];
  if (!hazard) return null;
  const side = hazard.side === 'left' ? 'L' : hazard.side === 'right' ? 'R' : 'front';
  return `${hazard.kind} ${side}`;
}

describe('ask parser', () => {
  it.each(phrases)('$text', async ({ text, expect: wanted }) => {
    const intent = await parseAsk(text);
    expect(intent.language).toBe('en');
    expect(intent.usedModel).toBe(false);
    if ('distanceYards' in wanted) expect(intent.distanceYards).toBe(wanted.distanceYards);
    if ('lie' in wanted) expect(intent.lie).toBe(wanted.lie);
    if ('question' in wanted) expect(intent.question).toBe(wanted.question);
    if ('command' in wanted) expect(intent.command).toEqual(wanted.command);
    if (wanted.hazard) expect(hazardLabel(intent)).toBe(wanted.hazard);
    if (!wanted.hazard && wanted.hazard !== undefined) expect(intent.hazards).toEqual([]);
  });

  it('leaves German empty instead of borrowing the English lexicon', async () => {
    const intent = await parseAsk('Was soll ich schlagen, 165 Meter, Rough');
    expect(intent.language).toBe('de');
    expect(intent.distanceYards).toBeNull();
    expect(intent.lie).toBeNull();
    expect(intent.question).toBeNull();
    expect(intent.command).toBeNull();
    const forced = await parseAsk('165 yards out', { language: 'es' });
    expect(forced.language).toBe('es');
    expect(forced.distanceYards).toBeNull();
  });

  it('lets a model fill only what the rules left empty', async () => {
    const scored = await parseAsk('I made a 5', {
      model: { async complete() { return { distanceYards: 165, command: { kind: 'score', strokes: 9 } }; } },
    });
    expect(scored.command).toEqual({ kind: 'score', strokes: 5 });
    expect(scored.distanceYards).toBeNull();
    expect(scored.usedModel).toBe(false);

    const filled = await parseAsk('the thick stuff, bunker left', {
      model: { async complete() { return { lie: 'rough', question: 'club', distanceYards: 140, hazards: [{ kind: 'water', side: 'right' }] }; } },
    });
    expect(filled.lie).toBe('rough');
    expect(filled.question).toBe('club');
    expect(filled.distanceYards).toBe(140);
    expect(hazardLabel(filled)).toBe('bunker L');
    expect(filled.usedModel).toBe(true);
  });
});

describe('lie estimate and the caddie line', () => {
  it('documents a conservative rough and sand table and leaves tee and fairway alone', () => {
    expect(lieEstimateYards('rough', 99)).toBe(4);
    expect(lieEstimateYards('rough', 165)).toBe(6);
    expect(lieEstimateYards('rough', 170)).toBe(8);
    expect(lieEstimateYards('sand', 30)).toBe(6);
    expect(lieEstimateYards('sand', 80)).toBe(10);
    expect(lieEstimateYards('sand', 140)).toBe(14);
    expect(lieEstimateYards('fairway', 165)).toBe(0);
    expect(lieEstimateYards('tee', 200)).toBe(0);
    expect(lieEstimateYards('green', 10)).toBe(0);
    expect(lieEstimateYards(null, 165)).toBeNull();
  });

  it('calls a longer club from the rough and labels the yards an estimate', () => {
    const fairway = answerAsk({ intent: { language: 'en', distanceYards: 160, lie: 'fairway', hazards: [], question: 'club', command: null, usedModel: false }, gpsYards: 200, profiles: irons });
    const rough = answerAsk({
      intent: { language: 'en', distanceYards: 160, lie: 'rough', hazards: [{ kind: 'bunker', side: 'left' }], question: 'club', command: null, usedModel: false },
      gpsYards: 200,
      profiles: irons,
    });
    expect(fairway.distanceSource).toBe('spoken');
    expect(fairway.clubLabel).toBe('7-iron');
    expect(fairway.estimate).toBe(false);
    expect(rough.clubLabel).toBe('6-iron');
    expect(rough.lieEstimateYards).toBe(6);
    expect(rough.estimate).toBe(true);
    expect(rough.line).toMatch(/6-iron/);
    expect(rough.line).toMatch(/Rough takes 6 yards, an estimate/);
    expect(rough.line).toMatch(/Favor the right, away from the bunker/);
    expect(rough.chips.map((chip) => chip.label)).toEqual(['160', 'rough', 'bunker L']);
  });

  it('uses the phone when he does not state a distance, and states one when he does', () => {
    const fromPhone = answerAsk({
      intent: { language: 'en', distanceYards: null, lie: 'fairway', hazards: [], question: 'club', command: null, usedModel: false },
      gpsYards: 160,
      profiles: irons,
    });
    expect(fromPhone.distanceSource).toBe('gps');
    expect(fromPhone.clubLabel).toBe('7-iron');
    const neither = answerAsk({
      intent: { language: 'en', distanceYards: null, lie: null, hazards: [], question: 'club', command: null, usedModel: false },
      gpsYards: null,
      profiles: irons,
    });
    expect(neither.distanceYards).toBeNull();
    expect(neither.clubLabel).toBeNull();
    expect(neither.line).toBe('No distance yet.');
  });

  it('keeps a sand shot inside the wedge matrix and does not borrow a full swing', () => {
    const answer = answerAsk({
      intent: { language: 'en', distanceYards: 30, lie: 'sand', hazards: [], question: 'club', command: null, usedModel: false },
      gpsYards: null,
      wedges: [{ clubId: 'sw', clubLabel: 'sand wedge', length: 'full', carryYards: 36 }],
    });
    expect(answer.lieEstimateYards).toBe(6);
    expect(answer.clubLabel).toMatch(/sand wedge/);
    expect(answer.line).toMatch(/estimate/);
    expect(answer.line).not.toMatch(/7-iron|6-iron/);
  });

  it('says plays-like is blank until the three inputs exist', () => {
    const blank = answerAsk({
      intent: { language: 'en', distanceYards: null, lie: null, hazards: [], question: 'plays_like', command: null, usedModel: false },
      gpsYards: 160,
      headwindMph: 10,
    });
    expect(blank.playsLikeYards).toBeNull();
    expect(blank.line).toMatch(/stays blank/);
    const known = answerAsk({
      intent: { language: 'en', distanceYards: 160, lie: null, hazards: [], question: 'plays_like', command: null, usedModel: false },
      gpsYards: 400,
      headwindMph: 0,
      elevationFeet: 0,
      temperatureF: 75,
    });
    expect(known.distanceSource).toBe('spoken');
    expect(known.playsLikeYards).toBe(160);
    expect(known.line).toMatch(/Plays like 160/);
  });

  it('does not invent a club on the green or a carry line for a lay-up', () => {
    const green = answerAsk({
      intent: { language: 'en', distanceYards: 8, lie: 'green', hazards: [], question: 'club', command: null, usedModel: false },
      gpsYards: null,
      profiles: irons,
    });
    expect(green.clubLabel).toBeNull();
    expect(green.line).toMatch(/No full swing/);
    const layup = answerAsk({
      intent: { language: 'en', distanceYards: 160, lie: null, hazards: [], question: 'layup', command: null, usedModel: false },
      gpsYards: null,
      carry: null,
      carryToClearYards: null,
    });
    expect(layup.line).toMatch(/No measured carry/);
    expect(layup.clubLabel).toBeNull();
  });

  it('cycles a chip without typing and keeps the corrected lie on the next line', () => {
    const start = {
      language: 'en' as const,
      distanceYards: 165,
      lie: 'rough' as const,
      hazards: [{ kind: 'bunker' as const, side: 'left' as const }],
      question: 'club' as const,
      command: null,
      usedModel: false,
    };
    const sand = cycleAskChip(start, 'lie');
    expect(sand.lie).toBe('sand');
    const closer = cycleAskChip(start, 'distance', -1);
    expect(closer.distanceYards).toBe(160);
    const right = cycleAskChip(start, 'hazard:0');
    expect(right.hazards[0]?.side).toBe('right');
    const answer = answerAsk({ intent: sand, gpsYards: null, profiles: irons });
    expect(answer.line).toMatch(/Sand takes/);
    expect(answer.estimate).toBe(true);
  });
});

describe('voice transcription', () => {
  it('returns the canned transcript when there is no key and does not echo the audio', async () => {
    const secret = 'abc123audiobytes';
    const body = new TextEncoder().encode(JSON.stringify({ audioBase64: secret, mediaType: 'audio/m4a' }));
    const result = await handleVoiceBuffer(body, null, {});
    expect(result.status).toBe(200);
    if (!('transcript' in result.body)) throw new Error('expected a transcript');
    expect(result.body.transcript).toBe(SAMPLE_VOICE_TRANSCRIPT);
    expect(result.body.mode).toBe('sample');
    expect(result.body.heard).toBe(false);
    expect(result.body.audioRetained).toBe(false);
    expect(JSON.stringify(result.body).includes(secret)).toBe(false);
    expect(body.every((byte) => byte === 0)).toBe(true);
  });

  it('sends audio to Scribe only with a key and refuses to return those bytes', async () => {
    let sawKey = false;
    let sawModel = false;
    const secret = 'echo-me-not-audio';
    const denied = await handleVoiceRequest({
      authorization: 'Bearer wrong',
      payload: { audioBase64: secret },
      env: { EXTRACT_TOKEN: 'right', ELEVENLABS_API_KEY: 'server-key' },
    });
    expect(denied.status).toBe(401);

    const live = await handleVoiceRequest({
      authorization: 'Bearer right',
      payload: { audioBase64: Buffer.from('clip').toString('base64'), mediaType: 'audio/m4a' },
      env: { EXTRACT_TOKEN: 'right', ELEVENLABS_API_KEY: 'server-key', ELEVENLABS_STT_MODEL: 'scribe_v1' },
      fetchImpl: async (_url, init) => {
        sawKey = init.headers['xi-api-key'] === 'server-key';
        sawModel = String(init.body).includes('scribe_v1') || init.body instanceof FormData;
        return { ok: true, status: 200, json: async () => ({ text: '150 out' }) };
      },
    });
    expect(sawKey).toBe(true);
    expect(sawModel).toBe(true);
    if (!('transcript' in live.body)) throw new Error('expected a transcript');
    expect(live.body.mode).toBe('live');
    expect(live.body.heard).toBe(true);
    expect(live.body.transcript).toBe('150 out');

    const clip = Buffer.from('clip-secret').toString('base64');
    const leaked = await handleVoiceRequest({
      authorization: null,
      payload: { audioBase64: clip },
      env: { ELEVENLABS_API_KEY: 'server-key' },
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ text: clip }) }),
    });
    expect(leaked.status).toBe(500);
    expect(JSON.stringify(leaked.body).includes(clip)).toBe(false);
  });
});
