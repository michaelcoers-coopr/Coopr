// Local SQLite schema (authoritative offline store). Drizzle + expo-sqlite.
// Conventions: text UUIDv7 ids; every synced row carries created_at/updated_at (ms
// epoch) and a nullable deleted_at (soft delete). Booleans are integer 0/1. Distances
// in yards, speeds mph, spin rpm, angles degrees. Unknown stays NULL — never a
// sentinel zero. Derived tables (club_profiles) are caches, recomputed from shots.

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

const sync = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  isAnonymous: integer('is_anonymous').notNull().default(1),
  ...sync,
});

export const golferProfiles = sqliteTable('golfer_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name'),
  handicap: real('handicap'),
  riskPreference: text('risk_preference').notNull().default('neutral'),
  caddieProfileId: text('caddie_profile_id'),
  distanceUnit: text('distance_unit').notNull().default('yards'),
  partialWedgeSystem: text('partial_wedge_system').notNull().default('percent'),
  notes: text('notes'),
  ...sync,
});

export const caddieProfiles = sqliteTable('caddie_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  voice: text('voice'),
  personality: text('personality'),
  humorLevel: real('humor_level').notNull().default(0.3),
  detailLevel: real('detail_level').notNull().default(0.5),
  coachingStyle: text('coaching_style'),
  avatar: text('avatar'),
  ...sync,
});

export const bags = sqliteTable('bags', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull().default('My Bag'),
  isActive: integer('is_active').notNull().default(1),
  ...sync,
});

export const clubs = sqliteTable('clubs', {
  id: text('id').primaryKey(),
  bagId: text('bag_id').notNull(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  manufacturer: text('manufacturer'),
  model: text('model'),
  loftDeg: real('loft_deg'),
  shaftFlex: text('shaft_flex'),
  shaftModel: text('shaft_model'),
  shaftMaterial: text('shaft_material'),
  bounceDeg: real('bounce_deg'),
  inBag: integer('in_bag').notNull().default(1),
  ...sync,
});

// Subjective feedback, kept separate from measured data (spec section 11).
export const clubFeedback = sqliteTable('club_feedback', {
  id: text('id').primaryKey(),
  clubId: text('club_id').notNull(),
  confidence: text('confidence'),
  note: text('note'),
  ...sync,
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: integer('date').notNull(),
  environment: text('environment').notNull(),
  intent: text('intent'),
  validationRequired: integer('validation_required').notNull().default(0),
  notes: text('notes'),
  ...sync,
});

export const shots = sqliteTable('shots', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  clubId: text('club_id').notNull(),
  clubLabel: text('club_label').notNull(),
  loftDeg: real('loft_deg'),
  sessionId: text('session_id').notNull(),
  sessionDate: integer('session_date').notNull(),
  shotNumber: integer('shot_number'),
  environment: text('environment').notNull(),
  swingMode: text('swing_mode').notNull(),
  carryYards: real('carry_yards'),
  totalYards: real('total_yards'),
  offlineYards: real('offline_yards'),
  side: text('side'),
  clubSpeedMph: real('club_speed_mph'),
  ballSpeedMph: real('ball_speed_mph'),
  smashFactor: real('smash_factor'),
  launchAngleDeg: real('launch_angle_deg'),
  spinRateRpm: real('spin_rate_rpm'),
  spinAxisDeg: real('spin_axis_deg'),
  peakHeightYards: real('peak_height_yards'),
  landingAngleDeg: real('landing_angle_deg'),
  attackAngleDeg: real('attack_angle_deg'),
  clubPathDeg: real('club_path_deg'),
  faceAngleDeg: real('face_angle_deg'),
  faceToPathDeg: real('face_to_path_deg'),
  dynamicLoftDeg: real('dynamic_loft_deg'),
  impactHeight: real('impact_height'),
  impactOffset: real('impact_offset'),
  qualityLabel: text('quality_label'),
  qualityReason: text('quality_reason'),
  source: text('source'),
  sourceImage: text('source_image'),
  notes: text('notes'),
  ...sync,
});

// Derived cache. Recomputed from shots; never authoritative. Stats stored as JSON.
export const clubProfiles = sqliteTable('club_profiles', {
  id: text('id').primaryKey(), // `${clubId}:${swingMode}:${environment}`
  clubId: text('club_id').notNull(),
  swingMode: text('swing_mode').notNull(),
  environment: text('environment').notNull(),
  metric: text('metric').notNull(),
  sampleSize: integer('sample_size').notNull(),
  stockDistanceYards: real('stock_distance_yards'),
  confidence: real('confidence').notNull(),
  stats: text('stats').notNull(), // JSON blob of the full ClubProfile
  computedAt: integer('computed_at').notNull(),
  ...sync,
});

export const calibrationProfiles = sqliteTable('calibration_profiles', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  scope: text('scope').notNull(),
  clubId: text('club_id'),
  status: text('status').notNull(),
  deltaMinYards: real('delta_min_yards'),
  deltaMaxYards: real('delta_max_yards'),
  confidence: text('confidence').notNull(),
  applyAutomatically: integer('apply_automatically').notNull().default(0),
  note: text('note'),
  ...sync,
});

export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  input: text('input').notNull(), // JSON RecommendationInput
  output: text('output').notNull(), // JSON Recommendation
  createdAtMs: integer('created_at_ms').notNull(),
  ...sync,
});

export const rounds = sqliteTable('rounds', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  courseId: text('course_id'),
  courseName: text('course_name'),
  tees: text('tees'),
  date: integer('date').notNull(),
  status: text('status').notNull().default('in_progress'),
  ...sync,
});

export const holeScores = sqliteTable('hole_scores', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull(),
  hole: integer('hole').notNull(),
  par: integer('par'),
  strokes: integer('strokes'),
  putts: integer('putts'),
  penalties: integer('penalties'),
  fairway: text('fairway'), // hit | left | right | short | long | null
  gir: integer('gir'),
  bunker: integer('bunker'),
  notes: text('notes'),
  clubsUsed: text('clubs_used'), // JSON array
  ...sync,
});

export const courseShots = sqliteTable('course_shots', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull(),
  hole: integer('hole').notNull(),
  shotNumber: integer('shot_number').notNull(),
  clubId: text('club_id'),
  startLat: real('start_lat'),
  startLon: real('start_lon'),
  endLat: real('end_lat'),
  endLon: real('end_lon'),
  measuredDistanceYards: real('measured_distance_yards'),
  lieStart: text('lie_start'),
  lieEnd: text('lie_end'),
  strategicTarget: text('strategic_target'),
  result: text('result'),
  penalty: integer('penalty'),
  timestamp: integer('timestamp'),
  ...sync,
});

export const integrationConnections = sqliteTable('integration_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  service: text('service').notNull(),
  state: text('state').notNull(),
  lastSyncAt: integer('last_sync_at'),
  ...sync,
});

export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  props: text('props'), // JSON
  ts: integer('ts').notNull(),
  flushed: integer('flushed').notNull().default(0),
});

// Pending local changes awaiting sync push.
export const syncOutbox = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),
  op: text('op').notNull(), // upsert | delete
  updatedAt: integer('updated_at').notNull(),
});

export const schema = {
  users,
  golferProfiles,
  caddieProfiles,
  bags,
  clubs,
  clubFeedback,
  sessions,
  shots,
  clubProfiles,
  calibrationProfiles,
  recommendations,
  rounds,
  holeScores,
  courseShots,
  integrationConnections,
  analyticsEvents,
  syncOutbox,
};
