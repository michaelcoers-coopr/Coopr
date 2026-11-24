import type { MulliganScope, MulliganUse } from './types';

export function usesFor(uses: MulliganUse[], groupId: string, playerId?: string): MulliganUse[] {
  return uses.filter((item) => item.groupId === groupId && (playerId == null || item.playerId === playerId));
}

/** A player-scoped cap is per golfer. A team-scoped cap is one number for the foursome. */
export function mulliganLimit(scope: MulliganScope, max: number, playerCount: number): number {
  if (max < 1) return 0;
  if (scope === 'team') return max;
  if (playerCount < 1) return 0;
  return playerCount * max;
}

export type MulliganDecision =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Count a mulligan that was already paid with a coin or ticket.
 * The same key does not count twice. The app does not take money.
 */
export function decideMulligan(input: {
  uses: MulliganUse[];
  groupId: string;
  playerId: string;
  scope: MulliganScope;
  max: number;
  idempotencyKey: string;
}): MulliganDecision {
  if (input.max < 1) return { ok: false, error: 'This event is not counting mulligans.' };
  if (input.uses.some((item) => item.idempotencyKey === input.idempotencyKey)) return { ok: true, duplicate: true };
  if (input.scope === 'player') {
    const mine = usesFor(input.uses, input.groupId, input.playerId).length;
    if (mine >= input.max) return { ok: false, error: `That player has used ${input.max} mulligans.` };
    return { ok: true, duplicate: false };
  }
  const team = usesFor(input.uses, input.groupId).length;
  if (team >= input.max) return { ok: false, error: `This team has used ${input.max} mulligans.` };
  return { ok: true, duplicate: false };
}
