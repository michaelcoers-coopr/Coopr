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
  waitlist: boolean;
  startingHole: number | null;
  holes: (number | null)[];
}

function tallyCard(event: Pick<StoredEvent, 'format' | 'scores' | 'pars'>, groupId: string, playerId: string | null, name: string, key: string, waitlist: boolean, startingHole: number | null): Tally {
  let thru = 0;
  let gross = 0;
  let parSum = 0;
  const holes: (number | null)[] = [];
  for (let hole = 1; hole <= event.pars.length; hole += 1) {
    const strokes = holeStrokes(event, groupId, playerId, hole);
    const par = event.pars[hole - 1];
    holes.push(strokes);
    if (strokes == null || par == null) continue;
    thru += 1;
    gross += strokes;
    parSum += par;
  }
  return { key, groupId, playerId, name, thru, gross, toPar: thru === 0 ? null : gross - parSum, waitlist, startingHole, holes };
}

/** Lower is better. Compares the back nine, then the last 6, last 3, and the 18th, using holes both cards have. */
export function backNineCompare(left: readonly (number | null)[], right: readonly (number | null)[]): number {
  const windows: [number, number][] = [[10, 18], [13, 18], [16, 18], [18, 18]];
  for (const [start, end] of windows) {
    let leftSum = 0;
    let rightSum = 0;
    let count = 0;
    for (let hole = start; hole <= end; hole += 1) {
      const a = left[hole - 1];
      const b = right[hole - 1];
      if (a == null || b == null) continue;
      leftSum += a;
      rightSum += b;
      count += 1;
    }
    if (count > 0 && leftSum !== rightSum) return leftSum - rightSum;
  }
  return 0;
}

function byName(a: Tally, b: Tally): number {
  return a.name.localeCompare(b.name);
}

function sameStanding(left: Tally, right: Tally | undefined, method: 'back-nine' | 'share'): boolean {
  if (!right || left.toPar !== right.toPar) return false;
  if (method === 'back-nine') return backNineCompare(left.holes, right.holes) === 0;
  return true;
}

function rowFrom(card: Tally, rank: number | null): BoardRow {
  return { key: card.key, groupId: card.groupId, playerId: card.playerId, name: card.name, thru: card.thru, gross: card.gross, toPar: card.toPar, rank, waitlist: card.waitlist, startingHole: card.startingHole, mulligansUsed: 0, mulliganCap: 0 };
}

/**
 * Lower to-par is better. Unstarted cards sort last and have no rank.
 * A waitlist team is listed after the field and is not ranked.
 * The default tiebreak matches cards from the back nine. There is no handicap.
 */
export function leaderboard(event: Pick<StoredEvent, 'format' | 'groups' | 'scores' | 'pars'> & { tiebreak?: StoredEvent['tiebreak'] }): BoardRow[] {
  const cards: Tally[] = [];
  if (event.format === 'scramble') {
    for (const group of event.groups) {
      cards.push(tallyCard(event, group.id, null, group.name, group.id, group.waitlist === true, group.startingHole ?? null));
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
        cards.push(tallyCard(event, group.id, player.id, name, `${group.id}:${player.id}`, group.waitlist === true, group.startingHole ?? null));
      }
    }
  }
  const field = cards.filter((card) => !card.waitlist);
  const bench = cards.filter((card) => card.waitlist).sort(byName);
  const method = event.tiebreak ?? 'back-nine';
  const started = field.filter((card) => card.thru > 0).sort((a, b) => {
    const toPar = (a.toPar ?? 0) - (b.toPar ?? 0);
    if (toPar !== 0) return toPar;
    if (method === 'back-nine') {
      const cards = backNineCompare(a.holes, b.holes);
      if (cards !== 0) return cards;
    } else if (b.thru !== a.thru) return b.thru - a.thru;
    return byName(a, b);
  });
  const waiting = field.filter((card) => card.thru === 0).sort(byName);
  const ranked: BoardRow[] = [];
  let index = 0;
  while (index < started.length) {
    const first = started[index];
    if (!first) break;
    let end = index;
    while (end + 1 < started.length && sameStanding(first, started[end + 1], method)) end += 1;
    const rank = index + 1;
    for (let cursor = index; cursor <= end; cursor += 1) {
      const card = started[cursor];
      if (!card) continue;
      ranked.push(rowFrom(card, rank));
    }
    index = end + 1;
  }
  for (const card of waiting) ranked.push(rowFrom(card, null));
  for (const card of bench) ranked.push(rowFrom(card, null));
  return ranked;
}

export function contestLine(label: string, holes: number[]): string | null {
  if (holes.length === 0) return null;
  return `${label}: ${holes.map((hole) => `hole ${hole}`).join(', ')}`;
}
