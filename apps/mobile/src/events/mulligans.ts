import type { MulliganUse } from './types';

/** Team cap is the roster times the per-player cap. A team of 4 with a cap of 2 can use 8. */
export function mulliganCap(playerCount: number, maxPerPlayer: number): number {
  if (playerCount < 1 || maxPerPlayer < 1) return 0;
  return playerCount * maxPerPlayer;
}

export function usesFor(uses: MulliganUse[], groupId: string, playerId?: string): MulliganUse[] {
  return uses.filter((item) => item.groupId === groupId && (playerId == null || item.playerId === playerId));
}

export type MulliganDecision =
  | { ok: true; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Count a mulligan. The same key does not count twice.
 * The app records the count only. It does not take the $20.
 */
export function decideMulligan(input: {
  uses: MulliganUse[];
  groupId: string;
  playerId: string;
  playerCount: number;
  maxPerPlayer: number;
  idempotencyKey: string;
}): MulliganDecision {
  if (input.maxPerPlayer < 1) return { ok: false, error: 'This event is not counting mulligans.' };
  if (input.uses.some((item) => item.idempotencyKey === input.idempotencyKey)) return { ok: true, duplicate: true };
  const mine = usesFor(input.uses, input.groupId, input.playerId).length;
  if (mine >= input.maxPerPlayer) return { ok: false, error: `That player has used ${input.maxPerPlayer} mulligans.` };
  const team = usesFor(input.uses, input.groupId).length;
  if (team >= mulliganCap(input.playerCount, input.maxPerPlayer)) return { ok: false, error: 'This team has used its mulligans.' };
  return { ok: true, duplicate: false };
}
