import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { archiveRound, readArchive } from '../src/analysis/archive';
import { openRound, type StoredRound } from '../src/analysis/from-round';
import { readScanClubs, writeScanClubs } from '../src/bag-scan/persist';
import type { ScanClub } from '../src/bag-scan/types';
import { hydrateDevice, readDevice, resetDeviceForTests, resetDeviceFromStorage, writePlayerBag, writePlayerSettings } from '../src/device-store';
import { parseSnapshot, playingFromBag } from '../src/device/snapshot';

const here = dirname(fileURLToPath(import.meta.url));

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

function fresh(): void {
  memoryStorage();
  resetDeviceForTests();
  hydrateDevice();
}

function round(id: string, strokes: number, extra?: { fairway?: StoredRound['holes'][number]['fairway']; gir?: boolean | null }): StoredRound {
  return {
    id,
    playedOn: '2026-10-25',
    courseName: 'High Cedars',
    holes: [{ number: 1, par: 4, yards: 380, strokeIndex: 7, strokes, putts: 2, penalties: 0, ...extra }],
  };
}

describe('device store', () => {
  it('keeps the bag, settings, and a finished round across a restart', () => {
    fresh();
    writePlayerSettings({ voice: 'chill', handsFree: true, callouts: true, onboarded: true, displayName: 'Ada' });
    writePlayerBag([{ id: '7i', label: '7 iron', slot: 'in_play', note: null }]);
    archiveRound(round('round-kept', 5, { fairway: 'hit', gir: true }));
    resetDeviceForTests();
    hydrateDevice();
    const snap = readDevice();
    expect(snap.settings).toMatchObject({ voice: 'chill', handsFree: true, callouts: true, onboarded: true, displayName: 'Ada' });
    expect(snap.bag[0]?.id).toBe('7i');
    expect(snap.bag[0]?.model).toBe('7 iron');
    expect(readArchive()[0]?.holes[0]).toMatchObject({ strokes: 5, putts: 2, fairway: 'hit', gir: true });
    resetDeviceFromStorage();
    expect(readArchive()[0]?.id).toBe('round-kept');
  });

  it('does not overwrite a saved round when the same id is archived again', () => {
    fresh();
    archiveRound(round('round-1', 4));
    archiveRound(round('round-1', 9));
    expect(readArchive()).toHaveLength(1);
    expect(readArchive()[0]?.holes[0]?.strokes).toBe(4);
    archiveRound(round('round-2', 5));
    expect(readArchive().map((item) => item.id)).toEqual(['round-1', 'round-2']);
    const open = openRound({
      holes: [6, ...Array<number | null>(17).fill(null)],
      putts: Array<number | null>(18).fill(null),
      penalties: Array<number | null>(18).fill(null),
      playedOn: '2026-10-25',
      courseName: 'High Cedars',
      card: [{ holeNumber: 1, par: 4, strokeIndex: 7, yards: 380 }],
    });
    archiveRound(open!);
    const saved = readArchive();
    expect(saved.some((item) => item.id === 'open')).toBe(false);
    expect(saved.find((item) => item.id !== 'round-1' && item.id !== 'round-2')?.holes[0]?.strokes).toBe(6);
    expect(saved.find((item) => item.id === 'round-1')?.holes[0]?.strokes).toBe(4);
  });

  it('stores a fairway or green hit when it is present and leaves a missing tap null', () => {
    const parsed = parseSnapshot(
      JSON.stringify({
        rounds: [
          {
            id: 'plain',
            playedOn: '2026-10-25',
            courseName: 'High Cedars',
            holes: [{ number: 1, strokes: 4, putts: 2 }],
          },
        ],
      }),
    );
    expect(parsed.rounds[0]?.holes[0]?.fairway).toBeNull();
    expect(parsed.rounds[0]?.holes[0]?.gir).toBeNull();
    fresh();
    archiveRound(round('marked', 4, { fairway: 'left', gir: false }));
    resetDeviceFromStorage();
    expect(readArchive()[0]?.holes[0]?.fairway).toBe('left');
    expect(readArchive()[0]?.holes[0]?.gir).toBe(false);
  });

  it('gives the scan flow and the caddie the same club id', () => {
    fresh();
    const club: ScanClub = {
      id: 'scan-7',
      slot: '7',
      inPlay: true,
      brand: 'Ping',
      model: 'i530',
      type: 'iron',
      loft: 30,
      flex: 'S',
      ironBuild: 'players-distance',
      photoUri: 'file://face.jpg',
      fitAck: null,
      fitAckOn: null,
      clubNumber: '7',
      identifiedBy: 'typed',
    };
    writeScanClubs([club]);
    const playing = playingFromBag(readScanClubs());
    expect(playing[0]?.id).toBe('scan-7');
    expect(playing[0]?.label).toBe('Ping i530');
    writePlayerBag([{ id: 'scan-7', label: 'Ping i530', slot: 'testing', note: null }]);
    const kept = readScanClubs()[0];
    expect(kept?.id).toBe(playing[0]?.id);
    expect(kept?.loft).toBe(30);
    expect(kept?.photoUri).toBe('file://face.jpg');
    expect(kept?.inPlay).toBe(false);
  });

  it('keeps the native bag in SQLite', () => {
    const native = readFileSync(join(here, '../src/device-store.native.ts'), 'utf8');
    expect(native).toContain("openDatabaseSync('coopr-round.db')");
    expect(native).toContain('CREATE TABLE IF NOT EXISTS device_state');
    expect(native).not.toContain('localStorage');
  });
});
