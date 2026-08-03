import { SEED_PLAYER_ID, CADDIE_PRESETS } from '@coopr/core';
import { sqlite } from '../db/client';
import { newId } from '../lib/id';
import { seedIfEmpty } from '../db/seed';
import {
  setMode, setActiveUserId, markOnboardingComplete, setSetting, ONBOARDING_COMPLETE,
} from '../db/settings';
import { quickStartWithHandicap } from './quick-start';
import { saveCaddieProfile } from './caddie-writer';

const DRY = CADDIE_PRESETS.find((p) => p.key === 'dry_humor')!;

function createPersonalUser(): string {
  const now = Date.now();
  const id = newId();
  sqlite.runSync(
    'INSERT INTO users (id, email, is_anonymous, created_at, updated_at, deleted_at) VALUES (?, ?, 1, ?, ?, NULL);',
    [id, null, now, now],
  );
  return id;
}

// Explore the founding TrackMan golfer (the "ultimate" fidelity example).
export function enterSample(): void {
  seedIfEmpty();
  setActiveUserId(SEED_PLAYER_ID);
  setMode('sample');
  markOnboardingComplete();
  setSetting('data_kind', 'sample');
  saveCaddieProfile(SEED_PLAYER_ID, DRY.name, DRY);
}

// Quick start from a handicap band — a fresh personal user with an estimated bag.
export function enterQuickStart(band: string): void {
  const id = createPersonalUser();
  setActiveUserId(id);
  setMode('personal');
  quickStartWithHandicap(id, band);
  markOnboardingComplete();
  setSetting('data_kind', 'estimate');
  saveCaddieProfile(id, DRY.name, DRY);
}

// Set up my own game from scratch (guided capture).
export function enterOwnSetup(): void {
  const id = createPersonalUser();
  setActiveUserId(id);
  setMode('personal');
  setSetting('data_kind', 'captured');
  setSetting(ONBOARDING_COMPLETE, '0');
}
