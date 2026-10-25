import type { FoursomeGame, FoursomeHole, FoursomePlayer, FoursomeSave, GameKind, HoleScore } from './round'

const KINDS = new Set<GameKind>(['stableford', 'modified', 'skins', 'nassau', 'match', 'wolf', 'vegas', 'bbb', 'coins'])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseFoursomeSave(value: unknown): FoursomeSave | null {
  const row = record(value)
  if (!row || typeof row.id !== 'string' || row.id.length === 0 || typeof row.courseName !== 'string') return null
  if (!Array.isArray(row.players) || row.players.length < 2 || row.players.length > 4) return null
  const players: FoursomePlayer[] = []
  for (const item of row.players) {
    const player = record(item)
    if (!player || typeof player.id !== 'string' || typeof player.name !== 'string') return null
    if (player.courseHandicap != null && typeof player.courseHandicap !== 'number') return null
    players.push({
      id: player.id,
      name: player.name,
      courseHandicap: player.courseHandicap == null ? null : player.courseHandicap,
      isDeviceOwner: player.isDeviceOwner === true,
    })
  }
  if (!Array.isArray(row.games)) return null
  const games: FoursomeGame[] = []
  for (const item of row.games) {
    const game = record(item)
    if (!game || typeof game.kind !== 'string' || !KINDS.has(game.kind as GameKind)) return null
    if (game.stake != null && typeof game.stake !== 'number') return null
    const next: FoursomeGame = { kind: game.kind as GameKind, stake: game.stake == null ? null : game.stake }
    for (const key of ['front', 'back', 'total', 'press'] as const) {
      if (game[key] == null) continue
      if (typeof game[key] !== 'number') return null
      next[key] = game[key]
    }
    if (typeof game.pot === 'boolean') next.pot = game.pot
    if (typeof game.carry === 'boolean') next.carry = game.carry
    if (typeof game.gross === 'boolean') next.gross = game.gross
    if (Array.isArray(game.teamA)) next.teamA = game.teamA.filter((id): id is string => typeof id === 'string')
    if (Array.isArray(game.teamB)) next.teamB = game.teamB.filter((id): id is string => typeof id === 'string')
    games.push(next)
  }
  if (!Array.isArray(row.holes)) return null
  const holes: FoursomeHole[] = []
  for (const item of row.holes) {
    const hole = record(item)
    if (!hole || typeof hole.number !== 'number' || typeof hole.par !== 'number' || typeof hole.strokeIndex !== 'number') return null
    if (!Array.isArray(hole.scores)) return null
    const scores: HoleScore[] = []
    for (const score of hole.scores) {
      const cell = record(score)
      if (!cell || typeof cell.playerId !== 'string') return null
      if (cell.gross != null && typeof cell.gross !== 'number') return null
      scores.push({ playerId: cell.playerId, gross: cell.gross == null ? null : cell.gross, pickup: cell.pickup === true })
    }
    const next: FoursomeHole = { number: hole.number, par: hole.par, strokeIndex: hole.strokeIndex, scores }
    const wolf = record(hole.wolf)
    if (wolf && (wolf.mode === 'partner' || wolf.mode === 'lone' || wolf.mode === 'blind') && typeof wolf.wolfId === 'string') {
      next.wolf = {
        mode: wolf.mode,
        wolfId: wolf.wolfId,
        partnerId: typeof wolf.partnerId === 'string' ? wolf.partnerId : null,
      }
    }
    if (hole.wolfSkipped === true) next.wolfSkipped = true
    if (Array.isArray(hole.coins)) {
      next.coins = hole.coins.flatMap((coin) => {
        const cell = record(coin)
        if (!cell || typeof cell.playerId !== 'string') return []
        if (cell.coin !== 'greenie' && cell.coin !== 'sandie' && cell.coin !== 'arnie' && cell.coin !== 'barkie') return []
        return [{ playerId: cell.playerId, coin: cell.coin }]
      })
    }
    const bbb = record(hole.bbb)
    if (bbb) {
      const id = (key: string) => (typeof bbb[key] === 'string' ? bbb[key] : null)
      next.bbb = { bingo: id('bingo'), bango: id('bango'), bongo: id('bongo') }
    }
    if (hole.press === true) next.press = true
    holes.push(next)
  }
  return {
    id: row.id,
    courseName: row.courseName,
    players,
    games,
    holes,
    grossOnly: row.grossOnly === true,
    wholeUnits: row.wholeUnits === true,
    finishedOn: typeof row.finishedOn === 'string' ? row.finishedOn : null,
  }
}

export interface OwnerHole {
  number: number
  par: number | null
  yards: number | null
  strokeIndex: number | null
  strokes: number | null
  putts: null
  penalties: null
  fairway: null
  gir: null
}

export interface OwnerRound {
  id: string
  playedOn: string
  courseName: string
  holes: OwnerHole[]
}

/** Calendar date in `timeZone` (the device zone when omitted). */
export function calendarDate(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A stored `YYYY-MM-DD` stays. A UTC timestamp becomes the local calendar date. */
export function playedOnDate(finishedOn: string | null, timeZone?: string): string {
  if (finishedOn && /^\d{4}-\d{2}-\d{2}$/.test(finishedOn)) return finishedOn
  if (finishedOn) {
    const date = new Date(finishedOn)
    if (!Number.isNaN(date.getTime())) return calendarDate(date, timeZone)
  }
  return calendarDate(new Date(), timeZone)
}

/** The device owner's gross, for round history. Unplayed holes are left out. */
export function ownerRound(save: FoursomeSave, opts?: { yards?: Array<number | null>; playedOn?: string; courseName?: string; timeZone?: string }): OwnerRound | null {
  const owner = save.players.find((player) => player.isDeviceOwner) ?? save.players[0]
  if (!owner) return null
  const holes: OwnerHole[] = Array.from({ length: 18 }, (_, index) => {
    const hole = save.holes.find((item) => item.number === index + 1)
    const score = hole?.scores.find((item) => item.playerId === owner.id)
    const strokes = score && !score.pickup && score.gross != null ? score.gross : null
    return {
      number: index + 1,
      par: hole?.par ?? null,
      yards: opts?.yards?.[index] ?? null,
      strokeIndex: hole?.strokeIndex ?? null,
      strokes,
      putts: null,
      penalties: null,
      fairway: null,
      gir: null,
    }
  })
  const played = holes.filter((hole) => hole.strokes != null)
  if (played.length === 0) return null
  return {
    id: save.id,
    playedOn: opts?.playedOn ?? playedOnDate(save.finishedOn, opts?.timeZone),
    courseName: opts?.courseName ?? 'High Cedars',
    holes: played,
  }
}
