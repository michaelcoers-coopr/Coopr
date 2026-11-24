/** Safari private mode throws when the page touches localStorage, including `typeof`. */
export function webStore(): Storage | null {
  try {
    const store = globalThis.localStorage;
    if (store == null) return null;
    return store;
  } catch {
    return null;
  }
}
