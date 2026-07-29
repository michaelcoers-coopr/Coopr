import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { schema as coreSchema } from '@coopr/core';

// `coreSchema` is the module namespace; `coreSchema.schema` is the combined tables
// object drizzle wants for typed queries.
const tables = coreSchema.schema;

export const sqlite: SQLiteDatabase = openDatabaseSync('coopr.db');
export const db = drizzle(sqlite, { schema: tables });
export { tables };
