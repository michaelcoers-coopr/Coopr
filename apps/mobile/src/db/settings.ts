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
