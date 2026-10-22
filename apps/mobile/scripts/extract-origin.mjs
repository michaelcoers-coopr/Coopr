/** Origin the phone calls. An https URL, never a key. */

export function readExtractOrigin({ env = process.env, fileText = '' } = {}) {
  const fromEnv = typeof env.EXPO_PUBLIC_EXTRACT_URL === 'string' ? env.EXPO_PUBLIC_EXTRACT_URL.trim() : '';
  const fromFile = fileText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('https://'));
  const raw = fromEnv || fromFile || '';
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('EXPO_PUBLIC_EXTRACT_URL is not a URL.');
  }
  if (url.protocol !== 'https:') throw new Error('EXPO_PUBLIC_EXTRACT_URL must be https.');
  return url.origin;
}
