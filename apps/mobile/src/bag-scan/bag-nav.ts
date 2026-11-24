/** Add-club steps replace the current screen. Saving pops back to the bag already underneath. */

export function forwardBag(nav: { replace: (href: string) => void }, href: string): void {
  nav.replace(href);
}

export function returnToBag(nav: { back: () => void }): void {
  nav.back();
}

/** Hold sits on the card, which sits on the bag. Dismiss both. */
export function returnFromHold(nav: { dismiss: (count?: number) => void }): void {
  nav.dismiss(2);
}

export type BagStackOp =
  | { kind: 'push'; href: string }
  | { kind: 'replace'; href: string }
  | { kind: 'back' }
  | { kind: 'dismiss'; count: number };

export function reduceBagStack(stack: readonly string[], op: BagStackOp): string[] {
  if (op.kind === 'push') return [...stack, op.href];
  if (op.kind === 'replace') return [...stack.slice(0, -1), op.href];
  if (op.kind === 'back') return stack.length > 1 ? stack.slice(0, -1) : [...stack];
  const keep = Math.max(stack.length - Math.max(op.count, 0), 1);
  return stack.slice(0, keep);
}
