-- COOPR 2.0 schema version 1. SQLite, offline source of truth.
-- Distances are yards. Carry and total are different metrics.
-- converted_from_metric cannot be set: a total is never stored as a carry.

CREATE TABLE schema_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

INSERT INTO schema_meta (id, version, updated_at_ms) VALUES (1, 1, 0);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('private', 'public_demo')),
  name_source TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE player_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  dominant_hand TEXT CHECK (dominant_hand IN ('right', 'left') OR dominant_hand IS NULL),
  dominant_hand_quality TEXT NOT NULL,
  dominant_hand_confirmed_on TEXT,
  handicap_value REAL,
  handicap_official INTEGER NOT NULL CHECK (handicap_official IN (0, 1)),
  handicap_quality TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE caddie_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  personality TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  captured_on TEXT,
  quality TEXT NOT NULL,
  note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE raw_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  stable_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  loft_deg REAL,
  bounce_deg REAL,
  brand TEXT,
  model TEXT,
  flex TEXT,
  shaft_model TEXT,
  shaft_material TEXT,
  ownership TEXT NOT NULL CHECK (ownership IN ('owned', 'not_owned', 'unverified')),
  historical_only INTEGER NOT NULL CHECK (historical_only IN (0, 1)),
  raw_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE bags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('owned', 'in_play', 'testing', 'historical')),
  status TEXT CHECK (status IN ('provisional', 'confirmed') OR status IS NULL),
  note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE bag_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  bag_id TEXT NOT NULL REFERENCES bags(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER,
  UNIQUE (bag_id, club_id)
);

CREATE TABLE simulator_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  environment TEXT NOT NULL CHECK (environment IN ('simulator', 'range', 'course')),
  label TEXT NOT NULL,
  validation_required INTEGER NOT NULL CHECK (validation_required IN (0, 1)),
  validation_note TEXT,
  source_id TEXT REFERENCES data_sources(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  session_id TEXT REFERENCES simulator_sessions(id),
  environment TEXT NOT NULL CHECK (environment IN ('simulator', 'range', 'course')),
  swing_mode TEXT NOT NULL,
  shot_number INTEGER,
  quality_label TEXT NOT NULL,
  calibration_eligible INTEGER NOT NULL CHECK (calibration_eligible IN (0, 1)),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  raw_text TEXT NOT NULL,
  note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE shot_measurements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  shot_id TEXT REFERENCES shots(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  session_id TEXT REFERENCES simulator_sessions(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'carry', 'total', 'club_speed', 'ball_speed', 'smash', 'spin', 'attack', 'path',
    'face', 'face_to_path', 'launch', 'carry_side', 'carry_dispersion', 'total_dispersion'
  )),
  value_num REAL,
  value_text TEXT,
  unit TEXT,
  quality TEXT NOT NULL CHECK (quality IN (
    'measured', 'user_confirmed', 'estimated', 'derived', 'provisional', 'unknown'
  )),
  aggregation TEXT NOT NULL CHECK (aggregation IN (
    'shot', 'session_average', 'usable_strike_average', 'best', 'stated'
  )),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  converted_from_metric TEXT CHECK (converted_from_metric IS NULL),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_name TEXT NOT NULL,
  location TEXT,
  played_on TEXT NOT NULL,
  tee_name TEXT,
  yardage REAL,
  par INTEGER,
  course_rating REAL,
  slope INTEGER,
  rating_quality TEXT NOT NULL,
  stated_gross INTEGER,
  stated_front INTEGER,
  stated_back INTEGER,
  stated_plus INTEGER,
  displayed_net INTEGER,
  displayed_net_quality TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE rating_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  round_id TEXT NOT NULL REFERENCES rounds(id),
  course_rating REAL NOT NULL,
  slope INTEGER NOT NULL,
  quality TEXT NOT NULL,
  selected INTEGER NOT NULL CHECK (selected IN (0, 1)),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE hole_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  round_id TEXT NOT NULL REFERENCES rounds(id),
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER,
  strokes INTEGER NOT NULL,
  putts INTEGER,
  penalties INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER,
  UNIQUE (round_id, hole_number)
);

CREATE TABLE gps_observations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  round_id TEXT REFERENCES rounds(id),
  hole_number INTEGER NOT NULL,
  sequence INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('to_center', 'app_tee_estimate')),
  distance_yards REAL NOT NULL,
  is_shot INTEGER NOT NULL CHECK (is_shot = 0),
  quality TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE club_use_observations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  round_id TEXT REFERENCES rounds(id),
  hole_number INTEGER NOT NULL,
  distance_yards REAL NOT NULL,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  swing_mode_text TEXT NOT NULL,
  outcome TEXT,
  calibration_eligible INTEGER NOT NULL CHECK (calibration_eligible = 0),
  quality TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  raw_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE calibrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('suspected', 'verified')),
  delta_low REAL,
  delta_high REAL,
  confidence TEXT NOT NULL,
  apply_automatically INTEGER NOT NULL CHECK (apply_automatically IN (0, 1)),
  hypothesis TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE club_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  club_id TEXT NOT NULL REFERENCES clubs(id),
  body TEXT NOT NULL,
  quality TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE sync_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  updated_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX idx_shots_user ON shots (user_id);
CREATE INDEX idx_measurements_club_metric ON shot_measurements (club_id, metric);
CREATE INDEX idx_outbox_user ON sync_outbox (user_id);
CREATE INDEX idx_hole_scores_round ON hole_scores (round_id);
