import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

// The authoritative local store. We use expo-sqlite's synchronous API directly with
// raw parameterized SQL (see migrations.ts, repo.ts). The canonical schema is expressed
// in Drizzle in packages/core for reference/typing, but the app does not run a Drizzle
// query instance — keeping the runtime lean and avoiding version coupling to Drizzle's
// expo-sqlite adapter.
export const sqlite: SQLiteDatabase = openDatabaseSync('coopr.db');
