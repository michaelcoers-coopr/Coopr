import { IN_PLAY_CLUB_LIMIT } from '@coopr/domain';
import type { DistanceProfile } from './profile';

export interface OrganicCandidate {
  id: string;
  organicScore: number;
  sponsored: boolean;
}

/** Sponsored is ignored. Toggling it cannot change the order. */
export function rankByOrganicFit(candidates: readonly OrganicCandidate[]): string[] {
  return [...candidates]
    .sort((a, b) => b.organicScore - a.organicScore || a.id.localeCompare(b.id))
    .map((candidate) => candidate.id);
}

export function assertInPlayRoom(currentCount: number): void {
  if (currentCount >= IN_PLAY_CLUB_LIMIT) {
    throw new Error(`In-play bag is limited to ${IN_PLAY_CLUB_LIMIT} clubs`);
  }
}

export interface ClubIdentity {
  id: string;
  label: string;
  category: string;
}

export interface ReplaceAdvice {
  clubId: string | null;
  clubLabel: string | null;
  posture: 'test_replace' | 'decline';
  brandNeutral: true;
  alsoUnreliable: { clubId: string; clubLabel: string }[];
  reason: string;
}

function ironNumber(clubId: string): number | null {
  const match = /^(\d+)i$/.exec(clubId);
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function unreliable(profile: DistanceProfile): boolean {
  return profile.sampleSize >= 8 && (profile.p80 - profile.p20 >= 50 || profile.shortMissShare >= 0.25);
}

/**
 * First club to test-replace: the longest iron (lowest iron number) whose own
 * sample is too wide or too short-heavy to be a stock distance.
 * Brands are never named. Historical "ideal" bags are not an input.
 */
export function replacementAdvice(profiles: readonly DistanceProfile[], clubs: readonly ClubIdentity[]): ReplaceAdvice {
  const irons = new Map(clubs.filter((club) => club.category === 'iron').map((club) => [club.id, club]));
  const qualifying = profiles.filter(
    (profile) => irons.has(profile.clubId) && profile.metric === 'total' && unreliable(profile) && !profile.blended,
  );
  const byClub = new Map<string, DistanceProfile>();
  for (const profile of qualifying) {
    const existing = byClub.get(profile.clubId);
    if (!existing || profile.sampleSize > existing.sampleSize) byClub.set(profile.clubId, profile);
  }
  const ranked = [...byClub.values()].sort((a, b) => {
    const an = ironNumber(a.clubId) ?? 99;
    const bn = ironNumber(b.clubId) ?? 99;
    return an - bn || a.clubLabel.localeCompare(b.clubLabel);
  });
  const first = ranked[0];
  if (!first) {
    return {
      clubId: null,
      clubLabel: null,
      posture: 'decline',
      brandNeutral: true,
      alsoUnreliable: [],
      reason: 'No iron has a large enough sample to justify a replacement. Nothing is recommended from a catalog.',
    };
  }
  const spread = Math.round(first.p80 - first.p20);
  return {
    clubId: first.clubId,
    clubLabel: first.clubLabel,
    posture: 'test_replace',
    brandNeutral: true,
    alsoUnreliable: ranked.slice(1).map((profile) => ({ clubId: profile.clubId, clubLabel: profile.clubLabel })),
    reason:
      `Test replacing the ${first.clubLabel} first. It is the longest iron with a measured sample that does not hold a stock distance ` +
      `(total P20–P80 about ${spread} yards, short of the median in ${first.shortMissCount} of ${first.sampleSize} shots). ` +
      `Test a more forgiving club in that distance slot. This is not a brand recommendation, and a sponsor flag would not change it. ` +
      `Carry for this club was not measured, so the spread above is total distance only.`,
  };
}
