import { sqlite } from './client';

// Forward-only, versioned SQL migrations applied on launch before any read. We run
// raw SQL (rather than drizzle-kit codegen) so the local store has an explicit,
// reviewable migration history and no build-time codegen dependency. Drizzle ORM is
// still used for typed queries against the same tables. Column names mirror
// packages/core/src/db/schema.ts exactly.

const SYNC = 'created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER';

const INIT = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL, email TEXT, is_anonymous INTEGER NOT NULL DEFAULT 1, ${SYNC}
);
CREATE TABLE IF NOT EXISTS golfer_profiles (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, name TEXT, handicap REAL,
  risk_preference TEXT NOT NULL DEFAULT 'neutral', caddie_profile_id TEXT,
  distance_unit TEXT NOT NULL DEFAULT 'yards', partial_wedge_system TEXT NOT NULL DEFAULT 'percent',
  notes TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS caddie_profiles (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, voice TEXT,
  personality TEXT, humor_level REAL NOT NULL DEFAULT 0.3, detail_level REAL NOT NULL DEFAULT 0.5,
  coaching_style TEXT, avatar TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS bags (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'My Bag',
  is_active INTEGER NOT NULL DEFAULT 1, ${SYNC}
);
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY NOT NULL, bag_id TEXT NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL,
  manufacturer TEXT, model TEXT, loft_deg REAL, shaft_flex TEXT, shaft_model TEXT,
  shaft_material TEXT, bounce_deg REAL, in_bag INTEGER NOT NULL DEFAULT 1, ${SYNC}
);
CREATE TABLE IF NOT EXISTS club_feedback (
  id TEXT PRIMARY KEY NOT NULL, club_id TEXT NOT NULL, confidence TEXT, note TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date INTEGER NOT NULL, environment TEXT NOT NULL,
  intent TEXT, validation_required INTEGER NOT NULL DEFAULT 0, notes TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS shots (
  id TEXT PRIMARY KEY NOT NULL, player_id TEXT NOT NULL, club_id TEXT NOT NULL, club_label TEXT NOT NULL,
  loft_deg REAL, session_id TEXT NOT NULL, session_date INTEGER NOT NULL, shot_number INTEGER,
  environment TEXT NOT NULL, swing_mode TEXT NOT NULL, carry_yards REAL, total_yards REAL,
  offline_yards REAL, side TEXT, club_speed_mph REAL, ball_speed_mph REAL, smash_factor REAL,
  launch_angle_deg REAL, spin_rate_rpm REAL, spin_axis_deg REAL, peak_height_yards REAL,
  landing_angle_deg REAL, attack_angle_deg REAL, club_path_deg REAL, face_angle_deg REAL,
  face_to_path_deg REAL, dynamic_loft_deg REAL, impact_height REAL, impact_offset REAL,
  quality_label TEXT, quality_reason TEXT, source TEXT, source_image TEXT, notes TEXT, ${SYNC}
);
CREATE INDEX IF NOT EXISTS idx_shots_club ON shots (club_id);
CREATE INDEX IF NOT EXISTS idx_shots_player ON shots (player_id);
CREATE TABLE IF NOT EXISTS club_profiles (
  id TEXT PRIMARY KEY NOT NULL, club_id TEXT NOT NULL, swing_mode TEXT NOT NULL, environment TEXT NOT NULL,
  metric TEXT NOT NULL, sample_size INTEGER NOT NULL, stock_distance_yards REAL, confidence REAL NOT NULL,
  stats TEXT NOT NULL, computed_at INTEGER NOT NULL, ${SYNC}
);
CREATE TABLE IF NOT EXISTS calibration_profiles (
  id TEXT PRIMARY KEY NOT NULL, player_id TEXT NOT NULL, scope TEXT NOT NULL, club_id TEXT,
  status TEXT NOT NULL, delta_min_yards REAL, delta_max_yards REAL, confidence TEXT NOT NULL,
  apply_automatically INTEGER NOT NULL DEFAULT 0, note TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY NOT NULL, player_id TEXT NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL, ${SYNC}
);
CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, course_id TEXT, course_name TEXT, tees TEXT,
  date INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'in_progress', ${SYNC}
);
CREATE TABLE IF NOT EXISTS hole_scores (
  id TEXT PRIMARY KEY NOT NULL, round_id TEXT NOT NULL, hole INTEGER NOT NULL, par INTEGER, strokes INTEGER,
  putts INTEGER, penalties INTEGER, fairway TEXT, gir INTEGER, bunker INTEGER, notes TEXT,
  clubs_used TEXT, ${SYNC}
);
CREATE TABLE IF NOT EXISTS course_shots (
  id TEXT PRIMARY KEY NOT NULL, round_id TEXT NOT NULL, hole INTEGER NOT NULL, shot_number INTEGER NOT NULL,
  club_id TEXT, start_lat REAL, start_lon REAL, end_lat REAL, end_lon REAL, measured_distance_yards REAL,
  lie_start TEXT, lie_end TEXT, strategic_target TEXT, result TEXT, penalty INTEGER, timestamp INTEGER, ${SYNC}
);
CREATE TABLE IF NOT EXISTS integration_connections (
  id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, service TEXT NOT NULL, state TEXT NOT NULL,
  last_sync_at INTEGER, ${SYNC}
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, props TEXT, ts INTEGER NOT NULL, flushed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY NOT NULL, table_name TEXT NOT NULL, row_id TEXT NOT NULL, op TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const SETTINGS = `
CREATE TABLE IF NOT EXISTS app_settings (
  k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL
);
`;

const MIGRATIONS: Migration[] = [
  { version: 1, name: '0000_init', sql: INIT },
  { version: 2, name: '0001_app_settings', sql: SETTINGS },
];

export function runMigrations(): void {
  sqlite.execSync(
    'CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at INTEGER NOT NULL);',
  );
  const appliedRow = sqlite.getFirstSync<{ v: number | null }>('SELECT MAX(version) AS v FROM _migrations;');
  const applied = appliedRow?.v ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= applied) continue;
    sqlite.withTransactionSync(() => {
      sqlite.execSync(m.sql);
      sqlite.runSync('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?);', [
        m.version,
        m.name,
        nowMs(),
      ]);
    });
  }
}

function nowMs(): number {
  return Date.now();
}
