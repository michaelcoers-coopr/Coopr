export type OutboxStatus = 'pending' | 'conflict' | 'rejected';

export interface OutboxEntry {
  idempotencyKey: string;
  eventCode: string;
  groupId: string;
  playerId: string;
  hole: number;
  strokes: number | null;
  clientSeq: number;
  status: OutboxStatus;
  error: string | null;
}

export interface SendResult {
  status: number;
  error?: string;
}

/**
 * A new tap for the same hole replaces the unsent one. The latest number is the one we keep.
 * A different hole stays in the queue, so a missed post is not dropped.
 */
export function enqueueScore(entries: OutboxEntry[], next: OutboxEntry): OutboxEntry[] {
  const rest = entries.filter((entry) => !(
    entry.eventCode === next.eventCode
    && entry.groupId === next.groupId
    && entry.playerId === next.playerId
    && entry.hole === next.hole
  ));
  return [...rest, next];
}

/**
 * Pending posts go out in client sequence. A network failure stays pending.
 * A lock (409) stays on the phone as a conflict. A refusal stays as rejected.
 * A 2xx, including a duplicate or a stale ack, leaves the queue so it cannot be written twice.
 */
export async function flushOutbox(entries: OutboxEntry[], send: (entry: OutboxEntry) => Promise<SendResult>): Promise<OutboxEntry[]> {
  const pending = entries.filter((entry) => entry.status === 'pending').sort((a, b) => a.clientSeq - b.clientSeq);
  const held = entries.filter((entry) => entry.status !== 'pending');
  const kept: OutboxEntry[] = [];
  for (const entry of pending) {
    let result: SendResult;
    try {
      result = await send(entry);
    } catch {
      result = { status: 0 };
    }
    if (result.status === 0) {
      kept.push(entry);
      continue;
    }
    if (result.status === 409) {
      kept.push({ ...entry, status: 'conflict', error: result.error ?? 'Held. The organizer locked this hole.' });
      continue;
    }
    if (result.status === 401 || result.status === 403) {
      kept.push({ ...entry, status: 'rejected', error: result.error ?? 'This phone cannot post that score.' });
      continue;
    }
    if (result.status >= 200 && result.status < 300) continue;
    kept.push(entry);
  }
  return [...held, ...kept];
}
