import { createRequire } from 'node:module';
import type { SqlExecutor } from './sql-executor';

interface SqliteStatement {
  run(...params: Array<string | number | null>): unknown;
  get(...params: Array<string | number | null>): Record<string, unknown> | undefined;
  all(...params: Array<string | number | null>): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

/** Node test adapter. The mobile app uses expo-sqlite with the same SQL text. */
export function openMemory(): SqlExecutor {
  const require = createRequire(import.meta.url);
  const specifier = 'node:' + 'sqlite';
  const { DatabaseSync } = require(specifier) as { DatabaseSync: new (path: string) => SqliteDatabase };
  const db = new DatabaseSync(':memory:');
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        run(...params: Array<string | number | null>) {
          statement.run(...params);
        },
        get(...params: Array<string | number | null>) {
          return statement.get(...params) as Record<string, unknown> | undefined;
        },
        all(...params: Array<string | number | null>) {
          return statement.all(...params) as Record<string, unknown>[];
        },
      };
    },
  };
}
