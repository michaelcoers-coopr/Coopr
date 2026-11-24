/** Web-only flags. A throwing storage (private mode) must not take the hole down. */
export function readPlayWebFlags(storage: { getItem(key: string): string | null } | undefined): { sample: boolean; scrub: number | null } {
  if (!storage) return { sample: false, scrub: null };
  try {
    const scrub = storage.getItem('coopr.ui.scrub');
    return {
      sample: storage.getItem('coopr.sample.signature') === '1',
      scrub: scrub != null && /^\d+$/.test(scrub) ? Number(scrub) : null,
    };
  } catch {
    return { sample: false, scrub: null };
  }
}
