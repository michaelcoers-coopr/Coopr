import type { LatLon } from '@coopr/domain';

/** Desk rounds write a preset name or a lat/lon here. The phone ignores it. */
export const GPS_SIM_KEY = 'coopr.gps.sim';

export function readStoredFix(): LatLon | 'tee' | 'approach' | 'green' | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(GPS_SIM_KEY);
    if (!raw) return null;
    if (raw === 'tee' || raw === 'approach' || raw === 'green') return raw;
    const parsed = JSON.parse(raw) as { lat?: unknown; lon?: unknown };
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

/** Phone GPS, or the desk fix when one is stored. A failure stays null. */
export function subscribeGps(onFix: (fix: LatLon | null) => void, resolve: (stored: LatLon | 'tee' | 'approach' | 'green') => LatLon | null): () => void {
  let stopped = false;
  const stored = readStoredFix();
  if (stored) {
    const emit = () => {
      const next = readStoredFix();
      onFix(next && typeof next !== 'string' ? next : next ? resolve(next) : null);
    };
    emit();
    const timer = setInterval(() => {
      if (!stopped) emit();
    }, 700);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
  let subscription: { remove: () => void } | null = null;
  void (async () => {
    try {
      const Location = await import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (stopped || permission.status !== 'granted') {
        if (!stopped) onFix(null);
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1500 },
        (position) => {
          if (!stopped) onFix({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
      );
    } catch {
      if (!stopped) onFix(null);
    }
  })();
  return () => {
    stopped = true;
    subscription?.remove();
  };
}
