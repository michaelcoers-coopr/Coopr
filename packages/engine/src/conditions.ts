import type { Conditions, Lie, Reason } from '@coopr/core';
import { round1 } from './stats';

// Documented, deterministic plays-like model. Each coefficient is a simplification;
// the point is that adjustments are separable, auditable, and monotonic (more
// headwind never shortens the number, colder never shortens it, etc.).
export const WIND_HEAD_YDS_PER_MPH = 1.5; // headwind hurts more than tailwind helps
export const WIND_TAIL_YDS_PER_MPH = 1.0;
export const ELEVATION_YDS_PER_YD = 1.0; // 1 yd of uphill ~ 1 yd more to cover
export const TEMP_BASELINE_F = 70;
export const TEMP_YDS_PER_DEG = 0.2; // colder plays longer

// Lie affects the club's expected output and dispersion, not the yardage to cover.
export const LIE_DISTANCE_MULT: Record<Lie, number> = {
  tee: 1.0,
  fairway: 1.0,
  light_rough: 0.97,
  heavy_rough: 0.9,
  sand: 0.8,
  recovery: 0.75,
};
export const LIE_DISPERSION_MULT: Record<Lie, number> = {
  tee: 1.0,
  fairway: 1.0,
  light_rough: 1.15,
  heavy_rough: 1.4,
  sand: 1.5,
  recovery: 1.8,
};

export interface PlaysLikeResult {
  playsLikeYards: number;
  reasons: Reason[];
}

/**
 * Convert the raw target distance into the distance the shot must actually cover,
 * given flight conditions. Lie is intentionally excluded here (it modifies the club
 * model, not the target). Result is never shorter under headwind/uphill/cold.
 */
export function playsLikeDistance(targetYards: number, c: Conditions): PlaysLikeResult {
  const reasons: Reason[] = [];
  let d = targetYards;

  if (c.wind && c.wind.speedMph > 0) {
    if (c.wind.direction === 'head') {
      const adj = c.wind.speedMph * WIND_HEAD_YDS_PER_MPH;
      d += adj;
      reasons.push({ code: 'wind_head', text: `Into a ${c.wind.speedMph} mph wind: plays ~${round1(adj)} yd longer.` });
    } else if (c.wind.direction === 'tail') {
      const adj = c.wind.speedMph * WIND_TAIL_YDS_PER_MPH;
      d -= adj;
      reasons.push({ code: 'wind_tail', text: `Downwind ${c.wind.speedMph} mph: plays ~${round1(adj)} yd shorter.` });
    } else {
      reasons.push({ code: 'wind_cross', text: `Crosswind ${c.wind.speedMph} mph: little distance change, watch lateral drift.` });
    }
  }

  if (c.elevationDeltaYards != null && c.elevationDeltaYards !== 0) {
    const adj = c.elevationDeltaYards * ELEVATION_YDS_PER_YD;
    d += adj;
    const dir = c.elevationDeltaYards > 0 ? 'uphill' : 'downhill';
    reasons.push({ code: 'elevation', text: `Playing ${dir}: ${adj > 0 ? '+' : ''}${round1(adj)} yd.` });
  }

  if (c.temperatureF != null) {
    const adj = (TEMP_BASELINE_F - c.temperatureF) * TEMP_YDS_PER_DEG;
    if (Math.abs(adj) >= 1) {
      d += adj;
      reasons.push({ code: 'temperature', text: `${c.temperatureF}°F: plays ${adj > 0 ? '+' : ''}${round1(adj)} yd vs 70°F.` });
    }
  }

  return { playsLikeYards: round1(d), reasons };
}
