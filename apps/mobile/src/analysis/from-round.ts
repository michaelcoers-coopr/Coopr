import type { FairwayResult, RoundInput, ShotInput } from '@coopr/analysis';

export interface CardHole {
  holeNumber: number;
  par: number | null;
  strokeIndex: number | null;
  yards: number | null;
}

export interface OpenRoundInput {
  holes: readonly (number | null)[];
  putts: readonly (number | null)[];
  penalties: readonly (number | null)[];
  playedOn: string;
  courseName: string;
  card: readonly CardHole[];
}

/** A round the phone already stored. Nulls stay null. Nothing here is sample data. */
export interface StoredRound {
  id: string;
  playedOn: string;
  courseName: string;
  holes: {
    number: number;
    par: number | null;
    yards: number | null;
    strokeIndex: number | null;
    strokes: number | null;
    putts: number | null;
    penalties: number | null;
    fairway?: FairwayResult | null;
    gir?: boolean | null;
  }[];
}

export interface StoredShot {
  id: string;
  club: string;
  environment: 'course' | 'range' | 'simulator';
  carry: number | null;
  total: number | null;
  quality: 'measured' | 'user_confirmed' | 'estimated' | 'derived' | 'provisional' | 'unknown';
}

export function storedShots(
  shots: readonly {
    id: string;
    clubLabel: string;
    environment: StoredShot['environment'];
    carry: number | null;
    total: number | null;
    origin: string;
  }[],
): StoredShot[] {
  return shots.map((shot) => ({
    id: shot.id,
    club: shot.clubLabel,
    environment: shot.environment,
    carry: shot.carry,
    total: shot.total,
    quality: shot.origin === 'csv' ? 'measured' : 'user_confirmed',
  }));
}

export function openRound(input: OpenRoundInput): StoredRound | null {
  if (!input.holes.some((strokes) => strokes != null)) return null;
  const holes = input.holes.map((strokes, index) => {
    const card = input.card.find((hole) => hole.holeNumber === index + 1);
    return {
      number: index + 1,
      par: card?.par ?? null,
      yards: card?.yards ?? null,
      strokeIndex: card?.strokeIndex ?? null,
      strokes,
      putts: input.putts[index] ?? null,
      penalties: input.penalties[index] ?? null,
      fairway: null,
      gir: null,
    };
  });
  return { id: 'open', playedOn: input.playedOn, courseName: input.courseName, holes };
}

/** True when a scored hole left penalties blank. Analysis may still treat that blank as zero. */
export function penaltiesUnlogged(rounds: readonly StoredRound[]): boolean {
  return rounds.some((round) => round.holes.some((hole) => hole.strokes != null && hole.penalties == null));
}

export function toEngine(rounds: readonly StoredRound[], shots: readonly StoredShot[]): { rounds: RoundInput[]; shots: ShotInput[] } {
  return {
    rounds: rounds.map((round) => ({
      id: round.id,
      playedOn: round.playedOn,
      courseId: null,
      courseName: round.courseName,
      teeName: null,
      startPeriod: null,
      format: null,
      targetScore: null,
      isSample: false,
      quality: 'user_confirmed',
      holes: round.holes.map((hole) => ({
        number: hole.number,
        par: hole.par,
        yards: hole.yards,
        strokeIndex: hole.strokeIndex,
        strokes: hole.strokes,
        putts: hole.putts,
        // A blank penalty is not a logged zero on the card. Once strokes are in, analysis treats it as none.
        penalties: hole.strokes != null && hole.penalties == null ? 0 : hole.penalties,
        fairway: hole.fairway ?? null,
        gir: hole.gir ?? null,
        firstPuttFeet: null,
        teeClub: null,
        pressure: [],
        bbNet: null,
      })),
    })),
    shots: shots.map((shot) => ({
      id: shot.id,
      roundId: null,
      environment: shot.environment,
      hole: null,
      seq: null,
      club: shot.club,
      startLie: null,
      startDistToPinYds: null,
      endLie: null,
      endDistToPinYds: null,
      penaltyStrokes: 0,
      carryYds: shot.carry,
      totalYds: shot.total,
      carryQuality: shot.quality,
      lateralYds: null,
      longitudinalYds: null,
      isSample: false,
    })),
  };
}
