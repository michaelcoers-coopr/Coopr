import { parseRoundSave, ROUND_KEY, type RoundSave } from './round-save';

export function hasWebStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function readRoundSync(): RoundSave | null {
  if (!hasWebStorage()) return null;
  try {
    return parseRoundSave(localStorage.getItem(ROUND_KEY));
  } catch {
    return null;
  }
}

export async function readRound(): Promise<RoundSave | null> {
  return readRoundSync();
}

export async function writeRound(save: RoundSave): Promise<void> {
  if (!hasWebStorage()) return;
  localStorage.setItem(ROUND_KEY, JSON.stringify(save));
}
