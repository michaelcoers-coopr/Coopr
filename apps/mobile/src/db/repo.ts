import { sqlite } from './client';
import type { Shot, Club, CalibrationProfile, ClubFeedbackInput, CaddiePersona } from '@coopr/core';

// Thin read layer over the local SQLite store. All reads are local and synchronous —
// the UI never blocks on the network (offline-first).

interface ShotRow {
  id: string; player_id: string; club_id: string; club_label: string; loft_deg: number | null;
  session_id: string; session_date: number; shot_number: number | null; environment: string; swing_mode: string;
  carry_yards: number | null; total_yards: number | null; offline_yards: number | null; side: string | null;
  club_speed_mph: number | null; ball_speed_mph: number | null; smash_factor: number | null;
  launch_angle_deg: number | null; spin_rate_rpm: number | null; spin_axis_deg: number | null;
  peak_height_yards: number | null; landing_angle_deg: number | null; attack_angle_deg: number | null;
  club_path_deg: number | null; face_angle_deg: number | null; face_to_path_deg: number | null;
  dynamic_loft_deg: number | null; impact_height: number | null; impact_offset: number | null;
  quality_label: string | null; quality_reason: string | null; source: string | null;
  source_image: string | null; notes: string | null;
}

function rowToShot(r: ShotRow): Shot {
  return {
    id: r.id, playerId: r.player_id, clubId: r.club_id, clubLabel: r.club_label, loftDeg: r.loft_deg,
    sessionId: r.session_id, sessionDate: r.session_date, shotNumber: r.shot_number,
    environment: r.environment as Shot['environment'], swingMode: r.swing_mode as Shot['swingMode'],
    carryYards: r.carry_yards, totalYards: r.total_yards, offlineYards: r.offline_yards,
    side: r.side as Shot['side'], clubSpeedMph: r.club_speed_mph, ballSpeedMph: r.ball_speed_mph,
    smashFactor: r.smash_factor, launchAngleDeg: r.launch_angle_deg, spinRateRpm: r.spin_rate_rpm,
    spinAxisDeg: r.spin_axis_deg, peakHeightYards: r.peak_height_yards, landingAngleDeg: r.landing_angle_deg,
    attackAngleDeg: r.attack_angle_deg, clubPathDeg: r.club_path_deg, faceAngleDeg: r.face_angle_deg,
    faceToPathDeg: r.face_to_path_deg, dynamicLoftDeg: r.dynamic_loft_deg, impactHeight: r.impact_height,
    impactOffset: r.impact_offset, qualityLabel: r.quality_label as Shot['qualityLabel'],
    qualityReason: r.quality_reason, source: r.source, sourceImage: r.source_image, notes: r.notes,
  };
}

export function getFirstUserId(): string | null {
  // Prefer the explicitly-active user (sample vs personal on the same device).
  const active = sqlite.getFirstSync<{ v: string }>("SELECT v FROM app_settings WHERE k = 'active_user_id';")?.v;
  if (active) {
    const ok = sqlite.getFirstSync<{ id: string }>('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL;', [active]);
    if (ok) return active;
  }
  const row = sqlite.getFirstSync<{ id: string }>('SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1;');
  return row?.id ?? null;
}

export interface GolferProfileRow {
  id: string; name: string | null; handicap: number | null; risk_preference: string; notes: string | null;
}
export function getGolferProfile(userId: string): GolferProfileRow | null {
  return (
    sqlite.getFirstSync<GolferProfileRow>(
      'SELECT id, name, handicap, risk_preference, notes FROM golfer_profiles WHERE user_id = ? AND deleted_at IS NULL LIMIT 1;',
      [userId],
    ) ?? null
  );
}

export function getActiveBagId(userId: string): string | null {
  const row = sqlite.getFirstSync<{ id: string }>(
    'SELECT id FROM bags WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_active DESC LIMIT 1;',
    [userId],
  );
  return row?.id ?? null;
}

interface ClubRow {
  id: string; bag_id: string; type: string; label: string; manufacturer: string | null; model: string | null;
  loft_deg: number | null; shaft_flex: string | null; shaft_model: string | null; shaft_material: string | null;
  bounce_deg: number | null; in_bag: number;
}
export function listClubs(bagId: string): Club[] {
  const rows = sqlite.getAllSync<ClubRow>(
    'SELECT * FROM clubs WHERE bag_id = ? AND deleted_at IS NULL;',
    [bagId],
  );
  return rows.map((r) => ({
    id: r.id, bagId: r.bag_id, type: r.type as Club['type'], label: r.label, manufacturer: r.manufacturer,
    model: r.model, loftDeg: r.loft_deg, shaftFlex: r.shaft_flex, shaftModel: r.shaft_model,
    shaftMaterial: r.shaft_material, bounceDeg: r.bounce_deg, inBag: r.in_bag === 1,
  }));
}

export function listShotsForPlayer(playerId: string): Shot[] {
  const rows = sqlite.getAllSync<ShotRow>(
    'SELECT * FROM shots WHERE player_id = ? AND deleted_at IS NULL;',
    [playerId],
  );
  return rows.map(rowToShot);
}

export function listShotsForClub(clubId: string): Shot[] {
  const rows = sqlite.getAllSync<ShotRow>(
    'SELECT * FROM shots WHERE club_id = ? AND deleted_at IS NULL;',
    [clubId],
  );
  return rows.map(rowToShot);
}

interface ClubFeedbackRow {
  club_id: string;
  confidence: 'low' | 'moderate' | 'high' | null;
  note: string | null;
}
export function listClubFeedback(bagId: string): ClubFeedbackInput[] {
  const rows = sqlite.getAllSync<ClubFeedbackRow>(
    `SELECT cf.club_id, cf.confidence, cf.note FROM club_feedback cf
     JOIN clubs c ON c.id = cf.club_id
     WHERE c.bag_id = ? AND cf.deleted_at IS NULL;`,
    [bagId],
  );
  return rows.map((r) => ({ clubId: r.club_id, confidence: r.confidence, note: r.note }));
}

export function validationRequiredSessionIds(): Set<string> {
  const rows = sqlite.getAllSync<{ id: string }>('SELECT id FROM sessions WHERE validation_required = 1;');
  return new Set(rows.map((r) => r.id));
}

interface CaddieRow {
  id: string; name: string; personality: string | null; humor_level: number; detail_level: number; coaching_style: string | null;
}
export function getCaddieRow(userId: string): CaddieRow | null {
  return (
    sqlite.getFirstSync<CaddieRow>(
      'SELECT id, name, personality, humor_level, detail_level, coaching_style FROM caddie_profiles WHERE user_id = ? AND deleted_at IS NULL LIMIT 1;',
      [userId],
    ) ?? null
  );
}
export function getCaddiePersona(userId: string): CaddiePersona {
  const r = getCaddieRow(userId);
  if (!r) return { name: 'Coop', humorLevel: 0.3, detailLevel: 0.6, coachingStyle: 'direct and concise' };
  return { name: r.name, humorLevel: r.humor_level, detailLevel: r.detail_level, coachingStyle: r.coaching_style ?? 'direct' };
}

export function getSuspectedCalibration(playerId: string): CalibrationProfile | null {
  const r = sqlite.getFirstSync<{
    id: string; player_id: string; scope: string; club_id: string | null; status: string;
    delta_min_yards: number | null; delta_max_yards: number | null; confidence: string;
    apply_automatically: number; note: string | null;
  }>('SELECT * FROM calibration_profiles WHERE player_id = ? AND deleted_at IS NULL LIMIT 1;', [playerId]);
  if (!r) return null;
  return {
    id: r.id, playerId: r.player_id, scope: r.scope as CalibrationProfile['scope'], clubId: r.club_id,
    status: r.status as CalibrationProfile['status'], deltaMinYards: r.delta_min_yards,
    deltaMaxYards: r.delta_max_yards, confidence: r.confidence as CalibrationProfile['confidence'],
    applyAutomatically: r.apply_automatically === 1, note: r.note,
  };
}
