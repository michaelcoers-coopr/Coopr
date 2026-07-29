import type { ProviderRegistry } from '@coopr/core';
import { noopAnalytics } from '@coopr/core';
import { LocalAuthProvider } from './local-auth';

// The app's provider registry. Only offline-capable providers are wired in Phase 1;
// sync, language, vision, course data, weather, equipment research, and subscriptions
// attach here later without touching feature code (invariant 9). Absent capabilities
// simply degrade gracefully.
export const registry: ProviderRegistry = {
  auth: new LocalAuthProvider(),
  analytics: noopAnalytics,
};
