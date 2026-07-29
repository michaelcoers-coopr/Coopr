import type { Environment } from '@coopr/core';
import { sqlite } from '../db/client';
import { newId } from '../lib/id';
import { enqueueOutbox } from '../db/sync';

// Writes a baseline session (per category) and its shots to the local store, and
// enqueues them for sync. Category is stored on the session's `intent` field
// ('irons' | 'driver' | 'woods_hybrids' | 'wedges'). Keeps categories separate so
// simulator/range/course and club groups are never blindly merged (invariant 10).

export interface NewShot {
  clubId: string;
  clubLabel: string;
  loftDeg?: number | null;
  carryYards?: number | null;
  totalYards?: number | null;
  ballSpeedMph?: number | null;
  clubSpeedMph?: number | null;
  spinRateRpm?: number | null;
  launchAngleDeg?: number | null;
  source?: string | null;
}

export interface SaveSessionParams {
  userId: string;
  category: string;
  environment: Environment;
  shots: NewShot[];
}

export function saveBaselineSession(params: SaveSessionParams): { sessionId: string; shotCount: number } {
  const now = Date.now();
  const sessionId = newId();

  sqlite.withTransactionSync(() => {
    sqlite.runSync(
      `INSERT INTO sessions (id, user_id, date, environment, intent, validation_required, notes, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL);`,
      [sessionId, params.userId, now, params.environment, params.category, now, now],
    );
    enqueueOutbox('sessions', sessionId, 'upsert', now);

    let n = 0;
    for (const s of params.shots) {
      const id = newId();
      sqlite.runSync(
        `INSERT INTO shots (
           id, player_id, club_id, club_label, loft_deg, session_id, session_date, shot_number,
           environment, swing_mode, carry_yards, total_yards, offline_yards, side,
           club_speed_mph, ball_speed_mph, smash_factor, launch_angle_deg, spin_rate_rpm, spin_axis_deg,
           peak_height_yards, landing_angle_deg, attack_angle_deg, club_path_deg, face_angle_deg,
           face_to_path_deg, dynamic_loft_deg, impact_height, impact_offset, quality_label, quality_reason,
           source, source_image, notes, created_at, updated_at, deleted_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL);`,
        [
          id, params.userId, s.clubId, s.clubLabel, s.loftDeg ?? null, sessionId, now, ++n,
          params.environment, 'stock', s.carryYards ?? null, s.totalYards ?? null, null, null,
          s.clubSpeedMph ?? null, s.ballSpeedMph ?? null, null, s.launchAngleDeg ?? null, s.spinRateRpm ?? null, null,
          null, null, null, null, null, null, null, null, null, null, null,
          s.source ?? 'manual', null, null, now, now,
        ],
      );
      enqueueOutbox('shots', id, 'upsert', now);
    }
  });

  return { sessionId, shotCount: params.shots.length };
}
