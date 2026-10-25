/**
 * A live bag edit has to reach Home. An empty bag after the player had clubs
 * clears the playing list. Founder seed stays only until a real bag is saved.
 */
export function bagSubscriptionUpdate(input: { bagLength: number; founderTools: boolean; sawBag: boolean }): { clear: boolean; sawBag: boolean } {
  if (input.bagLength > 0) return { clear: false, sawBag: true };
  if (!input.sawBag && input.founderTools) return { clear: false, sawBag: false };
  return { clear: true, sawBag: false };
}
