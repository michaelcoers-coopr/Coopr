import type { DistanceProfile } from './profile';

export type LayupCall = 'go' | 'lay_up' | 'unsure';

export interface LayupDecision {
  call: LayupCall;
  /** Plain words. Never a made-up percentage. */
  reason: string;
  sampleSize: number | null;
}

function yards(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Go or lay up from a measured carry pattern.
 * A total profile cannot clear a hazard. An unknown carry line stays unsure.
 */
export function layupDecision(input: {
  carry: Pick<DistanceProfile, 'metric' | 'sampleSize' | 'p20' | 'p50' | 'p80'> & { dispersionKnown?: boolean } | null;
  carryToClearYards: number | null;
}): LayupDecision {
  const carry = input.carry;
  if (!carry || carry.metric !== 'carry') {
    return {
      call: 'unsure',
      sampleSize: null,
      reason: 'No measured carry sample. A total is not used to clear a hazard, and no odds are invented.',
    };
  }
  if (carry.dispersionKnown === false) {
    return {
      call: 'unsure',
      sampleSize: carry.sampleSize,
      reason: 'This carry is an average with no measured P20 or P80, so it cannot make a go or a lay-up call.',
    };
  }
  if (carry.sampleSize < 5) {
    return {
      call: 'unsure',
      sampleSize: carry.sampleSize,
      reason: `Carry sample is ${carry.sampleSize}. Five measured carries are the floor. No odds are invented.`,
    };
  }
  const pattern = `Carry P20 ${yards(carry.p20)}, median ${yards(carry.p50)}, P80 ${yards(carry.p80)} from ${carry.sampleSize} shots.`;
  if (input.carryToClearYards == null) {
    return {
      call: 'unsure',
      sampleSize: carry.sampleSize,
      reason: `${pattern} Carry-to-clear is unknown, so this is not a go or a lay-up.`,
    };
  }
  const line = input.carryToClearYards;
  if (carry.p20 >= line) {
    return {
      call: 'go',
      sampleSize: carry.sampleSize,
      reason: `Go. Carry P20 ${yards(carry.p20)} is past the ${yards(line)} carry line. That is the short end of this sample, not a probability.`,
    };
  }
  if (carry.p80 < line) {
    return {
      call: 'lay_up',
      sampleSize: carry.sampleSize,
      reason: `Lay up. Carry P80 ${yards(carry.p80)} is short of the ${yards(line)} carry line. The long end of this sample does not clear it.`,
    };
  }
  return {
    call: 'lay_up',
    sampleSize: carry.sampleSize,
    reason: `Lay up. Carry P20 ${yards(carry.p20)} is short of ${yards(line)} and P80 ${yards(carry.p80)} is past it. Part of the measured pattern is short. This is not a percentage.`,
  };
}
