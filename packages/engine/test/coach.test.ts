import { describe, it, expect } from 'vitest';
import { seedShots, seedClubs, seedClubFeedback, MIURA_48_AGGREGATE, VALIDATION_REQUIRED_SESSIONS } from '@coopr/core';
import type { CoachContext } from '@coopr/core';
import { buildAllProfiles } from '../src/club-profile';
import { analyzeBag } from '../src/bag-intelligence';
import { assessGolfIq } from '../src/golf-iq';
import { askCoach } from '../src/coach';

const profiles = buildAllProfiles(seedShots, { validationRequiredSessions: VALIDATION_REQUIRED_SESSIONS });
const ctx: CoachContext = {
  clubs: seedClubs,
  profiles,
  bag: analyzeBag({
    profiles,
    clubs: seedClubs,
    knownDistances: [{ clubId: 'c-w48', clubLabel: '48°', carryYards: MIURA_48_AGGREGATE.usableStrikeAverageCarry, source: 'aggregate' }],
    feedback: seedClubFeedback.map((f) => ({ clubId: f.clubId, confidence: f.confidence, note: f.note })),
  }),
  assessment: assessGolfIq(profiles, seedClubs),
};

describe('Ask COOPR coach (deterministic, grounded)', () => {
  it('routes practice questions to ranked priorities', () => {
    const a = askCoach('what should I work on?', ctx);
    expect(a.topic).toBe('practice');
    expect(a.bullets.length).toBeGreaterThan(0);
    expect(a.grounded).toBe(true);
  });

  it('answers a club distance from the profile, not a guess', () => {
    const a = askCoach('how far do I hit my 7 iron?', ctx);
    expect(a.topic).toBe('club_distance');
    expect(a.title.toLowerCase()).toContain('7i');
    expect(a.paragraphs.join(' ')).toMatch(/15[0-9]|16[0-9]/); // ~154 stock
  });

  it('gives equipment direction from bag intelligence and flags the online piece', () => {
    const a = askCoach('what equipment should I get?', ctx);
    expect(a.topic).toBe('equipment');
    expect(a.paragraphs.join(' ').toLowerCase()).toContain('research');
  });

  it('surfaces bag gaps and overlaps', () => {
    const a = askCoach("what's wrong with my bag?", ctx);
    expect(a.topic).toBe('bag');
    expect(a.bullets.length).toBeGreaterThan(0);
  });

  it('summarizes the game overall from the assessment', () => {
    const a = askCoach("how's my game overall?", ctx);
    expect(a.topic).toBe('overview');
    expect(a.paragraphs.join(' ')).toContain(String(ctx.assessment.overallScore));
  });

  it('falls back to help with suggestions for unknown questions', () => {
    const a = askCoach('what is the meaning of life', ctx);
    expect(a.topic).toBe('help');
    expect(a.followUps.length).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(askCoach('what should I work on?', ctx))).toBe(
      JSON.stringify(askCoach('what should I work on?', ctx)),
    );
  });
});
