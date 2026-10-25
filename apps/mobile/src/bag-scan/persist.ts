import { readPlayerBag, readPlayerFit, replaceScanBag, writePlayerFit } from '../device-store';
import { sanitizeFit } from './logic';
import { EMPTY_FIT, type ScanClub, type StoredFit } from './types';

export const SCAN_BAG_KEY = 'coopr.bag.scan.v1';
export const SCAN_FIT_KEY = 'coopr.bag.fit.v1';

export function readScanClubs(): ScanClub[] {
  return readPlayerBag();
}

export function writeScanClubs(clubs: readonly ScanClub[]): void {
  replaceScanBag(clubs);
}

export function readStoredFit(): StoredFit {
  return readPlayerFit() ?? { ...EMPTY_FIT };
}

export function writeStoredFit(fit: StoredFit): void {
  writePlayerFit(sanitizeFit(fit));
}
