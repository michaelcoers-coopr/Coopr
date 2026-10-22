import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IN_PLAY_CLUB_LIMIT } from '@coopr/domain';
import {
  POSTGRES_SCHEMA_V1,
  POSTGRES_SCHEMA_V2,
  SQLITE_MIGRATION_V1,
  SQLITE_MIGRATION_V2,
  addInPlayClub,
  cacheOpenCourse,
  countWhere,
  migrate,
  migrateAll,
  persistFounder,
  recordAdminReview,
  schemaVersion,
  shotMetricCount,
  softDeleteUser,
} from '@coopr/db';
import { loadHighCedarsPilot } from '@coopr/course';
import { loadFounderDataset } from '@coopr/seed';
import { openMemory } from '../src/node-sqlite';

const dataset = loadFounderDataset();

function migrated() {
  const db = openMemory();
  migrate(db, SQLITE_MIGRATION_V1);
  persistFounder(db, dataset);
  return db;
}

describe('schema files', () => {
  it('embeds the canonical SQL migrations', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    expect(readFileSync(`${root}sql/sqlite/001_init.sql`, 'utf8')).toBe(SQLITE_MIGRATION_V1);
    expect(readFileSync(`${root}sql/sqlite/002_courses.sql`, 'utf8')).toBe(SQLITE_MIGRATION_V2);
    expect(readFileSync(`${root}sql/postgres/001_init.sql`, 'utf8')).toBe(POSTGRES_SCHEMA_V1);
    expect(readFileSync(`${root}sql/postgres/002_courses.sql`, 'utf8')).toBe(POSTGRES_SCHEMA_V2);
    const tables = [...SQLITE_MIGRATION_V1.matchAll(/CREATE TABLE (\w+)/g)].map((match) => match[1]);
    for (const table of tables) expect(POSTGRES_SCHEMA_V1).toContain(`CREATE TABLE ${table}`);
    expect(schemaVersion(migrated())).toBe(1);
    expect(IN_PLAY_CLUB_LIMIT).toBe(14);
  });
});

describe('sqlite founder import', () => {
  it('round-trips the score, the 17 uses, and the carry/total split', () => {
    const db = migrated();
    expect(countWhere(db, 'hole_scores', 'user_id = ? AND deleted_at_ms IS NULL', [dataset.user.id])).toBe(18);
    const strokes = db
      .prepare('SELECT SUM(strokes) AS n FROM hole_scores WHERE user_id = ? AND deleted_at_ms IS NULL')
      .get(dataset.user.id);
    expect(Number(strokes?.n)).toBe(105);
    expect(countWhere(db, 'club_use_observations', 'user_id = ? AND calibration_eligible = 0', [dataset.user.id])).toBe(17);
    expect(shotMetricCount(db, dataset.user.id, '5i', 'carry')).toBe(0);
    expect(shotMetricCount(db, dataset.user.id, '5i', 'total')).toBe(10);
    expect(shotMetricCount(db, dataset.user.id, '8i', 'total')).toBe(11);
    expect(countWhere(db, 'gps_observations', "distance_yards = 357 AND is_shot = 0 AND kind = 'app_tee_estimate'", [])).toBe(1);
    expect(countWhere(db, 'shots', "raw_text LIKE '%357%'", [])).toBe(0);
    const bias = db.prepare('SELECT apply_automatically AS applied FROM calibrations').get();
    expect(Number(bias?.applied)).toBe(0);
    expect(countWhere(db, 'sync_outbox', 'user_id = ?', [dataset.user.id])).toBeGreaterThan(0);
    const raw = db.prepare('SELECT body FROM raw_records').get();
    expect(raw?.body).toBe(dataset.rawRecords[0]?.body);
  });

  it('rejects a carry converted from a total and a GPS row marked as a shot', () => {
    const db = migrated();
    const measurement = dataset.measurements.find((row) => row.metric === 'total' && row.aggregation === 'shot');
    if (!measurement) throw new Error('missing measurement');
    expect(() =>
      db
        .prepare(
          `INSERT INTO shot_measurements (
            id, user_id, shot_id, club_id, session_id, metric, value_num, value_text, unit, quality, aggregation,
            source_id, converted_from_metric, created_at_ms, updated_at_ms, deleted_at_ms
          ) VALUES (?, ?, ?, ?, ?, 'carry', ?, NULL, 'yards', 'derived', 'shot', ?, 'total', ?, ?, NULL)`,
        )
        .run(
          '00000000-0000-7000-8000-000000000099',
          measurement.userId,
          measurement.shotId,
          measurement.clubId,
          measurement.sessionId,
          measurement.valueNum,
          measurement.sourceId,
          measurement.createdAtMs,
          measurement.updatedAtMs,
        ),
    ).toThrow();

    const gps = dataset.gpsObservations[0];
    if (!gps) throw new Error('missing gps');
    expect(() =>
      db
        .prepare(
          `INSERT INTO gps_observations (
            id, user_id, round_id, hole_number, sequence, kind, distance_yards, is_shot, quality, source_id,
            created_at_ms, updated_at_ms, deleted_at_ms
          ) VALUES ('00000000-0000-7000-8000-000000000098', ?, ?, 1, 9, 'to_center', 357, 1, 'estimated', ?, ?, ?, NULL)`,
        )
        .run(gps.userId, gps.roundId, gps.sourceId, gps.createdAtMs, gps.updatedAtMs),
    ).toThrow();
  });

  it('enforces the 14-club in-play limit and soft-deletes the account', () => {
    const db = migrated();
    const inPlay = db.prepare(`SELECT id, status FROM bags WHERE user_id = ? AND kind = 'in_play'`).get(dataset.user.id);
    expect(inPlay?.status).toBe('provisional');
    expect(countWhere(db, 'bag_memberships', 'bag_id = ? AND deleted_at_ms IS NULL', [String(inPlay?.id)])).toBe(14);
    const twoHybrid = dataset.clubs.find((item) => item.stableKey === '2h' && !item.historicalOnly);
    if (!twoHybrid) throw new Error('2h missing');
    expect(() => addInPlayClub(db, dataset.user.id, twoHybrid.id, dataset.user.updatedAtMs)).toThrow(/14/);
    softDeleteUser(db, dataset.user.id, dataset.user.updatedAtMs + 10);
    expect(countWhere(db, 'shots', 'user_id = ? AND deleted_at_ms IS NULL', [dataset.user.id])).toBe(0);
    expect(countWhere(db, 'shot_measurements', 'user_id = ? AND deleted_at_ms IS NULL', [dataset.user.id])).toBe(0);
    expect(countWhere(db, 'audit_events', "user_id = ? AND action = 'delete_account'", [dataset.user.id])).toBe(1);
  });
});

describe('open course cache', () => {
  it('keeps High Cedars open data apart from an admin review and still rejects a GPS shot', () => {
    const db = openMemory();
    migrateAll(db);
    persistFounder(db, dataset);
    expect(schemaVersion(db)).toBe(2);
    const pilot = loadHighCedarsPilot();
    cacheOpenCourse(db, {
      courseKey: pilot.courseKey,
      record: pilot.record,
      features: pilot.features,
      osmAttribution: pilot.osmAttribution,
      osmLicense: 'ODbL-1.0',
      osmTimestamp: pilot.osmTimestamp,
      retrievedOn: '2026-10-22',
      nowMs: Date.UTC(2026, 9, 22),
    });
    expect(countWhere(db, 'open_scorecard_holes', 'par IS NOT NULL', [])).toBe(18);
    expect(countWhere(db, 'open_map_features', "license = 'ODbL-1.0'", [])).toBe(pilot.features.length);
    expect(countWhere(db, 'open_datasets', "dataset_class = 'open'", [])).toBe(2);
    const attribution = db.prepare('SELECT attribution FROM open_courses').get();
    expect(attribution?.attribution).toBe(pilot.attribution);
    recordAdminReview(db, {
      courseKey: pilot.courseKey,
      holeNumber: 1,
      osmType: 'way',
      osmId: String(pilot.quality[0]?.greenOsmId),
      decision: 'verified',
      note: 'Checked on the ground.',
      nowMs: Date.UTC(2026, 9, 22),
    });
    const review = db.prepare('SELECT dataset_class AS dataset_class, decision FROM course_admin_reviews').get();
    expect(review?.dataset_class).toBe('proprietary');
    expect(review?.decision).toBe('verified');
    const columns = db.prepare('PRAGMA table_info(course_admin_reviews)').all();
    expect(columns.some((column) => String(column.name).includes('geometry') || String(column.name).includes('lat'))).toBe(false);
    expect(() =>
      db
        .prepare(
          `INSERT INTO gps_observations (
            id, user_id, round_id, hole_number, sequence, kind, distance_yards, is_shot, quality, source_id, created_at_ms, updated_at_ms, deleted_at_ms
          ) VALUES ('00000000-0000-7000-8000-000000000099', ?, NULL, 1, 1, 'to_center', 150, 1, 'derived', ?, 0, 0, NULL)`,
        )
        .run(dataset.user.id, dataset.sources[0]?.id ?? ''),
    ).toThrow();
  });
});
