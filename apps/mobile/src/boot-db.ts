import { SQLITE_MIGRATION_V1 } from '@coopr/db';

/** Opens the on-device database and applies the versioned migration. expo-sqlite ships inside Expo Go on SDK 58. Web export has no SQLite worker. */
export async function bootDatabase(): Promise<string> {
  const sqlite = await import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync('coopr.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(SQLITE_MIGRATION_V1);
  const row = await db.getFirstAsync<{ version: number }>('SELECT version AS version FROM schema_meta WHERE id = 1');
  return `SQLite schema v${row?.version ?? '?'}`;
}
