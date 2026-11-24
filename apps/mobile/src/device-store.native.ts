import type { ScanClub, StoredFit } from './bag-scan/types';
import { sanitizeClub, sanitizeFit } from './bag-scan/logic';
import { installBackend, load, readSnapshot, resetRuntime, subscribeSnapshot, updateSnapshot } from './device/runtime';
import { mergePlayingIntoBag, playingFromBag, type DeviceSettings, type DeviceSnapshot, type PlayingClubView } from './device/snapshot';

let installed = false;

async function openDeviceDb(): Promise<{ get(): string | null; set(json: string): void }> {
  const sqlite = await import('expo-sqlite');
  const db = sqlite.openDatabaseSync('coopr-round.db');
  db.execSync('CREATE TABLE IF NOT EXISTS device_state (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)');
  return {
    get() {
      const row = db.getFirstSync<{ json: string }>('SELECT json FROM device_state WHERE id = 1');
      return row?.json ?? null;
    },
    set(json: string) {
      db.runSync('INSERT INTO device_state (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json', json);
    },
  };
}

/** The bag, settings, and finished rounds live in SQLite on the phone. */
export async function hydrateDevice(): Promise<void> {
  if (!installed) {
    try {
      const db = await openDeviceDb();
      installBackend({ read: () => db.get(), write: (json) => db.set(json) });
      installed = true;
    } catch {
      installBackend({
        read: () => null,
        write: () => undefined,
      });
      installed = true;
    }
  }
  load();
}

export function readDevice(): DeviceSnapshot {
  return readSnapshot();
}

export function updateDevice(change: (current: DeviceSnapshot) => DeviceSnapshot): void {
  updateSnapshot(change);
}

export function subscribeDevice(listener: () => void): () => void {
  return subscribeSnapshot(listener);
}

export function resetDeviceFromStorage(): void {
  load();
}

export function resetDeviceForTests(): void {
  installed = false;
  resetRuntime();
}

export function readPlayerBag(): ScanClub[] {
  return readDevice().bag;
}

export function writePlayerBag(playing: readonly PlayingClubView[]): void {
  updateDevice((snap) => ({ ...snap, bag: mergePlayingIntoBag(snap.bag, playing) }));
}

export function replaceScanBag(clubs: readonly ScanClub[]): void {
  const bag = clubs.flatMap((item) => {
    const club = sanitizeClub(item);
    return club ? [club] : [];
  });
  updateDevice((snap) => ({ ...snap, bag }));
}

export function readPlayerFit(): StoredFit {
  return readDevice().fit;
}

export function writePlayerFit(fit: StoredFit): void {
  updateDevice((snap) => ({ ...snap, fit: sanitizeFit(fit) }));
}

export function writePlayerSettings(patch: Partial<DeviceSettings>): void {
  updateDevice((snap) => ({ ...snap, settings: { ...snap.settings, ...patch } }));
}

export function rememberMeasuredShot(clubId: string, yards: number): void {
  if (!clubId || !Number.isFinite(yards)) return;
  updateDevice((current) => ({ ...current, measuredShots: [...current.measuredShots, { clubId, yards: Math.round(yards) }].slice(-400) }));
}

export function dropLastMeasuredShot(clubId: string): void {
  updateDevice((current) => {
    const index = [...current.measuredShots].reverse().findIndex((shot) => shot.clubId === clubId);
    if (index < 0) return current;
    const at = current.measuredShots.length - 1 - index;
    return { ...current, measuredShots: current.measuredShots.filter((_, item) => item !== at) };
  });
}

export function reviseMeasuredShot(previous: { clubId: string; yards: number }, next: { clubId: string; yards: number }): void {
  if (!next.clubId || !Number.isFinite(next.yards)) return;
  updateDevice((current) => {
    const yards = Math.round(previous.yards);
    const index = [...current.measuredShots].reverse().findIndex((shot) => shot.clubId === previous.clubId && shot.yards === yards);
    const replacement = { clubId: next.clubId, yards: Math.round(next.yards) };
    if (index < 0) return current;
    const at = current.measuredShots.length - 1 - index;
    const shots = current.measuredShots.slice();
    shots[at] = replacement;
    return { ...current, measuredShots: shots };
  });
}

export function playingClubs(): PlayingClubView[] {
  return playingFromBag(readPlayerBag());
}
