/** Desk preview of Ask. A throwing store stays closed. */
export function readTalkPreview(storage: { getItem(key: string): string | null } | null): string | null {
  if (!storage) return null;
  try {
    if (storage.getItem('coopr.talk.open') !== '1') return null;
    const sim = storage.getItem('coopr.voice.sim')?.trim();
    return sim || 'What should I hit?';
  } catch {
    return null;
  }
}
