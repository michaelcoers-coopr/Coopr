import { describe, expect, it } from 'vitest';
import { scoreRound } from '@coopr/engine';
import { parseRoundSave } from '../src/round-save';

function save(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    holes: [6, null, null, 6, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    currentHole: 4,
    manualYards: { 1: 210, 3: -5, 4: 0 },
    tagged: [
      { id: 'tag-1', hole: 1, clubId: 'driver', clubLabel: 'Driver', result: 'fairway', shownYards: 210, carry: null, total: null },
      { id: 'bad', hole: 1, clubId: 'driver', clubLabel: 'Driver', result: 'fairway', shownYards: 210, carry: -4, total: null },
    ],
    debriefs: [
      { hole: 1, choice: 'swing', note: 'Hole 1 was 1 over par. You called it the swing. The score was not changed.' },
      { hole: 4, choice: 'plan', note: 'Hole 4 was 2 over par. You called it the plan. The score was not changed.' },
    ],
    wedges: { miura56: { half: 20, full: 0, three_quarter: 40 } },
    unit: 'yd',
    plans: { 1: { clubLabel: 'Driver', target: 'Left center' } },
    localShots: [],
    ...patch,
  });
}

describe('round save', () => {
  it('keeps scores, drops bad yardages, and keeps every debrief', () => {
    const round = parseRoundSave(save());
    expect(round?.holes[0]).toBe(6);
    expect(round?.holes[3]).toBe(6);
    expect(round?.currentHole).toBe(4);
    expect(round?.manualYards).toEqual({ 1: 210 });
    expect(round?.tagged).toHaveLength(1);
    expect(round?.tagged[0]?.carry).toBeNull();
    expect(round?.debriefs.map((item) => item.hole)).toEqual([1, 4]);
    expect(round?.wedges.miura56).toEqual({ half: 20, three_quarter: 40 });
    expect(round?.plans['1']?.target).toBe('Left center');
    expect(round?.holes).not.toContain(0);
    expect(round?.putts.every((putt) => putt == null)).toBe(true);
    expect(round?.conditions.usePlaysLike).toBe(false);
    expect(round?.conditions.wind).toBe('');
  });

  it('keeps a chip-in putt and the round conditions without adding putts to the gross', () => {
    const round = parseRoundSave(
      save({
        putts: [0, 2, -1, 1.5, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        conditions: { wind: '8', windChoice: 'head', elevation: '12', elevationChoice: 'up', temperature: '59', usePlaysLike: true },
      }),
    );
    expect(round?.putts[0]).toBe(0);
    expect(round?.putts[1]).toBe(2);
    expect(round?.putts[2]).toBeNull();
    expect(round?.putts[3]).toBeNull();
    expect(round?.conditions).toEqual({
      wind: '8',
      windChoice: 'head',
      elevation: '12',
      elevationChoice: 'up',
      temperature: '59',
      usePlaysLike: true,
    });
    const messy = parseRoundSave(save({ putts: [4], conditions: { wind: 'breezy', windChoice: 'gale', usePlaysLike: 'yes' } }));
    expect(messy?.putts.every((putt) => putt == null)).toBe(true);
    expect(messy?.conditions).toEqual({
      wind: '',
      windChoice: null,
      elevation: '',
      elevationChoice: null,
      temperature: '',
      usePlaysLike: false,
    });
    const gross = scoreRound(
      (round?.holes ?? []).flatMap((strokes, index) => (strokes == null ? [] : [{ hole: index + 1, strokes }])),
    );
    expect(gross.gross).toBe(12);
    expect(gross.gross).not.toBe(14);
  });

  it('refuses a scorecard that is not 18 holes or has a zero', () => {
    expect(parseRoundSave(null)).toBeNull();
    expect(parseRoundSave('{')).toBeNull();
    expect(parseRoundSave(save({ version: 2 }))).toBeNull();
    expect(parseRoundSave(save({ holes: [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] }))).toBeNull();
    expect(parseRoundSave(save({ currentHole: 19 }))).toBeNull();
    expect(parseRoundSave(save({ unit: 'feet' }))).toBeNull();
  });
});