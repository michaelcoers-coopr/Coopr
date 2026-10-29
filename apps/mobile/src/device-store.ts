import type { ScanClub, StoredFit } from './bag-scan/types';
import { sanitizeClub, sanitizeFit } from './bag-scan/logic';
import { installBackend, load, readSnapshot, resetRuntime, subscribeSnapshot, updateSnapshot } from './device/runtime';
import {
  emptySnapshot,
  mergePlayingIntoBag,
  parseSnapshot,
  playingFromBag,
  serializeSnapshot,
  type DeviceSettings,
  type DeviceSnapshot,
  type PlayingClubView,
} from './device/snapshot';

export const DEVICE_KEY = 'coopr.device.v1';

const LEGACY_ROUNDS = 'coopr.analysis.rounds.v1';
const LEGACY_FIX = 'coopr.analysis.lastFix.v1';
const LEGACY_BAG = 'coopr.bag.scan.v1';
const LEGACY_FIT = 'coopr.bag.fit.v1';
const LEGACY_VOICE = 'coopr.voice';
const LEGACY_HANDS = 'coopr.talk.handsFree';
const LEGACY_CALLOUTS = 'coopr.talk.callouts';

let installed = false;

function webStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function jsonItem(store: Storage, key: string): unknown {
  const raw = store.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

/** One-time read of the web keys this snapshot replaces. Native never had them. */
function legacySnapshot(store: Storage): DeviceSnapshot | null {
  try {
    const rounds = store.getItem(LEGACY_ROUNDS);
    const fix = store.getItem(LEGACY_FIX);
    const bag = store.getItem(LEGACY_BAG);
    const fit = store.getItem(LEGACY_FIT);
    const voice = store.getItem(LEGACY_VOICE);
    const hands = store.getItem(LEGACY_HANDS) === '1';
    const callouts = store.getItem(LEGACY_CALLOUTS) === '1';
    if (!rounds && !fix && !bag && !fit && !voice && !hands && !callouts) return null;
    const base = emptySnapshot();
    return parseSnapshot(
      JSON.stringify({
        version: 1,
        bag: bag ? jsonItem(store, LEGACY_BAG) : [],
        fit: fit ? jsonItem(store, LEGACY_FIT) : base.fit,
        settings: {
          ...base.settings,
          voice: voice ?? base.settings.voice,
          handsFree: hands,
          callouts,
        },
        rounds: rounds ? jsonItem(store, LEGACY_ROUNDS) : [],
        lastFix: fix ? jsonItem(store, LEGACY_FIX) : null,
      }),
    );
  } catch {
    return null;
  }
}

function readBacking(): string | null {
  const store = webStorage();
  if (!store) return null;
  try {
    const existing = store.getItem(DEVICE_KEY);
    if (existing) return existing;
    const legacy = legacySnapshot(store);
    if (!legacy) return null;
    const json = serializeSnapshot(legacy);
    store.setItem(DEVICE_KEY, json);
    return json;
  } catch {
    return null;
  }
}

function writeBacking(json: string): void {
  try {
    webStorage()?.setItem(DEVICE_KEY, json);
  } catch {
    // A private browser can refuse the write. This visit still has the copy.
  }
}

export function hydrateDevice(): void {
  if (!installed) {
    installBackend({ read: readBacking, write: writeBacking });
    installed = true;
  }
  load();
}

export function readDevice(): DeviceSnapshot {
  if (!installed) hydrateDevice();
  return readSnapshot();
}

export function updateDevice(change: (current: DeviceSnapshot) => DeviceSnapshot): void {
  if (!installed) hydrateDevice();
  updateSnapshot(change);
}

export function subscribeDevice(listener: () => void): () => void {
  return subscribeSnapshot(listener);
}

/** Drops the in-memory copy and reads the same backing bytes again. */
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

export function writePlayerSettings(patch: Partial<DeviceSettings>): void {
  updateDevice((snap) => ({ ...snap, settings: { ...snap.settings, ...patch } }));
}

export function playingClubs(): PlayingClubView[] {
  return playingFromBag(readPlayerBag());
}
