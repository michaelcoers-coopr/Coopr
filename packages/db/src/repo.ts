import { createIdFactory, deterministicEntropy, uuidv7, type FounderDataset } from '@coopr/domain';
import type { SqlExecutor } from './sql-executor';

function bit(value: boolean): number {
  return value ? 1 : 0;
}

function num(row: Record<string, unknown> | undefined, key: string): number {
  const value = row?.[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

export function migrate(db: SqlExecutor, sql: string): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql);
}

export function schemaVersion(db: SqlExecutor): number {
  return num(db.prepare('SELECT version AS version FROM schema_meta WHERE id = 1').get(), 'version');
}

export function persistFounder(db: SqlExecutor, dataset: FounderDataset): void {
  const next = createIdFactory(dataset.user.updatedAtMs + 1);
  const enqueue = (table: string, rowId: string, updatedAtMs: number) => {
    db.prepare(
      `INSERT INTO sync_outbox (id, user_id, table_name, row_id, op, updated_at_ms, created_at_ms)
       VALUES (?, ?, ?, ?, 'upsert', ?, ?)`,
    ).run(next(), dataset.user.id, table, rowId, updatedAtMs, updatedAtMs);
  };

  const user = dataset.user;
  db.prepare(
    `INSERT INTO users (id, display_name, audience, name_source, created_at_ms, updated_at_ms, deleted_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, user.displayName, user.audience, user.nameSource, user.createdAtMs, user.updatedAtMs, user.deletedAtMs);
  enqueue('users', user.id, user.updatedAtMs);

  const player = dataset.player;
  db.prepare(
    `INSERT INTO player_profiles (
      id, user_id, dominant_hand, dominant_hand_quality, dominant_hand_confirmed_on,
      handicap_value, handicap_official, handicap_quality, created_at_ms, updated_at_ms, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    player.id,
    player.userId,
    player.dominantHand,
    player.dominantHandQuality,
    player.dominantHandConfirmedOn,
    player.handicapValue,
    bit(player.handicapOfficial),
    player.handicapQuality,
    player.createdAtMs,
    player.updatedAtMs,
    player.deletedAtMs,
  );
  enqueue('player_profiles', player.id, player.updatedAtMs);

  const caddie = dataset.caddie;
  db.prepare(
    `INSERT INTO caddie_profiles (id, user_id, name, personality, created_at_ms, updated_at_ms, deleted_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(caddie.id, caddie.userId, caddie.name, caddie.personality, caddie.createdAtMs, caddie.updatedAtMs, caddie.deletedAtMs);
  enqueue('caddie_profiles', caddie.id, caddie.updatedAtMs);

  for (const source of dataset.sources) {
    db.prepare(
      `INSERT INTO data_sources (id, user_id, kind, ref, captured_on, quality, note, created_at_ms, updated_at_ms, deleted_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      source.id,
      source.userId,
      source.kind,
      source.ref,
      source.capturedOn,
      source.quality,
      source.note,
      source.createdAtMs,
      source.updatedAtMs,
      source.deletedAtMs,
    );
    enqueue('data_sources', source.id, source.updatedAtMs);
  }

  for (const raw of dataset.rawRecords) {
    db.prepare(
      `INSERT INTO raw_records (id, user_id, source_id, label, body, created_at_ms, updated_at_ms, deleted_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(raw.id, raw.userId, raw.sourceId, raw.label, raw.body, raw.createdAtMs, raw.updatedAtMs, raw.deletedAtMs);
    enqueue('raw_records', raw.id, raw.updatedAtMs);
  }

  for (const club of dataset.clubs) {
    db.prepare(
      `INSERT INTO clubs (
        id, user_id, stable_key, label, category, loft_deg, bounce_deg, brand, model, flex, shaft_model,
        shaft_material, ownership, historical_only, raw_text, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      club.id,
      club.userId,
      club.stableKey,
      club.label,
      club.category,
      club.loftDeg,
      club.bounceDeg,
      club.brand,
      club.model,
      club.flex,
      club.shaftModel,
      club.shaftMaterial,
      club.ownership,
      bit(club.historicalOnly),
      club.rawText,
      club.createdAtMs,
      club.updatedAtMs,
      club.deletedAtMs,
    );
    enqueue('clubs', club.id, club.updatedAtMs);
  }

  for (const bag of dataset.bags) {
    db.prepare(
      `INSERT INTO bags (id, user_id, name, kind, created_at_ms, updated_at_ms, deleted_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(bag.id, bag.userId, bag.name, bag.kind, bag.createdAtMs, bag.updatedAtMs, bag.deletedAtMs);
    enqueue('bags', bag.id, bag.updatedAtMs);
  }

  for (const membership of dataset.memberships) {
    db.prepare(
      `INSERT INTO bag_memberships (id, user_id, bag_id, club_id, created_at_ms, updated_at_ms, deleted_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      membership.id,
      membership.userId,
      membership.bagId,
      membership.clubId,
      membership.createdAtMs,
      membership.updatedAtMs,
      membership.deletedAtMs,
    );
    enqueue('bag_memberships', membership.id, membership.updatedAtMs);
  }

  for (const session of dataset.sessions) {
    db.prepare(
      `INSERT INTO simulator_sessions (
        id, user_id, environment, label, validation_required, validation_note, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      session.id,
      session.userId,
      session.environment,
      session.label,
      bit(session.validationRequired),
      session.validationNote,
      session.createdAtMs,
      session.updatedAtMs,
      session.deletedAtMs,
    );
    enqueue('simulator_sessions', session.id, session.updatedAtMs);
  }

  for (const shot of dataset.shots) {
    db.prepare(
      `INSERT INTO shots (
        id, user_id, club_id, session_id, environment, swing_mode, shot_number, quality_label,
        calibration_eligible, source_id, raw_text, note, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      shot.id,
      shot.userId,
      shot.clubId,
      shot.sessionId,
      shot.environment,
      shot.swingMode,
      shot.shotNumber,
      shot.qualityLabel,
      bit(shot.calibrationEligible),
      shot.sourceId,
      shot.rawText,
      shot.note,
      shot.createdAtMs,
      shot.updatedAtMs,
      shot.deletedAtMs,
    );
    enqueue('shots', shot.id, shot.updatedAtMs);
  }

  for (const measurement of dataset.measurements) {
    db.prepare(
      `INSERT INTO shot_measurements (
        id, user_id, shot_id, club_id, session_id, metric, value_num, value_text, unit, quality, aggregation,
        source_id, converted_from_metric, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      measurement.id,
      measurement.userId,
      measurement.shotId,
      measurement.clubId,
      measurement.sessionId,
      measurement.metric,
      measurement.valueNum,
      measurement.valueText,
      measurement.unit,
      measurement.quality,
      measurement.aggregation,
      measurement.sourceId,
      measurement.convertedFromMetric,
      measurement.createdAtMs,
      measurement.updatedAtMs,
      measurement.deletedAtMs,
    );
    enqueue('shot_measurements', measurement.id, measurement.updatedAtMs);
  }

  const round = dataset.round;
  db.prepare(
    `INSERT INTO rounds (
      id, user_id, course_name, location, played_on, tee_name, yardage, par, course_rating, slope, rating_quality,
      stated_gross, stated_front, stated_back, stated_plus, displayed_net, displayed_net_quality, source_id,
      created_at_ms, updated_at_ms, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    round.id,
    round.userId,
    round.courseName,
    round.location,
    round.playedOn,
    round.teeName,
    round.yardage,
    round.par,
    round.courseRating,
    round.slope,
    round.ratingQuality,
    round.statedGross,
    round.statedFront,
    round.statedBack,
    round.statedPlus,
    round.displayedNet,
    round.displayedNetQuality,
    round.sourceId,
    round.createdAtMs,
    round.updatedAtMs,
    round.deletedAtMs,
  );
  enqueue('rounds', round.id, round.updatedAtMs);

  for (const candidate of dataset.ratingCandidates) {
    db.prepare(
      `INSERT INTO rating_candidates (
        id, user_id, round_id, course_rating, slope, quality, selected, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      candidate.id,
      candidate.userId,
      candidate.roundId,
      candidate.courseRating,
      candidate.slope,
      candidate.quality,
      bit(candidate.selected),
      candidate.createdAtMs,
      candidate.updatedAtMs,
      candidate.deletedAtMs,
    );
    enqueue('rating_candidates', candidate.id, candidate.updatedAtMs);
  }

  for (const hole of dataset.holeScores) {
    db.prepare(
      `INSERT INTO hole_scores (
        id, user_id, round_id, hole_number, par, strokes, putts, penalties, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      hole.id,
      hole.userId,
      hole.roundId,
      hole.holeNumber,
      hole.par,
      hole.strokes,
      hole.putts,
      hole.penalties,
      hole.createdAtMs,
      hole.updatedAtMs,
      hole.deletedAtMs,
    );
    enqueue('hole_scores', hole.id, hole.updatedAtMs);
  }

  for (const gps of dataset.gpsObservations) {
    db.prepare(
      `INSERT INTO gps_observations (
        id, user_id, round_id, hole_number, sequence, kind, distance_yards, is_shot, quality, source_id,
        created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      gps.id,
      gps.userId,
      gps.roundId,
      gps.holeNumber,
      gps.sequence,
      gps.kind,
      gps.distanceYards,
      bit(gps.isShot),
      gps.quality,
      gps.sourceId,
      gps.createdAtMs,
      gps.updatedAtMs,
      gps.deletedAtMs,
    );
    enqueue('gps_observations', gps.id, gps.updatedAtMs);
  }

  for (const use of dataset.clubUses) {
    db.prepare(
      `INSERT INTO club_use_observations (
        id, user_id, round_id, hole_number, distance_yards, club_id, swing_mode_text, outcome,
        calibration_eligible, quality, source_id, raw_text, created_at_ms, updated_at_ms, deleted_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      use.id,
      use.userId,
      use.roundId,
      use.holeNumber,
      use.distanceYards,
      use.clubId,
      use.swingModeText,
      use.outcome,
      bit(use.calibrationEligible),
      use.quality,
      use.sourceId,
      use.rawText,
      use.createdAtMs,
      use.updatedAtMs,
      use.deletedAtMs,
    );
    enqueue('club_use_observations', use.id, use.updatedAtMs);
  }

  const calibration = dataset.calibration;
  db.prepare(
    `INSERT INTO calibrations (
      id, user_id, scope, status, delta_low, delta_high, confidence, apply_automatically, hypothesis, source_id,
      created_at_ms, updated_at_ms, deleted_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    calibration.id,
    calibration.userId,
    calibration.scope,
    calibration.status,
    calibration.deltaLow,
    calibration.deltaHigh,
    calibration.confidence,
    bit(calibration.applyAutomatically),
    calibration.hypothesis,
    calibration.sourceId,
    calibration.createdAtMs,
    calibration.updatedAtMs,
    calibration.deletedAtMs,
  );
  enqueue('calibrations', calibration.id, calibration.updatedAtMs);

  for (const note of dataset.clubNotes) {
    db.prepare(
      `INSERT INTO club_notes (id, user_id, club_id, body, quality, source_id, created_at_ms, updated_at_ms, deleted_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      note.id,
      note.userId,
      note.clubId,
      note.body,
      note.quality,
      note.sourceId,
      note.createdAtMs,
      note.updatedAtMs,
      note.deletedAtMs,
    );
    enqueue('club_notes', note.id, note.updatedAtMs);
  }

  for (const event of dataset.audit) {
    db.prepare(
      `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, payload_json, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(event.id, event.userId, event.action, event.entityType, event.entityId, event.payloadJson, event.createdAtMs);
  }
}

export function countWhere(db: SqlExecutor, table: string, whereSql: string, params: Array<string | number | null>): number {
  if (!/^[a-z_]+$/.test(table)) throw new Error('bad table');
  return num(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${whereSql}`).get(...params), 'n');
}

export function shotMetricCount(db: SqlExecutor, userId: string, stableKey: string, metric: string): number {
  return num(
    db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM shot_measurements m
         JOIN clubs c ON c.id = m.club_id
         WHERE m.user_id = ? AND c.stable_key = ? AND c.historical_only = 0
           AND m.metric = ? AND m.aggregation = 'shot' AND m.deleted_at_ms IS NULL`,
      )
      .get(userId, stableKey, metric),
    'n',
  );
}

export function addInPlayClub(db: SqlExecutor, userId: string, clubId: string, nowMs: number): void {
  const bag = db.prepare(`SELECT id FROM bags WHERE user_id = ? AND kind = 'in_play' AND deleted_at_ms IS NULL`).get(userId);
  const bagId = bag?.id;
  if (typeof bagId !== 'string') throw new Error('in-play bag missing');
  const count = num(
    db.prepare(`SELECT COUNT(*) AS n FROM bag_memberships WHERE bag_id = ? AND deleted_at_ms IS NULL`).get(bagId),
    'n',
  );
  if (count >= 14) throw new Error('In-play bag is limited to 14 clubs');
  const id = uuidv7(nowMs, deterministicEntropy(10_000 + count));
  db.prepare(
    `INSERT INTO bag_memberships (id, user_id, bag_id, club_id, created_at_ms, updated_at_ms, deleted_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, userId, bagId, clubId, nowMs, nowMs);
}

const OWNED_TABLES = [
  'player_profiles',
  'caddie_profiles',
  'data_sources',
  'raw_records',
  'clubs',
  'bags',
  'bag_memberships',
  'simulator_sessions',
  'shots',
  'shot_measurements',
  'rounds',
  'rating_candidates',
  'hole_scores',
  'gps_observations',
  'club_use_observations',
  'calibrations',
  'club_notes',
] as const;

export function softDeleteUser(db: SqlExecutor, userId: string, nowMs: number): void {
  for (const table of OWNED_TABLES) {
    db.prepare(`UPDATE ${table} SET deleted_at_ms = ?, updated_at_ms = ? WHERE user_id = ? AND deleted_at_ms IS NULL`).run(
      nowMs,
      nowMs,
      userId,
    );
  }
  db.prepare(`UPDATE users SET deleted_at_ms = ?, updated_at_ms = ? WHERE id = ? AND deleted_at_ms IS NULL`).run(nowMs, nowMs, userId);
  const id = uuidv7(nowMs, deterministicEntropy(9001));
  db.prepare(
    `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, payload_json, created_at_ms)
     VALUES (?, ?, 'delete_account', 'user', ?, '{}', ?)`,
  ).run(id, userId, userId, nowMs);
}
