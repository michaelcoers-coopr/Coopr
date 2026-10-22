import type { CaddiePersonality } from './types';

export type IntegrationState = 'available' | 'manual_import' | 'partner_required' | 'planned' | 'not_available';

export interface AuthProvider {
  readonly id: string;
  currentUserId(): Promise<string | null>;
}

export interface SyncProvider {
  readonly id: string;
  pushOutbox(): Promise<{ pushed: number }>;
  pullChanges(): Promise<{ pulled: number }>;
}

/**
 * Language providers receive finished text only. They do not receive candidates,
 * distances to choose from, or a question of which club to hit.
 */
export interface LanguageProvider {
  readonly id: string;
  rephrase(input: { text: string; personality: CaddiePersonality }): Promise<string>;
}

export interface CourseDataProvider {
  readonly id: string;
  readonly state: IntegrationState;
}

export interface WeatherProvider {
  readonly id: string;
  readonly state: IntegrationState;
}

export interface LaunchMonitorProvider {
  readonly id: string;
  readonly state: IntegrationState;
}

export interface ScoringImportProvider {
  readonly id: string;
  readonly state: IntegrationState;
}

export interface AnalyticsProvider {
  readonly id: string;
  track(name: string, props: Record<string, string | number | boolean | null>): void;
}

export interface ProviderRegistry {
  auth: AuthProvider;
  sync: SyncProvider;
  language: LanguageProvider;
  courseData: CourseDataProvider;
  weather: WeatherProvider;
  launchMonitor: LaunchMonitorProvider;
  scoringImport: ScoringImportProvider;
  analytics: AnalyticsProvider;
}

export function nullProviders(): ProviderRegistry {
  return {
    auth: {
      id: 'null',
      currentUserId: async () => null,
    },
    sync: {
      id: 'null',
      pushOutbox: async () => ({ pushed: 0 }),
      pullChanges: async () => ({ pulled: 0 }),
    },
    language: {
      id: 'null',
      rephrase: async ({ text }) => text,
    },
    courseData: { id: 'null', state: 'planned' },
    weather: { id: 'null', state: 'manual_import' },
    launchMonitor: { id: 'null', state: 'manual_import' },
    scoringImport: { id: 'null', state: 'planned' },
    analytics: { id: 'null', track: () => undefined },
  };
}
