import { sqlite } from './client';
import { markOnboardingComplete } from './settings';
import {
  SEED_PROFILE,
  SEED_BAG_ID,
  SEED_PLAYER_ID,
  FOUNDING_SESSION_DATE,
  seedClubs,
  seedClubFeedback,
  seedShots,
  seedCalibration,
  SEED_SESSIONS,
  type Shot,
} from '@coopr/core';

// Loads the founding dataset into the local store on first launch of a dev/demo
// build. Uses raw parameterized SQL for reliability. Idempotent: no-op if a user
// already exists.

type Bind = string | number | null;

function normalize(v: unknown): Bind {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

function insert(table: string, row: Record<string, unknown>): void {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((c) => normalize(row[c]));
  sqlite.runSync(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders});`, values);
}

const now = FOUNDING_SESSION_DATE;
const sync = { created_at: now, updated_at: now, deleted_at: null };

function shotToRow(s: Shot): Record<string, unknown> {
  return {
    id: s.id, player_id: s.playerId, club_id: s.clubId, club_label: s.clubLabel, loft_deg: s.loftDeg,
    session_id: s.sessionId, session_date: s.sessionDate, shot_number: s.shotNumber,
    environment: s.environment, swing_mode: s.swingMode, carry_yards: s.carryYards, total_yards: s.totalYards,
    offline_yards: s.offlineYards, side: s.side, club_speed_mph: s.clubSpeedMph, ball_speed_mph: s.ballSpeedMph,
    smash_factor: s.smashFactor, launch_angle_deg: s.launchAngleDeg, spin_rate_rpm: s.spinRateRpm,
    spin_axis_deg: s.spinAxisDeg, peak_height_yards: s.peakHeightYards, landing_angle_deg: s.landingAngleDeg,
    attack_angle_deg: s.attackAngleDeg, club_path_deg: s.clubPathDeg, face_angle_deg: s.faceAngleDeg,
    face_to_path_deg: s.faceToPathDeg, dynamic_loft_deg: s.dynamicLoftDeg, impact_height: s.impactHeight,
    impact_offset: s.impactOffset, quality_label: s.qualityLabel, quality_reason: s.qualityReason,
    source: s.source ?? 'seed', source_image: s.sourceImage, notes: s.notes, ...sync,
  };
}

export function seedIfEmpty(): void {
  const existing = sqlite.getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM users;');
  if ((existing?.c ?? 0) > 0) return;

  sqlite.withTransactionSync(() => {
    insert('users', { id: SEED_PLAYER_ID, email: null, is_anonymous: 1, ...sync });

    insert('caddie_profiles', {
      id: 'caddie-seed', user_id: SEED_PLAYER_ID, name: 'Coop', voice: null, personality: 'Straight Shooter',
      humor_level: 0.3, detail_level: 0.6, coaching_style: 'direct', avatar: null, ...sync,
    });

    insert('golfer_profiles', {
      id: 'gp-seed', user_id: SEED_PLAYER_ID, name: SEED_PROFILE.name, handicap: SEED_PROFILE.handicap,
      risk_preference: 'neutral', caddie_profile_id: 'caddie-seed', distance_unit: 'yards',
      partial_wedge_system: 'percent', notes: SEED_PROFILE.notes, ...sync,
    });

    insert('bags', { id: SEED_BAG_ID, user_id: SEED_PLAYER_ID, name: 'Founding Bag', is_active: 1, ...sync });

    for (const c of seedClubs) {
      insert('clubs', {
        id: c.id, bag_id: c.bagId, type: c.type, label: c.label, manufacturer: c.manufacturer, model: c.model,
        loft_deg: c.loftDeg, shaft_flex: c.shaftFlex, shaft_model: c.shaftModel, shaft_material: c.shaftMaterial,
        bounce_deg: c.bounceDeg, in_bag: c.inBag, ...sync,
      });
    }

    for (const f of seedClubFeedback) {
      insert('club_feedback', { id: f.id, club_id: f.clubId, confidence: f.confidence, note: f.note, ...sync });
    }

    for (const s of SEED_SESSIONS) {
      insert('sessions', {
        id: s.id, user_id: SEED_PLAYER_ID, date: s.date, environment: s.environment, intent: 'full_bag',
        validation_required: s.validationRequired, notes: null, ...sync,
      });
    }

    for (const s of seedShots) insert('shots', shotToRow(s));

    const cal = seedCalibration;
    insert('calibration_profiles', {
      id: cal.id, player_id: cal.playerId, scope: cal.scope, club_id: cal.clubId, status: cal.status,
      delta_min_yards: cal.deltaMinYards, delta_max_yards: cal.deltaMaxYards, confidence: cal.confidence,
      apply_automatically: cal.applyAutomatically, note: cal.note, ...sync,
    });
  });

  // The demo user already has a baseline, so skip onboarding for them. A real fresh
  // install has no seed and lands in onboarding.
  markOnboardingComplete();
}
