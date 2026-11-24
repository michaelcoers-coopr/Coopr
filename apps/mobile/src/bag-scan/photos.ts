/** A photo is kept only after it is copied into the app's document folder. */
export function isEphemeralPhotoUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return (
    lower.startsWith('blob:') ||
    lower.startsWith('ph:') ||
    lower.startsWith('content:') ||
    lower.includes('/caches/') ||
    lower.includes('/cache/') ||
    lower.includes('/tmp/') ||
    lower.includes('imagepicker')
  );
}

export function durablePhoto(uri: string | null): string | null {
  if (!uri || isEphemeralPhotoUri(uri)) return null;
  return uri;
}

export async function copyClubPhoto(uri: string, clubId: string): Promise<string | null> {
  try {
    const fileSystem = await import('expo-file-system/legacy');
    const root = fileSystem.documentDirectory;
    if (!root) return null;
    const dir = `${root}bag-photos/`;
    await fileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const safe = clubId.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'club';
    const dest = `${dir}${safe}.jpg`;
    await fileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return null;
  }
}
