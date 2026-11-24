import type { BoardRow, HoleScore, StoredEvent } from './types';

export function formatToPar(value: number | null): string {
  if (value == null) return '–';
  if (value === 0) return 'E';
  if (value > 0) return `+${value}`;
  return String(value);
}

function cardMatch(format: StoredEvent['format'], score: HoleScore, groupId: string, playerId: string | null, hole: number): boolean {
  if (score.groupId !== groupId || score.hole !== hole) return false;
  if (format === 'scramble') return true;
  return playerId != null && score.playerId === playerId;
}

/** Higher client sequence wins. The same sequence keeps the organizer's number. */
export function winningScore(scores: HoleScore[]): HoleScore | null {
  const live = scores.filter((score) => score.strokes != null);
  if (live.length === 0) return null;
  return live.reduce((best, item) => {
    if (item.clientSeq !== best.clientSeq) return item.clientSeq > best.clientSeq ? item : best;
    if (item.source === 'organizer' && best.source !== 'organizer') return item;
    if (best.source === 'organizer' && item.source !== 'organizer') return best;
    return item.writtenAt >= best.writtenAt ? item : best;
  });
}

export function holeStrokes(event: Pick<StoredEvent, 'format' | 'scores'>, groupId: string, playerId: string | null, hole: number): number | null {
  const matches = event.scores.filter((score) => cardMatch(event.format, score, groupId, playerId, hole));
  return winningScore(matches)?.strokes ?? null;
}

interface Tally {
  key: string;
  groupId: string;
  playerId: string | null;
  name: string;
  thru: number;
  gross: number;
  toPar: number | null;
}

function tallyCard(event: Pick<StoredEvent, 'format' | 'scores' | 'pars'>, groupId: string, playerId: string | null, name: string, key: string): Tally {
  let thru = 0;
  let gross = 0;
  let parSum = 0;
  for (let hole = 1; hole <= event.pars.length; hole += 1) {
    const strokes = holeStrokes(event, groupId, playerId, hole);
    const par = event.pars[hole - 1];
    if (strokes == null || par == null) continue;
    thru += 1;
    gross += strokes;
    parSum += par;
  }
  return { key, groupId, playerId, name, thru, gross, toPar: thru === 0 ? null : gross - parSum };
}

function byName(a: Tally, b: Tally): number {
  return a.name.localeCompare(b.name);
}

/**
 * Lower to-par is better. Unstarted cards sort last and have no rank.
 * Equal to-par shares a competition rank. Thru, then name, only breaks the display order.
 */
export function leaderboard(event: Pick<StoredEvent, 'format' | 'groups' | 'scores' | 'pars'>): BoardRow[] {
  const cards: Tally[] = [];
  if (event.format === 'scramble') {
    for (const group of event.groups) {
      cards.push(tallyCard(event, group.id, null, group.name, group.id));
    }
  } else {
    const names = new Map<string, number>();
    for (const group of event.groups) {
      for (const player of group.players) {
        names.set(player.name, (names.get(player.name) ?? 0) + 1);
      }
    }
    for (const group of event.groups) {
      for (const player of group.players) {
        const shared = (names.get(player.name) ?? 0) > 1;
        const name = shared ? `${player.name} · ${group.name}` : player.name;
        cards.push(tallyCard(event, group.id, player.id, name, `${group.id}:${player.id}`));
      }
    }
  }
  const started = cards.filter((card) => card.thru > 0).sort((a, b) => {
    const toPar = (a.toPar ?? 0) - (b.toPar ?? 0);
    if (toPar !== 0) return toPar;
    if (b.thru !== a.thru) return b.thru - a.thru;
    return byName(a, b);
  });
  const waiting = cards.filter((card) => card.thru === 0).sort(byName);
  const ranked: BoardRow[] = [];
  let index = 0;
  while (index < started.length) {
    const first = started[index];
    if (!first) break;
    let end = index;
    while (end + 1 < started.length && started[end + 1]?.toPar === first.toPar) end += 1;
    const rank = index + 1;
    for (let cursor = index; cursor <= end; cursor += 1) {
      const card = started[cursor];
      if (!card) continue;
      ranked.push({ ...card, rank });
    }
    index = end + 1;
  }
  for (const card of waiting) ranked.push({ ...card, rank: null });
  return ranked;
}
