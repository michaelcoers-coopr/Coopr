import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardGravity, carryChipLine, CLOSED_CARD, clubDetail, clubFigure, closedPlaySheet, clubWhy, foldInset, foldSnap, greenMarkLabel, holeEnter, holeFrame, holeShift, hudChips, mapHudInset, patternCaption, samplePatternVisible, scoreCommit, scoreDrag, scoreGlance, scoreGlow, sheetSnap, shotReadout, SHOT_LOG_TIP } from '../src/design/play-polish';
import { dispersionOval, PATTERN_INVITE, SAMPLE_PATTERN } from '@coopr/engine';

describe('one shot readout', () => {
  it('uses the rounded plays-like, and hides adjustments and the sample when there is no position', () => {
    expect(shotReadout(478.6, 476)).toBe(479);
    expect(shotReadout(null, 476.2)).toBe(476);
    expect(shotReadout(null, null)).toBeNull();
    expect(hudChips(false, { wind: 'Wind +5.5', elevation: 'Elev +1', temperature: 'Temp \u22125.4' })).toEqual({
      wind: 'Wind ?',
      elevation: 'Elev ?',
      temperature: 'Temp ?',
    });
    expect(hudChips(true, { wind: 'Wind +5.5', elevation: 'Elev +1', temperature: 'Temp \u22125.4' }).wind).toBe('Wind +5.5');
    expect(samplePatternVisible({ sampleOn: true, hasFix: false, measured: true })).toBe(false);
    expect(samplePatternVisible({ sampleOn: true, hasFix: true, measured: true })).toBe(true);
    expect(samplePatternVisible({ sampleOn: true, hasFix: true, measured: false })).toBe(false);
    expect(carryChipLine(186, true)).toBe('186 CARRY\nSample');
    expect(carryChipLine(186.4, false)).toBe('186 CARRY');
    expect(carryChipLine(null, true)).toBeNull();
    expect(carryChipLine(Number.NaN, true)).toBeNull();
  });
});

describe('club card copy', () => {
  it('quotes the card club in the details, not a closer club that was left out', () => {
    const detail = clubDetail({ clubLabel: '7-iron', metric: 'total', stockYards: 154, targetYards: 163, unit: 'yd' });
    expect(detail.gap).toBe('9 yards short.');
    expect(detail.median).toBe('7-iron total median is 154.');
    expect(`${detail.gap} ${detail.median}`).not.toMatch(/5-iron/);
    const card = 'Short is dead. 7-iron is 9 yards short of 163.';
    expect(card).toMatch(/7-iron/);
    expect(detail.median).toMatch(/7-iron/);
  });

  it('shows plays-like on the card and leaves a live GPS number off it', () => {
    expect(clubFigure(154, 160, true)).toEqual({ label: 'Plays like', yards: 154 });
    expect(clubFigure(null, 160, true)).toBeNull();
    expect(clubFigure(null, 160, false)).toEqual({ label: 'Shot', yards: 160 });
    expect(clubFigure(null, null, false)).toBeNull();
  });

  it('says the gap in plain words and does not invent one', () => {
    expect(
      clubWhy({ layupReason: 'Lay up short of the hazard.', stockYards: 170, targetYards: 160, playsLike: true, unit: 'yd' }),
    ).toBe('Lay up short of the hazard.');
    expect(clubWhy({ layupReason: null, stockYards: 170, targetYards: 164, playsLike: true, unit: 'yd' })).toBe('6 yards long.');
    expect(clubWhy({ layupReason: null, stockYards: 163.4, targetYards: 163.2, playsLike: false, unit: 'm' })).toBe('Dead on your number.');
    expect(clubWhy({ layupReason: null, stockYards: 163, targetYards: 164, playsLike: false, unit: 'm' })).toBe('1 meter short.');
    expect(clubWhy({ layupReason: null, stockYards: null, targetYards: 160, playsLike: true, unit: 'yd' })).toBeNull();
    expect(clubWhy({ layupReason: '  ', stockYards: 150, targetYards: 150, playsLike: true, unit: 'yd' })).toBe('Dead on your number.');
    expect(clubWhy({ layupReason: null, stockYards: 170, targetYards: 164, playsLike: true, unit: 'yd' })).not.toMatch(/plays-like/i);
  });
});

describe('score glance', () => {
  it('rewards a confirmed par or birdie and leaves the grey default still', () => {
    expect(scoreGlance(4, 4, false)).toEqual({ motion: null, name: null, versus: null });
    expect(scoreGlance(4, 4, true)).toEqual({ motion: 'par', name: 'Par', versus: 'E' });
    expect(scoreGlance(3, 4, true)).toEqual({ motion: 'birdie', name: 'Birdie', versus: '-1' });
    expect(scoreGlance(2, 4, true)).toEqual({ motion: 'birdie', name: 'Eagle', versus: '-2' });
    expect(scoreGlance(1, 4, true)).toEqual({ motion: 'birdie', name: null, versus: '-3' });
    expect(scoreGlance(5, 4, true)).toEqual({ motion: null, name: null, versus: '+1' });
    expect(scoreGlance(null, 4, true).versus).toBeNull();
    expect(scoreGlow('birdie')).toBe('#C8102E');
    expect(scoreGlow('par')).toBe('#FFFFFF');
    expect(scoreGlow(null)).toBeNull();
  });
});

describe('map inset', () => {
  it('keeps a compact HUD and lets the score bar float without moving the hole', () => {
    const inset = mapHudInset(0);
    const floating = holeFrame({ hudHeight: inset, dockHeight: 0, sheetClosed: CLOSED_CARD });
    const measured = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 96, sheetClosed: CLOSED_CARD });
    expect(measured).toEqual(floating);
    expect(mapHudInset(0)).toBe(72);
    expect(mapHudInset(47)).toBe(119);
    expect(mapHudInset(Number.NaN)).toBe(72);
    expect(floating.top).toBeLessThanOrEqual(180);
    const open = 844 - floating.top - floating.bottom;
    expect(open).toBeGreaterThan(844 * 0.55);
  });
});

describe('club card without shots', () => {
  it('hides the sample caption and keeps the sheet height fixed', () => {
    const oval = dispersionOval([...SAMPLE_PATTERN]);
    expect(oval).not.toBeNull();
    expect(
      patternCaption({ onGreen: false, noShots: true, lowConfidence: false, sample: true, oval, invite: PATTERN_INVITE }),
    ).toBeNull();
    expect(
      patternCaption({ onGreen: false, noShots: false, lowConfidence: false, sample: true, oval, invite: PATTERN_INVITE }),
    ).toBe(`Sample pattern · ±${oval!.carryStdYards} × ±${oval!.lateralStdYards} yd`);
    expect(patternCaption({ onGreen: false, noShots: false, lowConfidence: true, sample: false, oval: null, invite: PATTERN_INVITE })).toBeNull();
    expect(patternCaption({ onGreen: false, noShots: false, lowConfidence: false, sample: false, oval: null, invite: PATTERN_INVITE, thinLine: true })).toBeNull();
    expect(
      patternCaption({ onGreen: false, noShots: false, lowConfidence: false, sample: true, oval, invite: PATTERN_INVITE, thinLine: true }),
    ).toBe(`Sample pattern · ±${oval!.carryStdYards} × ±${oval!.lateralStdYards} yd`);
    expect(CLOSED_CARD).toBeGreaterThanOrEqual(108);
    expect(CLOSED_CARD).toBeLessThanOrEqual(124);
    expect(SHOT_LOG_TIP).toBe('Log a shot after each swing, or upload a TrackMan photo');
    expect(greenMarkLabel('Front', '144', 'yd')).toBe('Front, 144 yards');
    expect(greenMarkLabel('Center', '150.5', 'm')).toBe('Center, 150.5 meters');
    expect(greenMarkLabel('Back', null, 'yd')).toBe('Back');
    expect(greenMarkLabel('Back', '—', 'yd')).toBe('Back');
    expect(
      patternCaption({ onGreen: false, noShots: false, lowConfidence: false, sample: false, oval: null, invite: PATTERN_INVITE, emptyBag: true }),
    ).toBeNull();
    const play = readFileSync(new URL('../app/play.tsx', import.meta.url), 'utf8');
    expect(play).toContain('emptyBag: bagEmpty');
    expect(play).toContain('!bagEmpty && patternLine');
    expect(cardGravity(true)).toBe('center');
    expect(cardGravity(false)).toBe('flex-start');
    const sheet = closedPlaySheet(200);
    expect(sheet).toBe(200);
    expect(closedPlaySheet(200)).toBe(sheet);
    const withShots = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 80, sheetClosed: sheet });
    const noShots = holeFrame({ hudHeight: mapHudInset(0), dockHeight: 80, sheetClosed: closedPlaySheet(200) });
    expect(noShots).toEqual(withShots);
  });
});

describe('hole entrance', () => {
  it('slides the map farther than the sheet', () => {
    expect(holeShift(3, 4)).toBe('forward');
    expect(holeShift(4, 3)).toBe('back');
    expect(holeShift(4, 4)).toBe('none');
    expect(holeEnter('forward')).toEqual({ map: 108, sheet: 20 });
    expect(holeEnter('back')).toEqual({ map: -108, sheet: -20 });
    expect(Math.abs(holeEnter('forward').map)).toBeGreaterThan(Math.abs(holeEnter('forward').sheet));
    expect(holeEnter('none')).toEqual({ map: 0, sheet: 0 });
    expect(Math.abs(holeEnter('forward').sheet)).toBeLessThan(Math.abs(holeEnter('forward').map));
  });
});

describe('one-thumb score', () => {
  it('treats a short press as keep, an upward drag as one more stroke, and a sideways drag as not a score', () => {
    expect(scoreDrag(4, 2)).toBe('tap');
    expect(scoreDrag(-40, 6)).toBe('up');
    expect(scoreDrag(40, 6)).toBe('down');
    expect(scoreDrag(-12, 48)).toBeNull();
    expect(scoreDrag(Number.NaN, 0)).toBeNull();
    expect(scoreCommit(5, 'tap', 1)).toBe(5);
    expect(scoreCommit(5, 'up', 1)).toBe(6);
    expect(scoreCommit(1, 'down', 1)).toBe(1);
    expect(scoreCommit(0, 'down', 0)).toBe(0);
  });

  it('opens the club sheet on an upward swipe and leaves a short drag alone', () => {
    expect(sheetSnap(false, -64, 0)).toBe(true);
    expect(sheetSnap(true, 64, 0)).toBe(false);
    expect(sheetSnap(false, -8, -0.9)).toBe(true);
    expect(sheetSnap(true, 8, 0)).toBe(true);
    expect(sheetSnap(false, Number.NaN, 0)).toBe(false);
  });

  it('raises a cut paragraph to the gap above it and leaves a clear edge alone', () => {
    expect(foldSnap([{ top: 700, bottom: 716 }], 713)).toBe(11);
    expect(foldSnap([{ top: 100, bottom: 140 }], 200)).toBe(0);
    expect(foldSnap([], Number.NaN)).toBe(0);
    expect(foldInset([{ top: 714, bottom: 762 }], 737)).toBe(29);
    expect(foldInset([{ top: 660, bottom: 710 }, { top: 700, bottom: 740 }], 720)).toBe(66);
    expect(foldInset([{ top: 100, bottom: 120 }], 140)).toBe(0);
    expect(foldInset([{ top: 200, bottom: 240 }], 180)).toBe(0);
    expect(foldInset([{ top: 0, bottom: 400 }], 200)).toBe(96);
    expect(foldInset([], Number.NaN)).toBe(0);
  });
});
