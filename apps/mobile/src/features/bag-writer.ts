import type { ClubType } from '@coopr/core';
import { sqlite } from '../db/client';
import { newId } from '../lib/id';
import { enqueueOutbox } from '../db/sync';
import { getActiveBagId } from '../db/repo';

export function ensureActiveBag(userId: string): string {
  const existing = getActiveBagId(userId);
  if (existing) return existing;
  const id = newId();
  const now = Date.now();
  sqlite.runSync(
    'INSERT INTO bags (id, user_id, name, is_active, created_at, updated_at, deleted_at) VALUES (?, ?, ?, 1, ?, ?, NULL);',
    [id, userId, 'My Bag', now, now],
  );
  enqueueOutbox('bags', id, 'upsert', now);
  return id;
}

export function ensureClub(bagId: string, spec: { label: string; type: ClubType; loftDeg?: number | null }): string {
  const found = sqlite.getFirstSync<{ id: string }>(
    'SELECT id FROM clubs WHERE bag_id = ? AND label = ? AND deleted_at IS NULL LIMIT 1;',
    [bagId, spec.label],
  );
  if (found) return found.id;
  const id = newId();
  const now = Date.now();
  sqlite.runSync(
    `INSERT INTO clubs (id, bag_id, type, label, manufacturer, model, loft_deg, shaft_flex, shaft_model, shaft_material, bounce_deg, in_bag, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, 1, ?, ?, NULL);`,
    [id, bagId, spec.type, spec.label, spec.loftDeg ?? null, now, now],
  );
  enqueueOutbox('clubs', id, 'upsert', now);
  return id;
}

// Default club sets per baseline category. Users log shots for the clubs they carry;
// clubs with no entered shots are simply not created.
export interface DefaultClub {
  label: string;
  type: ClubType;
  loftDeg?: number;
}

export const DEFAULT_CLUBS: Record<string, DefaultClub[]> = {
  driver: [{ label: 'Driver', type: 'driver' }],
  woods_hybrids: [
    { label: '3W', type: 'wood' },
    { label: '5W', type: 'wood' },
    { label: '4H', type: 'hybrid' },
    { label: '5H', type: 'hybrid' },
  ],
  irons: [
    { label: '5i', type: 'iron' },
    { label: '6i', type: 'iron' },
    { label: '7i', type: 'iron' },
    { label: '8i', type: 'iron' },
    { label: '9i', type: 'iron' },
    { label: 'PW', type: 'iron', loftDeg: 45 },
  ],
  wedges: [
    { label: '50°', type: 'wedge', loftDeg: 50 },
    { label: '54°', type: 'wedge', loftDeg: 54 },
    { label: '58°', type: 'wedge', loftDeg: 58 },
  ],
};

export const CATEGORY_LABELS: Record<string, string> = {
  driver: 'Driver',
  woods_hybrids: 'Woods & Hybrids',
  irons: 'Irons',
  wedges: 'Wedges',
};
