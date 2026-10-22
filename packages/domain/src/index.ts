export * from './ids';
export * from './types';
export * from './course';
export * from './providers';

import type { UserRecord } from './types';

/** Public demo surfaces must refuse any private / founder account. */
export function assertPublicDemoAllowed(user: Pick<UserRecord, 'audience' | 'displayName'>): void {
  if (user.audience !== 'public_demo') {
    throw new Error('Founder data must not appear in a public demo');
  }
}
