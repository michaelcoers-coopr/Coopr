import { sanitizeClub, sanitizeFit } from './logic';
import { EMPTY_FIT, type ScanClub, type StoredFit } from './types';

export const SCAN_BAG_KEY = 'coopr.bag.scan.v1';
export const SCAN_FIT_KEY = 'coopr.bag.fit.v1';

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function readScanClubs(): ScanClub[] {
  const raw = storage()?.getItem(SCAN_BAG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const club = sanitizeClub(item);
      return club ? [club] : [];
    });
  } catch {
    return [];
  }
}

export function writeScanClubs(clubs: readonly ScanClub[]): void {
  storage()?.setItem(SCAN_BAG_KEY, JSON.stringify(clubs));
}

export function readStoredFit(): StoredFit {
  const raw = storage()?.getItem(SCAN_FIT_KEY);
  if (!raw) return { ...EMPTY_FIT };
  try {
    return sanitizeFit(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_FIT };
  }
}

export function writeStoredFit(fit: StoredFit): void {
  storage()?.setItem(SCAN_FIT_KEY, JSON.stringify(sanitizeFit(fit)));
}
