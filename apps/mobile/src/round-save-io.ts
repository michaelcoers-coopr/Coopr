import { parseRoundSave, ROUND_KEY, type RoundSave } from './round-save';
import { webStore } from './web-storage';

export function hasWebStorage(): boolean {
  return webStore() != null;
}

export function readRoundSync(): RoundSave | null {
  const store = webStore();
  if (!store) return null;
  try {
    return parseRoundSave(store.getItem(ROUND_KEY));
  } catch {
    return null;
  }
}

export async function readRound(): Promise<RoundSave | null> {
  return readRoundSync();
}

export async function writeRound(save: RoundSave): Promise<void> {
  const store = webStore();
  if (!store) return;
  try {
    store.setItem(ROUND_KEY, JSON.stringify(save));
  } catch {
    // Private mode can throw on write. The round stays in memory for this visit.
  }
}
