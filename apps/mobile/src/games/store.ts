import { ownerRound, type FoursomeSave } from '@coopr/games';
import { readDevice, updateDevice } from '../device-store';
import { finishFoursome } from '../device/snapshot';
import { holesPlayed, localPlayedOn } from './present';

export function readOpenFoursome(): FoursomeSave | null {
  return readDevice().foursome;
}

export function readFoursomeHistory(): FoursomeSave[] {
  return readDevice().foursomeHistory;
}

export function writeOpenFoursome(save: FoursomeSave | null): void {
  updateDevice((snap) => ({ ...snap, foursome: save }));
}

/** Appends history and the owner's gross, then clears the open game only if it is this round. */
export function finishOpenFoursome(save: FoursomeSave, yards: Array<number | null> = []): void {
  if (holesPlayed(save) === 0) return;
  const finished: FoursomeSave = { ...save, finishedOn: localPlayedOn() };
  const owner = ownerRound(finished, { yards, courseName: 'High Cedars', playedOn: finished.finishedOn ?? undefined });
  updateDevice((snap) => finishFoursome(snap, finished, owner));
}
