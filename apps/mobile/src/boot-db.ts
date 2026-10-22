import { cacheOpenCourse, migrateAll, schemaVersion, type SqlExecutor } from '@coopr/db';
import { loadHighCedarsPilot } from '@coopr/course';

/** Opens the on-device database, applies schema 2, and caches the open High Cedars extract. Web export has no SQLite worker. */
export async function bootDatabase(): Promise<string> {
  const sqlite = await import('expo-sqlite');
  const db = sqlite.openDatabaseSync('coopr.db');
  const executor: SqlExecutor = {
    exec(sql) {
      db.execSync(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          db.runSync(sql, ...params);
        },
        get(...params) {
          return db.getFirstSync<Record<string, unknown>>(sql, ...params) ?? undefined;
        },
        all(...params) {
          return db.getAllSync<Record<string, unknown>>(sql, ...params);
        },
      };
    },
  };
  migrateAll(executor);
  const pilot = loadHighCedarsPilot();
  cacheOpenCourse(executor, {
    courseKey: pilot.courseKey,
    record: pilot.record,
    features: pilot.features,
    osmAttribution: pilot.osmAttribution,
    osmLicense: 'ODbL-1.0',
    osmTimestamp: pilot.osmTimestamp,
    retrievedOn: '2026-10-22',
    nowMs: Date.UTC(2026, 9, 22),
  });
  return `SQLite schema v${schemaVersion(executor)}. High Cedars open cache is on this device.`;
}
