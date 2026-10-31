import type { FixId } from '@coopr/analysis';
import { readDevice, updateDevice } from '../device-store';
import { appendCompletedRound } from '../device/snapshot';
import type { StoredRound } from './from-round';

export const ANALYSIS_ROUNDS_KEY = 'coopr.analysis.rounds.v1';

export function readArchive(): StoredRound[] {
  return readDevice().rounds;
}

export function writeArchive(rounds: readonly StoredRound[]): void {
  updateDevice((snap) => ({ ...snap, rounds: [...rounds].filter((round) => round.id !== 'open').slice(-40) }));
}

/** Keeps the newest 40 finished rounds. An id that is already saved is not replaced. */
export function archiveRound(round: StoredRound): void {
  updateDevice((snap) => appendCompletedRound(snap, round));
}

export function readLastFix(): { id: FixId; strokesPer18: number } | null {
  return readDevice().lastFix;
}

export function writeLastFix(fix: { id: FixId; strokesPer18: number }): void {
  updateDevice((snap) => ({ ...snap, lastFix: fix }));
}
