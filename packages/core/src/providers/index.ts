// Every external capability sits behind an interface (invariant 9). Features depend
// on these interfaces, never on a vendor SDK. A registry resolves them at runtime
// with null/stub defaults so the app runs fully with nothing configured.

import type { IntegrationState } from '../types/enums';
import type { EquipmentProduct } from '../types/equipment';

export interface AuthSession {
  userId: string;
  isAnonymous: boolean;
  email: string | null;
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signInWithApple(): Promise<AuthSession>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>; // hard requirement (invariant 8)
  // Local-only anonymous mode: the app is fully usable before any sign-in.
  ensureLocalUser(): Promise<AuthSession>;
}

export interface RowDelta {
  table: string;
  id: string;
  updatedAt: number;
  deletedAt: number | null;
  data: Record<string, unknown> | null;
}

export interface SyncProvider {
  push(deltas: RowDelta[]): Promise<void>;
  pull(since: number): Promise<RowDelta[]>;
}

// Explains and personalizes only. It is NEVER handed the club/target/mode decision.
export interface LanguageProvider {
  narrate(reasons: { code: string; text: string }[], persona: CaddiePersona): Promise<string>;
}

export interface CaddiePersona {
  name: string;
  humorLevel: number; // 0..1
  detailLevel: number; // 0..1
  coachingStyle: string;
}

export interface VisionExtraction {
  fields: Record<string, number | string | null>;
  confidence: number;
}

// Output is STAGED. It must be confirmed by the user before it touches the model.
export interface VisionProvider {
  extractLaunchMonitor(imageUri: string): Promise<VisionExtraction>;
  extractGpsScreenshot(imageUri: string): Promise<VisionExtraction>;
}

export interface CourseGeometry {
  courseId: string;
  holes: unknown[]; // shaped once a licensed supplier is chosen
}

export interface CourseDataProvider {
  search(query: string): Promise<{ id: string; name: string }[]>;
  getGeometry(courseId: string): Promise<CourseGeometry>;
  download(courseId: string): Promise<void>;
}

export interface WeatherObservation {
  temperatureF: number | null;
  windSpeedMph: number | null;
  windBearingDeg: number | null;
}

export interface WeatherProvider {
  current(lat: number, lon: number): Promise<WeatherObservation>;
}

export interface LaunchMonitorProvider {
  readonly vendor: string;
  readonly state: IntegrationState;
  importCsv(csv: string): Promise<VisionExtraction[]>;
}

export interface EquipmentResearchProvider {
  // Online only, cached upstream, timestamped. Never part of the pure engine.
  search(criteria: Record<string, unknown>): Promise<EquipmentProduct[]>;
}

export interface ScoringProvider {
  readonly service: string;
  readonly state: IntegrationState;
  importRounds(): Promise<unknown[]>;
}

export interface AnalyticsProvider {
  track(event: string, props?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

export interface Entitlements {
  tier: 'free' | 'pro';
  activeUntil: number | null;
}

export interface SubscriptionProvider {
  getEntitlements(): Promise<Entitlements>;
  getOfferings(): Promise<{ id: string; priceString: string }[]>; // remote-config pricing
  purchase(offeringId: string): Promise<Entitlements>;
  restore(): Promise<Entitlements>;
}

// The registry holds whatever is configured; unset capabilities are simply absent,
// and callers degrade gracefully (offline-first).
export interface ProviderRegistry {
  auth?: AuthProvider;
  sync?: SyncProvider;
  language?: LanguageProvider;
  vision?: VisionProvider;
  courseData?: CourseDataProvider;
  weather?: WeatherProvider;
  launchMonitors?: LaunchMonitorProvider[];
  equipmentResearch?: EquipmentResearchProvider;
  scoring?: ScoringProvider[];
  analytics?: AnalyticsProvider;
  subscription?: SubscriptionProvider;
}

// A no-op analytics provider so instrumentation calls are always safe.
export const noopAnalytics: AnalyticsProvider = {
  track() {},
  async flush() {},
};
