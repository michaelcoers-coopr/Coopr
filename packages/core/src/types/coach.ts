import type { ClubProfile } from './profile';
import type { Club } from './equipment';
import type { BagIntelligence } from './bag';
import type { GolfIqAssessment } from './assessment';

// "Ask COOPR" — the conversational coach. The deterministic engines own every fact;
// this layer just answers questions from their output. A LanguageProvider may later
// rewrite the answer in the caddie's voice, but it never invents numbers or picks
// clubs (invariant 1).

export type CoachTopic =
  | 'practice'
  | 'equipment'
  | 'bag'
  | 'club_distance'
  | 'strengths'
  | 'overview'
  | 'help';

export interface CoachBullet {
  label: string;
  detail: string;
}

export interface CoachAnswer {
  topic: CoachTopic;
  title: string;
  paragraphs: string[];
  bullets: CoachBullet[];
  followUps: string[]; // suggested next questions (tappable)
  grounded: true; // always computed from the player's data
}

export interface CoachContext {
  clubs: Club[];
  profiles: ClubProfile[];
  bag: BagIntelligence;
  assessment: GolfIqAssessment;
}
