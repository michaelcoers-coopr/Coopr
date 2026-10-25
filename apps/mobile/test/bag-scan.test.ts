import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bagGaps, verdict } from '@coopr/engine';
import { KEEP_ANYWAY, NO_SIGNALS, STARTING_POINT } from '../src/bag-scan/copy';
import {
  canConfirmDraft,
  draftToClub,
  holdBody,
  placeClub,
  profileFromFit,
  sanitizeClub,
  toFitClub,
} from '../src/bag-scan/logic';
import { readScanClubs, writeScanClubs } from '../src/bag-scan/persist';
import { hydrateDevice, resetDeviceForTests, resetDeviceFromStorage } from '../src/device-store';
import { clubPictureKind } from '../src/bag-scan/picture-kind';
import { stubVision } from '../src/bag-scan/vision';
import { blankDraft, type ScanClub } from '../src/bag-scan/types';

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
});
