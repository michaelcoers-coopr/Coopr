-- Schema 2. Open course cache is its own dataset (ODbL). Admin reviews point at
-- an OSM id and do not copy geometry. Commercial rows do not belong in these tables.

CREATE TABLE IF NOT EXISTS open_datasets (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  license TEXT NOT NULL,
  attribution TEXT NOT NULL,
  retrieved_on TEXT NOT NULL,
  upstream_timestamp TEXT,
  dataset_class TEXT NOT NULL CHECK (dataset_class = 'open')
);

CREATE TABLE IF NOT EXISTS open_courses (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES open_datasets(id),
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  locality TEXT,
  region TEXT,
  latitude REAL,
  longitude REAL,
  hole_count INTEGER,
  par INTEGER,
  attribution TEXT NOT NULL,
  license TEXT NOT NULL,
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS open_scorecard_holes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES open_courses(id),
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER,
  stroke_index INTEGER,
  yardage_json TEXT NOT NULL,
  UNIQUE (course_id, hole_number)
);

CREATE TABLE IF NOT EXISTS open_tee_sets (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES open_courses(id),
  tee_key TEXT NOT NULL,
  tee_name TEXT,
  tee_color TEXT,
  gender TEXT,
  yardage REAL,
  par INTEGER,
  course_rating REAL,
  slope INTEGER
);

CREATE TABLE IF NOT EXISTS open_map_features (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES open_datasets(id),
  course_key TEXT NOT NULL,
  osm_type TEXT NOT NULL,
  osm_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  hole_ref INTEGER,
  par INTEGER,
  geometry_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  attribution TEXT NOT NULL,
  license TEXT NOT NULL,
  UNIQUE (dataset_id, osm_type, osm_id)
);

CREATE TABLE IF NOT EXISTS course_admin_reviews (
  id TEXT PRIMARY KEY,
  course_key TEXT NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  osm_type TEXT,
  osm_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('verified', 'rejected')),
  note TEXT,
  dataset_class TEXT NOT NULL CHECK (dataset_class = 'proprietary'),
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_open_features_course ON open_map_features (course_key, kind);

UPDATE schema_meta SET version = 2 WHERE id = 1 AND version < 2;
