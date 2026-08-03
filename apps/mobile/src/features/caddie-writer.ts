import type { CaddiePreset } from '@coopr/core';
import { sqlite } from '../db/client';
import { getCaddieRow } from '../db/repo';
import { newId } from '../lib/id';
import { enqueueOutbox } from '../db/sync';

// Save the user's caddie: their chosen name + personality preset. Personality drives the
// LanguageProvider's voice only — never the golf math.
export function saveCaddieProfile(userId: string, name: string, preset: CaddiePreset): void {
  const now = Date.now();
  const existing = getCaddieRow(userId);
  const id = existing?.id ?? newId();
  if (existing) {
    sqlite.runSync(
      `UPDATE caddie_profiles SET name = ?, personality = ?, humor_level = ?, detail_level = ?, coaching_style = ?, updated_at = ?
       WHERE id = ?;`,
      [name, preset.label, preset.humorLevel, preset.detailLevel, preset.coachingStyle, now, id],
    );
  } else {
    sqlite.runSync(
      `INSERT INTO caddie_profiles (id, user_id, name, voice, personality, humor_level, detail_level, coaching_style, avatar, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, NULL);`,
      [id, userId, name, preset.label, preset.humorLevel, preset.detailLevel, preset.coachingStyle, now, now],
    );
  }
  enqueueOutbox('caddie_profiles', id, 'upsert', now);
}
