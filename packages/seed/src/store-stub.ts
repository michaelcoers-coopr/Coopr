import type { FounderDataset } from '@coopr/domain';
import { PUBLIC_DEMO } from './public-demo';

/**
 * Store and public builds resolve `@coopr/seed` here.
 * This file must not contain founder names, yardages, or the transcript.
 */
export { PUBLIC_DEMO };

export const FOUNDER_RAW = '';
export const IMPORT_CLOCK_MS = 0;
export const FOUNDER_DISTANCE_SOURCE = 'imported session';

function off(): never {
  throw new Error('Founder tools are off in this build');
}

export function importFounder(): never {
  return off();
}

export function loadFounderDataset(): FounderDataset {
  return off();
}

export function profilesFromFounder(): never {
  return off();
}

export function founderFlows(): never {
  return off();
}
