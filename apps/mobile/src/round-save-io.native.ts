import { parseRoundSave, type RoundSave } from './round-save';

export function hasWebStorage(): boolean {
  return false;
}

export function readRoundSync(): RoundSave | null {
  return null;
}

async function openRoundDb(): Promise<{ get(): string | null; set(json: string): void }> {
  const sqlite = await import('expo-sqlite');
  const db = sqlite.openDatabaseSync('coopr-round.db');
  db.execSync('CREATE TABLE IF NOT EXISTS round_save (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)');
  return {
    get() {
      const row = db.getFirstSync<{ json: string }>('SELECT json FROM round_save WHERE id = 1');
      return row?.json ?? null;
    },
    set(json: string) {
      db.runSync('DELETE FROM round_save WHERE id = 1');
      db.runSync('INSERT INTO round_save (id, json) VALUES (1, ?)', json);
    },
  };
}

export async function readRound(): Promise<RoundSave | null> {
  try {
    const db = await openRoundDb();
    return parseRoundSave(db.get());
  } catch {
    return null;
  }
}

export async function writeRound(save: RoundSave): Promise<void> {
  try {
    const db = await openRoundDb();
    db.set(JSON.stringify(save));
  } catch {
    // The round stays on screen. A storage failure does not invent a score.
  }
}
