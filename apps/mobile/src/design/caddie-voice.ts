import type { CaddiePersonality } from '@coopr/domain';
import { caddieLine, formatDistance, type DistanceUnit } from '@coopr/engine';

/** Chill keeps the measured line. Chirpy is the default. */
export type CaddieVoice = 'chill' | 'chirpy';

export const DEFAULT_VOICE: CaddieVoice = 'chirpy';

export const VOICE_LABELS: Record<CaddieVoice, string> = {
  chill: 'Chill',
  chirpy: 'Chirpy',
};

export function parseVoice(value: unknown): CaddieVoice {
  return value === 'chill' ? 'chill' : 'chirpy';
}

function clubName(label: string): string {
  return label.split('·')[0]?.trim() || label;
}

function shown(yards: number, unit: DistanceUnit): number {
  return Number(formatDistance(yards, unit));
}

function unitWord(unit: DistanceUnit, count: number): string {
  if (unit === 'm') return count === 1 ? 'meter' : 'meters';
  return count === 1 ? 'yard' : 'yards';
}

/**
 * Chirpy speaks only when a real club and a real number are in hand.
 * A missing stock, target, or wind stays out of the sentence.
 */
function chirp(input: {
  clubLabel: string;
  windYards: number | null;
  stockYards: number | null;
  targetYards: number | null;
  playsLikeYards: number | null;
  lowConfidence: boolean;
  unit: DistanceUnit;
}): string | null {
  const name = clubName(input.clubLabel);
  const cardYards = input.playsLikeYards != null && Number.isFinite(input.playsLikeYards) ? input.playsLikeYards : input.targetYards;
  if (cardYards == null || !Number.isFinite(cardYards)) {
    return input.lowConfidence ? 'The sample is thin. Treat the number softly.' : null;
  }
  const card = shown(cardYards, input.unit);
  const stock = input.stockYards != null && Number.isFinite(input.stockYards) ? shown(input.stockYards, input.unit) : null;
  if (stock != null) {
    const gap = stock - card;
    if (gap <= -5) {
      const short = card - stock;
      return `Short is dead. ${name} is ${short} ${unitWord(input.unit, short)} short of ${card}.`;
    }
    if (gap >= 15) return `That's a lot of club. ${name} covers ${card} by ${gap} ${unitWord(input.unit, gap)}.`;
  }
  if (input.lowConfidence) return `The sample is thin. ${name}, ${card}.`;
  const wind = input.windYards != null && Number.isFinite(input.windYards) ? Math.round(input.windYards) : null;
  if (wind != null && wind >= 1) {
    const face = shown(input.windYards!, input.unit);
    return `Wind ${face} ${unitWord(input.unit, face)} in your face. Grip it and rip it. ${name}, ${card}.`;
  }
  if (wind != null && wind <= -1) {
    const help = shown(Math.abs(input.windYards!), input.unit);
    return `Wind ${help} ${unitWord(input.unit, help)} helping. Grip it and rip it. ${name}, ${card}.`;
  }
  return `Grip it and rip it. ${name}, ${card}.`;
}

/**
 * One caddie line. Chill is the existing measured sentence.
 * Chirpy adds swagger and still names only numbers that were passed in.
 */
export function caddieVoiceLine(input: {
  voice: CaddieVoice;
  personality: CaddiePersonality;
  clubLabel: string | null;
  windYards: number | null;
  stockYards: number | null;
  targetYards: number | null;
  playsLikeYards: number | null;
  lowConfidence: boolean;
  unit: DistanceUnit;
}): string | null {
  if (!input.clubLabel) return null;
  if (input.voice === 'chill') {
    return caddieLine({
      personality: input.personality,
      clubLabel: input.clubLabel,
      windYards: input.windYards,
      stockYards: input.stockYards,
      targetYards: input.targetYards,
      lowConfidence: input.lowConfidence,
    });
  }
  return (
    chirp({
      clubLabel: input.clubLabel,
      windYards: input.windYards,
      stockYards: input.stockYards,
      targetYards: input.targetYards,
      playsLikeYards: input.playsLikeYards,
      lowConfidence: input.lowConfidence,
      unit: input.unit,
    }) ??
    caddieLine({
      personality: input.personality,
      clubLabel: input.clubLabel,
      windYards: input.windYards,
      stockYards: input.stockYards,
      targetYards: input.targetYards,
      lowConfidence: input.lowConfidence,
    })
  );
}
