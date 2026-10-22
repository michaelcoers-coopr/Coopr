import type { PublicDemo } from '@coopr/domain';

/** A public demo has no golfer and none of the founder's history. */
export const PUBLIC_DEMO: PublicDemo = {
  audience: 'public_demo',
  displayName: 'Sample',
  clubs: [],
  shots: [],
  measurements: [],
  note: 'Public demo contains no measured golfer and no founder history.',
};
