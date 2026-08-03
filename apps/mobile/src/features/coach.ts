import { askCoach, buildAllProfiles, analyzeBag, assessGolfIq } from '@coopr/engine';
import type { CoachAnswer } from '@coopr/core';
import {
  getActiveBagId, listClubs, listShotsForPlayer, listClubFeedback, validationRequiredSessionIds,
} from '../db/repo';

// Assembles the coach context from local data (profiles + bag intelligence + Golf IQ)
// and answers the question deterministically. When a LanguageProvider is configured it
// can rewrite `answer` in the caddie's voice — the facts here stay fixed.
export function ask(userId: string, question: string, now: number): CoachAnswer | null {
  const bagId = getActiveBagId(userId);
  if (!bagId) return null;
  const clubs = listClubs(bagId);
  const shots = listShotsForPlayer(userId);
  const profiles = buildAllProfiles(shots, { now, validationRequiredSessions: validationRequiredSessionIds() });
  if (profiles.length === 0) return null;
  const bag = analyzeBag({
    profiles,
    clubs,
    feedback: listClubFeedback(bagId),
  });
  const assessment = assessGolfIq(profiles, clubs);
  return askCoach(question, { clubs, profiles, bag, assessment });
}
