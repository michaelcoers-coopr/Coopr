import {
  DISCLOSURE,
  FOOTER,
  SI_AMBER,
  emptyHoles,
  gamesForCount,
  handicapPrompt,
  parsePhrase,
  parseStake,
  playingHandicaps,
  recapText,
  scoreFoursome,
  strokesOn,
  suggestTeams,
  type FoursomeGame,
  type FoursomeHole,
  type FoursomePlayer,
  type FoursomeSave,
  type GameKind,
  type RoundScore,
} from '@coopr/games';

export interface SetupPlayer {
  id: string
  name: string
  handicapText: string
  scratch: boolean
}

export interface StakeDraft {
  amount: string
  front: string
  back: string
  total: string
  press: string
  pot: boolean
}

export interface EntryRow {
  playerId: string
  name: string
  gross: number | null
  pickup: boolean
  confirmed: boolean
  amber: boolean
  question: string | null
}

const LOW = new Set<GameKind>(['skins', 'nassau', 'match', 'wolf', 'vegas'])

export function blankPlayer(id: string): SetupPlayer {
  return { id, name: '', handicapText: '', scratch: false }
}

export function emptyStake(): StakeDraft {
  return { amount: '', front: '', back: '', total: '', press: '', pot: true }
}

export function playerHandicap(player: SetupPlayer): number | null {
  if (player.scratch) return 0
  const text = player.handicapText.trim()
  if (!/^-?\d+$/.test(text)) return null
  return Number(text)
}

export function setupBlock(players: SetupPlayer[], kinds: GameKind[], siOk: boolean, grossOnly: boolean): string | null {
  const named = players.filter((player) => player.name.trim())
  if (named.length < 2) return 'Add at least two players.'
  const missing = named.find((player) => playerHandicap(player) == null)
  if (missing) return handicapPrompt(missing.name.trim())
  const legal = kinds.filter((kind) => gamesForCount(named.length).includes(kind))
  if (legal.length === 0) return 'Pick a game.'
  const needsIndex = legal.some((kind) => kind !== 'bbb' && kind !== 'coins')
  if (needsIndex && !siOk && !grossOnly) return SI_AMBER
  return null
}

export function buildSave(input: {
  id: string
  players: SetupPlayer[]
  ownerId: string
  kinds: GameKind[]
  stakes: Record<string, StakeDraft>
  grossOnly: boolean
  siOk: boolean
  card: Array<{ par: number; strokeIndex: number }>
}): FoursomeSave | null {
  if (setupBlock(input.players, input.kinds, input.siOk, input.grossOnly)) return null
  const named = input.players.filter((player) => player.name.trim() && playerHandicap(player) != null)
  if (named.length < 2) return null
  const legal = input.kinds.filter((kind) => gamesForCount(named.length).includes(kind))
  if (legal.length === 0) return null
  const players: FoursomePlayer[] = named.map((player) => ({
    id: player.id,
    name: player.name.trim(),
    courseHandicap: playerHandicap(player),
    isDeviceOwner: player.id === input.ownerId,
  }))
  if (!players.some((player) => player.isDeviceOwner)) players[0] = { ...players[0]!, isDeviceOwner: true }
  const handicaps = players.map((player) => player.courseHandicap ?? 0)
  const teams = suggestTeams(handicaps)
  const games: FoursomeGame[] = legal.map((kind) => {
    const draft = input.stakes[kind] ?? emptyStake()
    const game: FoursomeGame = { kind, stake: parseStake(draft.amount), pot: draft.pot }
    if (kind === 'nassau') {
      game.stake = null
      game.front = parseStake(draft.front)
      game.back = parseStake(draft.back)
      game.total = parseStake(draft.total)
      game.press = parseStake(draft.press)
    }
    if (kind === 'nassau' || kind === 'match' || kind === 'vegas') {
      game.teamA = teams.teamA.map((index) => players[index]?.id).filter((id): id is string => !!id)
      game.teamB = teams.teamB.map((index) => players[index]?.id).filter((id): id is string => !!id)
    }
    return game
  })
  return {
    id: input.id,
    courseName: 'High Cedars',
    players,
    games,
    holes: emptyHoles(input.card),
    grossOnly: input.grossOnly,
    wholeUnits: false,
    finishedOn: null,
  }
}

export function blankEntry(players: FoursomePlayer[]): EntryRow[] {
  return players.map((player) => ({
    playerId: player.id,
    name: player.name,
    gross: null,
    pickup: false,
    confirmed: false,
    amber: false,
    question: null,
  }))
}

export function rowsFromHole(save: FoursomeSave, holeNumber: number): EntryRow[] {
  const hole = save.holes.find((item) => item.number === holeNumber)
  return save.players.map((player) => {
    const score = hole?.scores.find((item) => item.playerId === player.id)
    if (!score || (score.gross == null && !score.pickup)) {
      return { playerId: player.id, name: player.name, gross: null, pickup: false, confirmed: false, amber: false, question: null }
    }
    return {
      playerId: player.id,
      name: player.name,
      gross: score.pickup ? null : score.gross,
      pickup: score.pickup,
      confirmed: true,
      amber: false,
      question: null,
    }
  })
}

export function tapGross(rows: EntryRow[], playerId: string, gross: number): EntryRow[] {
  if (gross < 1 || gross > 15) return rows
  return rows.map((row) =>
    row.playerId === playerId ? { ...row, gross, pickup: false, confirmed: true, amber: false, question: null } : row,
  )
}

export function tapPickup(rows: EntryRow[], playerId: string): EntryRow[] {
  return rows.map((row) =>
    row.playerId === playerId ? { ...row, gross: null, pickup: true, confirmed: true, amber: false, question: null } : row,
  )
}

export function acceptRow(rows: EntryRow[], playerId: string): EntryRow[] {
  return rows.map((row) => {
    if (row.playerId !== playerId) return row
    if (row.gross == null && !row.pickup) return row
    return { ...row, confirmed: true, amber: false, question: null }
  })
}

export function logReady(rows: EntryRow[]): boolean {
  return rows.length >= 2 && rows.every((row) => (row.gross != null || row.pickup) && !row.amber && !row.question)
}

export function speechHints(players: Array<{ name: string }>): string[] {
  return [...players.map((player) => player.name), 'birdie', 'bogey', 'double', 'snowman', 'pickup', 'par', 'eagle', 'net']
}

function strokeMap(save: FoursomeSave, strokeIndex: number): Record<string, number> {
  const handicaps = save.players.map((player) => player.courseHandicap ?? 0)
  const low = save.games.some((game) => LOW.has(game.kind))
  const ph = save.grossOnly ? handicaps.map(() => 0) : playingHandicaps(handicaps, low ? 'low' : 'full')
  const strokes: Record<string, number> = {}
  save.players.forEach((player, index) => {
    strokes[player.id] = strokesOn(ph[index] ?? 0, strokeIndex)
  })
  return strokes
}

export function applyPhrase(
  rows: EntryRow[],
  transcript: string,
  save: FoursomeSave,
  hole: { par: number; strokeIndex: number },
): { rows: EntryRow[]; command: 'skip_hole' | 'undo' | null; note: string | null; wolf: FoursomeHole['wolf'] } {
  const parsed = parsePhrase(transcript, {
    players: save.players.map((player) => ({ id: player.id, name: player.name, isDeviceOwner: player.isDeviceOwner })),
    par: hole.par,
    strokes: strokeMap(save, hole.strokeIndex),
  })
  if (parsed.intent === 'command') {
    const type = parsed.commands[0]?.type
    return { rows, command: type === 'skip_hole' || type === 'undo' ? type : null, note: null, wolf: null }
  }
  let next = rows
  for (const score of parsed.scores) {
    const playerId = String(score.playerId)
    const amber = Number(score.confidence) < 0.8 || score.state === 'unresolved'
    const question = typeof score.question === 'string' ? score.question : null
    next = next.map((row) =>
      row.playerId !== playerId
        ? row
        : {
            ...row,
            gross: score.state === 'scored' && typeof score.gross === 'number' ? score.gross : null,
            pickup: score.state === 'pickup',
            confirmed: !amber,
            amber,
            question,
          },
    )
  }
  let wolf: FoursomeHole['wolf'] = null
  for (const event of parsed.events) {
    if (event.type !== 'wolf_pick' || typeof event.playerId !== 'string') continue
    const mode = event.wolfMode === 'blind' || event.wolfMode === 'lone' || event.wolfMode === 'partner' ? event.wolfMode : null
    if (!mode) continue
    wolf = { mode, wolfId: event.playerId, partnerId: typeof event.partnerId === 'string' ? event.partnerId : null }
  }
  return { rows: next, command: null, note: parsed.questions[0] ?? null, wolf }
}

export function commitHole(
  save: FoursomeSave,
  holeNumber: number,
  rows: EntryRow[],
  wolf: FoursomeHole['wolf'],
): FoursomeSave {
  return {
    ...save,
    holes: save.holes.map((hole) =>
      hole.number !== holeNumber
        ? hole
        : {
            ...hole,
            scores: rows.map((row) => ({ playerId: row.playerId, gross: row.pickup ? null : row.gross, pickup: row.pickup })),
            wolf: wolf ?? hole.wolf ?? null,
          },
    ),
  }
}

export function liveScore(save: FoursomeSave): RoundScore {
  return scoreFoursome(save)
}

export function recapFor(save: FoursomeSave): string {
  return recapText(save)
}

export { DISCLOSURE, FOOTER, SI_AMBER }
