import { z } from 'zod';

export const Environment = z.enum([
  'simulator',
  'range',
  'outdoor_launch_monitor',
  'course',
]);
export type Environment = z.infer<typeof Environment>;

export const SwingMode = z.enum(['controlled', 'stock', 'aggressive', 'partial']);
export type SwingMode = z.infer<typeof SwingMode>;

export const ShotQuality = z.enum([
  'representative_stock',
  'good_strike',
  'mishit',
  'invalid',
]);
export type ShotQuality = z.infer<typeof ShotQuality>;

// Which distance metric a number is expressed in. The seed irons are total-only;
// carry stays null for them and is never fabricated from total.
export const DistanceMetric = z.enum(['carry', 'total']);
export type DistanceMetric = z.infer<typeof DistanceMetric>;

export const ClubType = z.enum([
  'driver',
  'wood',
  'hybrid',
  'utility',
  'iron',
  'wedge',
  'putter',
]);
export type ClubType = z.infer<typeof ClubType>;

export const Lie = z.enum([
  'tee',
  'fairway',
  'light_rough',
  'heavy_rough',
  'sand',
  'recovery',
]);
export type Lie = z.infer<typeof Lie>;

export const WindDirection = z.enum([
  'none',
  'head',
  'tail',
  'left_to_right',
  'right_to_left',
]);
export type WindDirection = z.infer<typeof WindDirection>;

export const StrategicIntent = z.enum(['attack_pin', 'play_safe', 'lay_up']);
export type StrategicIntent = z.infer<typeof StrategicIntent>;

export const RiskPreference = z.enum(['conservative', 'neutral', 'aggressive']);
export type RiskPreference = z.infer<typeof RiskPreference>;

export const RiskLevel = z.enum(['low', 'moderate', 'elevated', 'high']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const HazardSide = z.enum(['front', 'back', 'left', 'right']);
export type HazardSide = z.infer<typeof HazardSide>;

export const HazardKind = z.enum(['water', 'bunker', 'ob', 'trees', 'general']);
export type HazardKind = z.infer<typeof HazardKind>;

// Integration connection lifecycle, per spec section 51.
export const IntegrationState = z.enum([
  'available',
  'manual_import',
  'partner_required',
  'planned',
  'not_available',
]);
export type IntegrationState = z.infer<typeof IntegrationState>;
