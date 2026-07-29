import { buildAllProfiles, buildClubProfile, analyzeBag } from '@coopr/engine';
import type { ClubProfile, BagIntelligence } from '@coopr/core';
import {
  listShotsForPlayer,
  listShotsForClub,
  validationRequiredSessionIds,
  getActiveBagId,
  listClubs,
  listClubFeedback,
} from '../db/repo';

// Runs the pure engine over locally-stored shots. The engine itself has no I/O; this
// module is the only place that pairs it with the database. `now` is passed in so
// recency is deterministic and the engine never reads a clock.

export function computePlayerProfiles(playerId: string, now: number): ClubProfile[] {
  const shots = listShotsForPlayer(playerId);
  return buildAllProfiles(shots, {
    now,
    validationRequiredSessions: validationRequiredSessionIds(),
  });
}

export function computeClubProfile(clubId: string, now: number): ClubProfile | null {
  const shots = listShotsForClub(clubId);
  if (shots.length === 0) return null;
  return buildClubProfile(shots, { now, validationRequiredSessions: validationRequiredSessionIds() });
}

export function computeBagIntelligence(userId: string, now: number): BagIntelligence | null {
  const bagId = getActiveBagId(userId);
  if (!bagId) return null;
  const profiles = computePlayerProfiles(userId, now);
  const clubs = listClubs(bagId);
  const feedback = listClubFeedback(bagId);
  return analyzeBag({ profiles, clubs, feedback });
}
