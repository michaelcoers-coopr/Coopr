# COOPR 2.0 data model (schema version 1)

SQLite migration: `packages/db/sql/sqlite/001_init.sql`.
Postgres mirror, not applied to a server yet: `packages/db/sql/postgres/001_init.sql`.

The app embeds the SQLite text from `@coopr/db`. A test fails if that embed drifts from the file.

## Rules

- Ids are UUIDv7 strings created on the device.
- Synced rows have `created_at_ms`, `updated_at_ms`, and nullable `deleted_at_ms`.
- Deletes are soft. Export skips deleted rows. Account deletion soft-deletes every owned table and writes an audit event.
- `sync_outbox` queues upserts. Reconciliation is last-write-wins per row. This milestone does not run a cloud sync.
- Distances are yards. Speed is mph. Angles are degrees. Spin is rpm.
- Unknown is null. There is no zero placeholder.
- Quality is one of `measured`, `user_confirmed`, `estimated`, `derived`, `provisional`, `unknown`.
- `shot_measurements.metric` is `carry` or `total` or a named launch field. `converted_from_metric` must stay null.
- `gps_observations.is_shot` must be 0. A GPS distance is not a carry.
- `club_use_observations.calibration_eligible` must be 0.
- Bag kind is `owned`, `in_play`, `testing`, or `historical`. In-play inserts stop at 14 clubs.
- Shots are the only rows that feed a distance profile, and only when `aggregation = 'shot'`. Session averages, usable-strike summaries, and "best" shots do not.
- Environment is `simulator`, `range`, or `course`. Profiles are not merged across those.
- `audience = 'private'` cannot be opened by the public-demo guard.

## Tables

`users`, `player_profiles`, `caddie_profiles`, `data_sources`, `raw_records`, `clubs`, `bags`, `bag_memberships`, `simulator_sessions`, `shots`, `shot_measurements`, `rounds`, `rating_candidates`, `hole_scores`, `gps_observations`, `club_use_observations`, `calibrations`, `club_notes`, `audit_events`, `sync_outbox`, `schema_meta`.

The founder transcript is stored whole in `raw_records.body`. Normalized rows point at the same data source. Event dates (`played_on`, `dominant_hand_confirmed_on`) are dates from the source. `created_at_ms` on the import is a sync clock (`2026-10-22T00:00:00Z`), not a claim about when a shot was hit.
