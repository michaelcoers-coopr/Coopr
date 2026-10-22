import { describe, expect, it } from 'vitest';
import {
  SAMPLE_PHOTO_PAYLOAD,
  buildPhotoReview,
  confirmedPhotoImport,
  handleExtractBuffer,
  handleExtractRequest,
  parsePhotoExtraction,
  refreshReviewItem,
  reportedDistanceProfile,
  samplePhotoExtraction,
} from '@coopr/engine';

describe('photo extraction parsing', () => {
  it('drops unreadable fields and does not copy carry into total', () => {
    const parsed = parsePhotoExtraction({
      kind: 'launch_monitor',
      sourceApp: 'TrackMan',
      capturedOn: '2026-10-01',
      shots: [
        {
          club: '7-iron',
          clubConfidence: 'high',
          carry: 158,
          carryConfidence: 'high',
          total: 170,
          totalConfidence: 'unreadable',
          side: null,
          sideConfidence: 'unreadable',
        },
      ],
    });
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.shots[0]?.carry).toBe(158);
    expect(parsed.shots[0]?.total).toBeNull();
    expect(parsed.shots[0]?.side).toBeNull();
    expect(parsed.readFromImage).toBe(false);
    expect(parsed.imageRetained).toBe(false);
    expect(parsed.notes.some((note) => note.includes('unreadable'))).toBe(true);
  });

  it('drops a number outside a believable range and a date that is not YYYY-MM-DD', () => {
    const parsed = parsePhotoExtraction({
      kind: 'not-a-kind',
      capturedOn: 'Oct 1',
      shots: [{ club: 'Driver', clubConfidence: 'high', carry: 900, carryConfidence: 'high', total: 0, totalConfidence: 'high' }],
      holes: [{ hole: 1, par: 9, strokeIndex: 0, yardage: 900, strokes: 0 }],
    });
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.kind).toBe('unknown');
    expect(parsed.capturedOn).toBeNull();
    expect(parsed.shots[0]?.carry).toBeNull();
    expect(parsed.shots[0]?.total).toBeNull();
    expect(parsed.holes[0]?.par).toBeNull();
    expect(parsed.holes[0]?.strokes).toBeNull();
    expect(parsed.notes.join(' ')).toMatch(/YYYY-MM-DD/);
    expect(parsed.notes.join(' ')).toMatch(/outside a believable range/);
  });

  it('keeps an unknown sample size null', () => {
    const parsed = parsePhotoExtraction(SAMPLE_PHOTO_PAYLOAD);
    if ('error' in parsed) throw new Error(parsed.error);
    const eight = parsed.reported.find((row) => row.club === '8-iron');
    expect(eight?.sampleSize).toBeNull();
    expect(eight?.metric).toBe('total');
    expect(parsed.clubs[0]?.shaft).toBeNull();
  });
});

describe('photo review and dedupe', () => {
  it('blocks an ambiguous metric until the user chooses carry or total', () => {
    const extraction = samplePhotoExtraction();
    const items = buildPhotoReview(extraction);
    const ambiguous = items.find((item) => item.id === 'reported-1');
    expect(ambiguous?.metric).toBeNull();
    expect(ambiguous?.include).toBe(false);
    expect(ambiguous?.blockedReason).toMatch(/carry or total/);
    const saved = confirmedPhotoImport([{ ...ambiguous!, include: true }]);
    expect('error' in saved).toBe(true);

    const chosen = refreshReviewItem(ambiguous!, { metric: 'carry' });
    expect(chosen.blockedReason).toBeNull();
    expect(chosen.include).toBe(true);
    expect(chosen.yards).toBe(170);
    const confirmed = confirmedPhotoImport(items.map((item) => (item.id === chosen.id ? chosen : item)));
    if ('error' in confirmed) throw new Error(confirmed.error);
    expect(confirmed.reported[0]?.metric).toBe('carry');
    expect(confirmed.reported[0]?.yards).toBe(170);
    expect(confirmed.shots.find((shot) => shot.clubLabel === '7-iron')?.total).toBeNull();
    expect(confirmed.shots.find((shot) => shot.clubLabel === '7-iron')?.carry).toBe(158);
    expect(confirmed.shots.some((shot) => shot.clubLabel === 'Driver')).toBe(false);
  });

  it('leaves a duplicate unchecked and matches only when every printed distance agrees', () => {
    const extraction = samplePhotoExtraction();
    extraction.sourceApp = '18Birdies';
    const items = buildPhotoReview(extraction, {
      shots: [{ clubLabel: '7-iron', carry: 200, total: null }],
      reported: [{ sourceApp: '18Birdies', clubLabel: '8-iron', metric: 'total', yards: 145 }],
      scores: [{ courseName: 'Sample course', hole: 1, strokes: 5 }],
      clubs: [{ brand: 'Sample', model: 'Blade', loft: 34 }],
    });
    const shot = items.find((item) => item.id === 'shot-1');
    expect(shot?.duplicateReason).toBeNull();
    expect(shot?.include).toBe(true);
    const carryOnly = buildPhotoReview(extraction, {
      shots: [{ clubLabel: '7-iron', carry: 158, total: 170 }],
      reported: [],
      scores: [],
      clubs: [],
    });
    expect(carryOnly[0]?.duplicateReason).toMatch(/Already on this phone/);
    expect(carryOnly[0]?.include).toBe(false);
    const disagreedTotal = buildPhotoReview(
      {
        ...extraction,
        shots: [{ ...extraction.shots[0]!, total: 180, totalConfidence: 'high' }],
      },
      { shots: [{ clubLabel: '7-iron', carry: 158, total: 170 }], reported: [], scores: [], clubs: [] },
    );
    expect(disagreedTotal[0]?.duplicateReason).toBeNull();
    expect(items.find((item) => item.id === 'reported-2')?.duplicateReason).toMatch(/reported total/);
    expect(items.find((item) => item.id === 'score-1')?.include).toBe(false);
    expect(items.find((item) => item.id === 'club-1')?.include).toBe(false);
  });

  it('labels the sample fixture as unread', () => {
    const sample = samplePhotoExtraction();
    expect(sample.readFromImage).toBe(false);
    expect(sample.imageRetained).toBe(false);
    expect(sample.mode).toBe('stub');
    expect(sample.notes.join(' ')).toMatch(/No photo was read/);
  });

  it('builds a reported profile with no measured dispersion', () => {
    const profile = reportedDistanceProfile({
      clubLabel: '8-iron',
      metric: 'total',
      yards: 145,
      sampleSize: 12,
      environment: 'course',
      sourceApp: 'Arccos',
    });
    expect(profile.reported).toBe(true);
    expect(profile.dispersionKnown).toBe(false);
    expect(profile.sampleSize).toBe(12);
    expect(profile.sampleWarning).toMatch(/Their reported number/);
    expect(profile.sampleWarning).toMatch(/Arccos/);
  });
});

describe('extract endpoint', () => {
  it('answers with the stub and wipes the image buffer when no key is set', async () => {
    const secret = 'abc123photobytes';
    const body = Buffer.from(JSON.stringify({ imageBase64: secret, mediaType: 'image/jpeg' }));
    const result = await handleExtractBuffer(body, null, {});
    expect(result.status).toBe(200);
    expect(body.every((byte) => byte === 0)).toBe(true);
    expect(JSON.stringify(result.body).includes(secret)).toBe(false);
    if ('mode' in result.body) {
      expect(result.body.readFromImage).toBe(false);
      expect(result.body.imageRetained).toBe(false);
      expect(result.body.notes.join(' ')).toMatch(/not read/);
    }
  });

  it('refuses a bad token and refuses to echo the image', async () => {
    const denied = await handleExtractRequest({
      authorization: 'Bearer wrong',
      payload: { imageBase64: 'pixels' },
      env: { EXTRACT_TOKEN: 'right' },
    });
    expect(denied.status).toBe(401);

    const secret = 'echo-me-not';
    const leaked = await handleExtractRequest({
      authorization: null,
      payload: { imageBase64: secret },
      env: { EXTRACT_MODE: 'live', COOPR_VISION_API_KEY: 'server-key' },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ notes: [secret], shots: [] }) } }] }),
      }),
    });
    expect(leaked.status).toBe(200);
    const buffer = Buffer.from(JSON.stringify({ imageBase64: secret }));
    const refused = await handleExtractBuffer(buffer, null, { EXTRACT_MODE: 'live', COOPR_VISION_API_KEY: 'server-key' }, async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ notes: [secret] }) } }] }),
    }));
    expect(refused.status).toBe(500);
    if ('error' in refused.body) expect(refused.body.error).toMatch(/Refusing to return the image/);
    expect(JSON.stringify(refused.body).includes(secret)).toBe(false);
  });

  it('parses a live model response without inventing a missing total', async () => {
    let sentImage = false;
    const result = await handleExtractRequest({
      authorization: 'Bearer session',
      payload: { imageBase64: 'live-pixels', mediaType: 'image/png' },
      env: { EXTRACT_MODE: 'live', EXTRACT_TOKEN: 'session', COOPR_VISION_API_KEY: 'server-key', COOPR_VISION_MODEL: 'test-model' },
      fetchImpl: async (_url, init) => {
        sentImage = init.body.includes('live-pixels');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    kind: 'launch_monitor',
                    sourceApp: 'TrackMan',
                    capturedOn: '2026-04-02',
                    shots: [
                      {
                        club: 'Driver',
                        clubConfidence: 'high',
                        carry: 240,
                        carryConfidence: 'high',
                        total: null,
                        totalConfidence: 'unreadable',
                        side: 3,
                        sideConfidence: 'low',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        };
      },
    });
    expect(sentImage).toBe(true);
    expect(result.status).toBe(200);
    if (!('shots' in result.body)) throw new Error('expected an extraction');
    expect(result.body.readFromImage).toBe(true);
    expect(result.body.imageRetained).toBe(false);
    expect(result.body.mode).toBe('live');
    expect(result.body.shots[0]?.carry).toBe(240);
    expect(result.body.shots[0]?.total).toBeNull();
    expect(JSON.stringify(result.body).includes('live-pixels')).toBe(false);
  });
});
