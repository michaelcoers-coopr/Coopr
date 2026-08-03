import { sqlite } from './client';

// Small key/value store for app-local flags (onboarding state, etc). Not synced.
export function getSetting(key: string): string | null {
  const row = sqlite.getFirstSync<{ v: string }>('SELECT v FROM app_settings WHERE k = ?;', [key]);
  return row?.v ?? null;
}

export function setSetting(key: string, value: string): void {
  sqlite.runSync('INSERT OR REPLACE INTO app_settings (k, v) VALUES (?, ?);', [key, value]);
}

export const ONBOARDING_COMPLETE = 'onboarding_complete';

export function isOnboardingComplete(): boolean {
  return getSetting(ONBOARDING_COMPLETE) === '1';
}
export function markOnboardingComplete(): void {
  setSetting(ONBOARDING_COMPLETE, '1');
}

// Experience mode: 'sample' (explore the founding TrackMan golfer) or 'personal'
// (your own quick-start / captured data). Unset means show the hero fork.
export const APP_MODE = 'app_mode';
export const ACTIVE_USER = 'active_user_id';
export const SEED_LOADED = 'seed_loaded';

export type AppMode = 'sample' | 'personal';
export function getMode(): AppMode | null {
  const v = getSetting(APP_MODE);
  return v === 'sample' || v === 'personal' ? v : null;
}
export function setMode(m: AppMode): void {
  setSetting(APP_MODE, m);
}
export function getActiveUserId(): string | null {
  return getSetting(ACTIVE_USER);
}
export function setActiveUserId(id: string): void {
  setSetting(ACTIVE_USER, id);
}
export function isSeedLoaded(): boolean {
  return getSetting(SEED_LOADED) === '1';
}
export function markSeedLoaded(): void {
  setSetting(SEED_LOADED, '1');
}

// Return to the hero fork (e.g. handing the phone to someone new). Keeps stored data;
// just clears which experience is active.
export function resetExperience(): void {
  sqlite.runSync('DELETE FROM app_settings WHERE k IN (?, ?, ?);', [APP_MODE, ACTIVE_USER, ONBOARDING_COMPLETE]);
}
