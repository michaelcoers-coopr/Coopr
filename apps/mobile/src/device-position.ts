import type { LatLon } from '@coopr/domain';

/** Foreground GPS only. A failure returns null so play stays on a manual distance. */
export async function readDevicePosition(): Promise<LatLon | null> {
  try {
    const Location = await import('expo-location');
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch {
    return null;
  }
}
