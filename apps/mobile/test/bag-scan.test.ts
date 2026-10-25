import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bagGaps, verdict } from '@coopr/engine';
import { KEEP_ANYWAY, NO_SIGNALS, STARTING_POINT } from '../src/bag-scan/copy';
import { cropRect } from '../src/bag-scan/crop';
import {
  canConfirmDraft,
  clubToDraft,
  draftToClub,
  HANDICAP_MAX,
  HANDICAP_MIN,
  holdBody,
  placeClub,
  profileFromFit,
  rangedNumber,
  sanitizeClub,
  sanitizeFit,
  SPEED_MAX,
  SPEED_MIN,
  toFitClub,
  withInPlay,
  withoutClub,
} from '../src/bag-scan/logic';
import { isEphemeralPhotoUri } from '../src/bag-scan/photos';
import { readScanClubs, writeScanClubs } from '../src/bag-scan/persist';
import { shownForFocus } from '../src/bag-scan/resolve';
import { hydrateDevice, resetDeviceForTests, resetDeviceFromStorage } from '../src/device-store';
import { clubPictureKind } from '../src/bag-scan/picture-kind';
import { stubVision } from '../src/bag-scan/vision';
import { blankDraft, EMPTY_FIT, type Focus, type ScanClub } from '../src/bag-scan/types';

const here = dirname(fileURLToPath(import.meta.url));

function read(relative: string): string {
  return readFileSync(join(here, relative), 'utf8');
}

function memoryStorage(): void {
  const map = new Map<string, string>();
  const store = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
}

function club(partial: Partial<ScanClub> & Pick<ScanClub, 'id'>): ScanClub {
  return {
    slot: partial.id,
    inPlay: true,
    brand: null,
    model: null,
    type: 'iron',
    loft: null,
    flex: null,
    ironBuild: null,
    photoUri: null,
    fitAck: null,
    fitAckOn: null,
    clubNumber: null,
    identifiedBy: 'typed',
    ...partial,
  };
}

describe('bag scan', () => {
  it('keeps the sample bag out of the friends bundle', () => {
    const off = read('../src/bag-scan/sample-data-off.ts');
    const metro = read('../metro.config.js');
    expect(off).toContain('SAMPLE_BAG = null');
    expect(off).not.toMatch(/Steelhead|Callaway|98/);
    expect(metro).toContain('sample-data-off.ts');
    expect(metro).toContain("resolved.filePath === sampleOn");
    const beta = read('../eas.json');
    expect(beta).toContain('EXPO_PUBLIC_FOUNDER_TOOLS": "0"');
  });

  it('stubs vision and refuses a guessed type', () => {
    const readResult = stubVision.read('file://club.jpg');
    expect(readResult.brand).toBeNull();
    expect(readResult.model).toBeNull();
    expect(readResult.type).toBeNull();
    expect(readResult.loft).toBeNull();
    expect(readResult.flex).toBeNull();
    expect(readResult.confidence).toBeNull();
    expect(readResult.lines.join(' ')).toContain('not read');
    expect(clubPictureKind('file://me.jpg', null)).toBe('photo');
    expect(clubPictureKind(null, 'iron')).toBe('render');
    expect(clubPictureKind(null, null)).toBe('empty');
    expect(clubPictureKind(null, 'unknown')).toBe('empty');
  });

  it('requires a picked type plus a loft or a number, and leaves blanks null', () => {
    const draft = blankDraft();
    expect(canConfirmDraft(draft)).toBe(false);
    expect(canConfirmDraft({ ...draft, type: 'iron' })).toBe(false);
    expect(canConfirmDraft({ ...draft, type: 'iron', clubNumber: '7' })).toBe(true);
    const saved = draftToClub({ ...draft, type: 'wedge', loftText: '', clubNumber: '56', brand: '  ' }, null, 'id-1');
    expect(saved.brand).toBeNull();
    expect(saved.loft).toBeNull();
    expect(saved.model).toBeNull();
    expect(saved.slot).toBe('56');
    expect(sanitizeClub({ id: 'x', loft: '30', brand: '' })).toMatchObject({ loft: null, brand: null });
  });

  it('sends the 15th club out of play and does not store a sample bag', () => {
    memoryStorage();
    resetDeviceForTests();
    hydrateDevice();
    const existing = Array.from({ length: 14 }, (_, index) => club({ id: `c${index}`, loft: 20 + index }));
    const next = placeClub(existing, club({ id: 'extra', loft: 60 }));
    expect(next.filter((item) => item.inPlay)).toHaveLength(14);
    expect(next.find((item) => item.id === 'extra')?.inPlay).toBe(false);
    writeScanClubs(next);
    expect(readScanClubs()).toHaveLength(15);
    expect(JSON.stringify(readScanClubs())).not.toContain('Steelhead');
    resetDeviceFromStorage();
    expect(readScanClubs()).toHaveLength(15);
    expect(JSON.stringify(readScanClubs())).not.toContain('Steelhead');
    const kept = placeClub(next, { ...next[0]!, brand: 'Kept' });
    expect(kept.find((item) => item.id === 'c0')?.inPlay).toBe(true);
  });

  it('locks the empty signals, the crop line, and a non-shaming hold', () => {
    expect(read('../app/bag/signals.tsx')).toContain(NO_SIGNALS);
    expect(read('../app/bag/scan.tsx')).toContain('Cropping to the clubhead');
    expect(read('../app/bag/hold.tsx')).toContain(KEEP_ANYWAY);
    expect(read('../app/bag/hold.tsx')).toContain('SPONSORED');
    expect(read('../app/bag/card.tsx')).toContain(STARTING_POINT);
    expect(read('../app/bag/add.tsx')).toContain('FACE');
    const empty = profileFromFit({ handicapIndex: null, handicapQuality: null, driverSpeedMph: null, speedQuality: null });
    const one = club({ id: '7', type: 'iron', loft: 30, flex: 'S', ironBuild: 'game-improvement', slot: '7' });
    const result = verdict(toFitClub(one), empty, [toFitClub(one)], { '7': 'game-improvement' });
    expect(result.verdict).toBe('CANT_TELL');
    expect(bagGaps([toFitClub(one)]).median_gap).toBeNull();
    const body = holdBody({
      type: 'iron',
      flex: 'S',
      verdict: result,
      speed: 78,
      speedQuality: 'sample',
      ironMates: 6,
    });
    expect(body).toContain("The club isn't bad");
    expect(body).toContain('Sample driver speed 78 mph');
    expect(body).not.toMatch(/shame|bad club/i);
  });

  it('opens club B after club A for a saved club and a sample club', () => {
    const clubs = [club({ id: 'a', brand: 'Alpha', slot: 'A', loft: 28 }), club({ id: 'b', brand: 'Bravo', slot: 'B', loft: 32 })];
    const open = (focus: Focus, sampleProfile: 'A' | 'B' = 'A') =>
      shownForFocus({ focus, draft: blankDraft(), clubs, fit: EMPTY_FIT, sampleProfile });
    expect(open({ kind: 'saved', id: 'a' })?.club.brand).toBe('Alpha');
    expect(open({ kind: 'saved', id: 'b' })?.club.brand).toBe('Bravo');
    expect(open({ kind: 'saved', id: 'b' })?.club.slot).toBe('B');
    expect(open({ kind: 'sample', id: 'dr' }, 'A')?.club.slot).toBe('DR');
    const sampleIron = open({ kind: 'sample', id: '7i' }, 'B');
    expect(sampleIron?.club.slot).toBe('7I');
    expect(sampleIron?.verdict.verdict).toBe('PROBABLY_NOT');
    const session = read('../src/bag-scan/session.tsx');
    expect(session).toContain('focus,');
    expect(session).not.toContain('focus.kind, notice');
    expect(read('../app/_layout.tsx')).toContain('<BagScanProvider>');
    expect(read('../app/bag/_layout.tsx')).not.toContain('BagScanProvider');
  });

  it('keeps a saved club photo out of picker cache and falls back to the render', () => {
    expect(isEphemeralPhotoUri('blob:http://localhost/abc')).toBe(true);
    expect(isEphemeralPhotoUri('file:///var/mobile/Containers/Data/Application/x/Library/Caches/ImagePicker/club.jpg')).toBe(true);
    expect(isEphemeralPhotoUri('file:///var/mobile/Containers/Data/Application/x/Documents/bag-photos/club.jpg')).toBe(false);
    expect(clubPictureKind('blob:http://localhost/abc', 'iron')).toBe('render');
    expect(clubPictureKind('file:///var/mobile/Containers/Data/Application/x/Documents/bag-photos/club.jpg', 'iron')).toBe('photo');
    const saved = draftToClub({ ...blankDraft(), type: 'iron', clubNumber: '7', facePhotoUri: 'blob:http://localhost/abc' }, null, 'id-photo');
    expect(saved.photoUri).toBeNull();
    expect(read('../src/bag-scan/photos.ts')).toContain('documentDirectory');
    expect(read('../src/bag-scan/photos.ts')).toContain('bag-photos');
    const rect = cropRect(1000, 500);
    expect(rect).toEqual({ originX: 140, originY: 75, width: 720, height: 350 });
    expect(read('../app/bag/scan.tsx')).toContain('Cropping to the clubhead');
    expect(read('../app/bag/scan.tsx')).toContain('keepFacePhoto');
  });

  it('rejects a handicap, driver speed, or loft outside the starting range', () => {
    expect(rangedNumber('', HANDICAP_MIN, HANDICAP_MAX).value).toBeNull();
    expect(rangedNumber('14', HANDICAP_MIN, HANDICAP_MAX).value).toBe(14);
    expect(rangedNumber('-10', HANDICAP_MIN, HANDICAP_MAX).value).toBe(-10);
    expect(rangedNumber('55', HANDICAP_MIN, HANDICAP_MAX).problem).toBeTruthy();
    expect(rangedNumber('39', SPEED_MIN, SPEED_MAX).problem).toBeTruthy();
    expect(rangedNumber('140', SPEED_MIN, SPEED_MAX).value).toBe(140);
    expect(rangedNumber('Infinity', SPEED_MIN, SPEED_MAX).problem).toBeTruthy();
    expect(canConfirmDraft({ type: 'driver', loftText: '4', clubNumber: '' })).toBe(false);
    expect(canConfirmDraft({ type: 'driver', loftText: '10.5', clubNumber: '' })).toBe(true);
    expect(canConfirmDraft({ type: 'putter', loftText: '3', clubNumber: '' })).toBe(true);
    expect(canConfirmDraft({ type: 'putter', loftText: '11', clubNumber: '' })).toBe(false);
    expect(sanitizeClub({ id: 'blade', type: 'putter', loft: 3 })?.loft).toBe(3);
    expect(sanitizeClub({ id: 'iron', type: 'iron', loft: 3 })?.loft).toBeNull();
    expect(sanitizeFit({ handicapIndex: 99, driverSpeedMph: Number.POSITIVE_INFINITY, handicapQuality: 'user_confirmed', speedQuality: 'user_confirmed' })).toMatchObject({
      handicapIndex: null,
      driverSpeedMph: null,
    });
    expect(sanitizeClub({ id: 'wild', loft: 90 })?.loft).toBeNull();
  });

  it('loads a saved club into fix details and can delete it or bench it', () => {
    const saved = club({ id: 'saved-7', brand: 'Miura', model: 'Tour', type: 'iron', loft: 34, flex: 'S', clubNumber: '7', slot: '7' });
    const draft = clubToDraft(saved);
    expect(draft.existingId).toBe('saved-7');
    expect(draft.brand).toBe('Miura');
    expect(draft.loftText).toBe('34');
    const edited = placeClub([saved], draftToClub({ ...draft, model: 'CB' }, null, 'saved-7'));
    expect(edited).toHaveLength(1);
    expect(edited[0]?.model).toBe('CB');
    expect(withInPlay(edited, 'saved-7', false).clubs[0]?.inPlay).toBe(false);
    expect(withoutClub(edited, 'saved-7')).toHaveLength(0);
    const card = read('../app/bag/card.tsx');
    const details = read('../app/bag/details.tsx');
    expect(card).toContain('editClub');
    expect(card).toContain('DELETE CLUB');
    expect(card).toContain('OUT OF PLAY');
    expect(details).toContain('saveDraft');
    expect(details).not.toContain("router.push('/bag/confirm')");
    const hold = read('../app/bag/hold.tsx');
    expect(hold.indexOf('KEEP IT ANYWAY')).toBeLessThan(hold.indexOf('LOG SHOTS FIRST'));
    expect(hold).toContain("tone=\"ghost\"");
    expect(hold).toContain('No offers on this phone');
    expect(hold.slice(hold.indexOf('LOG SHOTS FIRST'))).not.toContain('saveDraft');
    expect(hold).toContain('color: scan.white');
    expect(card).toContain("router.push('/bag/hold')");
    expect(read('../app/bag/index.tsx')).toContain('No clubs in the bag yet. Nothing was filled in for you.');
    expect(read('../app.json')).toContain('extract server, only to read the club details');
    expect(read('../app.json')).not.toContain('Nothing is uploaded.');
  });
});
