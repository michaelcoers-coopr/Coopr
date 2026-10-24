import type { CaddiePersonality } from '@coopr/domain';
import { caddieLine, formatDistance, formatTenths, type DistanceUnit } from '@coopr/engine';

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

/** A club this far short of the green is not getting home. The line does not speak this gap. */
const OUT_OF_REACH_YARDS = 40;

/**
 * Par 4 and par 5 tee shots that cannot reach the green.
 * The par is real. No landing yardage is invented.
 */
export function teeLandingLine(input: {
  voice: CaddieVoice;
  par: number | null;
  atTee: boolean;
  clubLabel: string | null;
  stockYards: number | null;
  greenYards: number | null;
}): string | null {
  if (!input.atTee || input.par == null || !Number.isFinite(input.par) || input.par < 4 || !input.clubLabel) return null;
  if (input.stockYards == null || input.greenYards == null) return null;
  if (!Number.isFinite(input.stockYards) || !Number.isFinite(input.greenYards)) return null;
  if (input.greenYards - input.stockYards < OUT_OF_REACH_YARDS) return null;
  const name = clubName(input.clubLabel);
  const par = Math.round(input.par);
  if (input.voice === 'chill') return `Par ${par}. ${name} will not reach the green.`;
  return `Par ${par}. Nobody's getting home. ${name}, find the short grass.`;
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
  if (input.windYards != null && Number.isFinite(input.windYards)) {
    const tenth = Math.round(input.windYards * 10) / 10;
    if (tenth >= 0.1 || tenth <= -0.1) {
      const magnitude = input.unit === 'yd' ? formatTenths(tenth) : formatDistance(Math.abs(tenth), input.unit);
      const count = Number(magnitude);
      const words = unitWord(input.unit, Number.isFinite(count) ? count : 2);
      if (tenth > 0) return `Wind ${magnitude} ${words} in your face. Grip it and rip it. ${name}, ${card}.`;
      return `Wind ${magnitude} ${words} helping. Grip it and rip it. ${name}, ${card}.`;
    }
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
  par?: number | null;
  atTee?: boolean;
}): string | null {
  if (!input.clubLabel) return null;
  const landing = teeLandingLine({
    voice: input.voice,
    par: input.par ?? null,
    atTee: input.atTee === true,
    clubLabel: input.clubLabel,
    stockYards: input.stockYards,
    greenYards: input.playsLikeYards ?? input.targetYards,
  });
  if (landing) return landing;
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
