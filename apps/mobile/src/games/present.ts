import {
  DISCLOSURE,
  FOOTER,
  SI_AMBER,
  calendarDate,
  emptyHoles,
  fmt,
  gamesForCount,
  handicapPrompt,
  headToHead,
  owesLine,
  parsePhrase,
  parseStake,
  playedOnDate,
  playingHandicaps,
  recapText,
  savedWolfCall,
  scoreFoursome,
  settle,
  strokesOn,
  suggestTeams,
  type FoursomeGame,
  type FoursomeHole,
  type FoursomePlayer,
  type FoursomeSave,
  type GameKind,
  type GameScore,
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
  /** Skins only. The engine treats a missing flag as on. */
  carry: boolean
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

export type CoinName = 'greenie' | 'sandie' | 'arnie' | 'barkie'

export interface HoleMarks {
  wolf: FoursomeHole['wolf']
  wolfSkipped: boolean
  bbb: { bingo: string | null; bango: string | null; bongo: string | null }
  coins: { playerId: string; coin: CoinName }[]
  press: boolean
}

export interface PhraseApply {
  rows: EntryRow[]
  marks: HoleMarks
  command: 'skip_hole' | 'undo' | null
  note: string | null
  readback: string | null
  question: string | null
  caught: boolean
}

export interface Sides {
  teamA: string[]
  teamB: string[]
}

/** #C8102E on #0B1F3A is 2.81:1. This rose is for negative totals on navy. Fills stay brand red. */
export const DOWN_TEXT = '#FF8A9B'
export const MISSED = "I didn't catch that."
/** Shown when Blind is off because a score or a pickup is already on the card. */
export const BLIND_HOLD = 'Blind wolf has to come before the scores'
export const LOG_SCORES = 'Enter a score for each player'
export const LOG_WOLF = 'Call a partner, lone wolf, or no wolf'
export const HANDICAP_MIN = -10
export const HANDICAP_MAX = 54

const LOW = new Set<GameKind>(['skins', 'nassau', 'match', 'wolf', 'vegas'])
const COIN_NAMES = new Set<CoinName>(['greenie', 'sandie', 'arnie', 'barkie'])

export function blankPlayer(id: string): SetupPlayer {
  return { id, name: '', handicapText: '', scratch: false }
}

export function emptyStake(): StakeDraft {
  return { amount: '', front: '', back: '', total: '', press: '', pot: true, carry: true }
}

export function emptyMarks(): HoleMarks {
  return {
    wolf: null,
    wolfSkipped: false,
    bbb: { bingo: null, bango: null, bongo: null },
    coins: [],
    press: false,
  }
}

export function stablePlayerId(name: string): string {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

export function playerHandicap(player: SetupPlayer): number | null {
  if (player.scratch) return 0
  const text = player.handicapText.trim()
  if (!/^-?\d+$/.test(text)) return null
  const value = Number(text)
  if (value < HANDICAP_MIN || value > HANDICAP_MAX) return null
  return value
}

export function handicapError(player: SetupPlayer): string | null {
  if (player.scratch || player.handicapText.trim() === '') return null
  if (playerHandicap(player) == null) return `Course handicap has to be from ${HANDICAP_MIN} to ${HANDICAP_MAX}.`
  return null
}

/** Empty is "not entered". Anything parseStake rejects is an error, not a silent no-stake. */
export function stakeError(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  if (parseStake(trimmed) == null) return 'Enter the stake as a number, like 1 or 2.50.'
  return null
}

export function activeKinds(kinds: GameKind[], count: number): GameKind[] {
  const legal = new Set(gamesForCount(Math.min(4, Math.max(count, 0))))
  return kinds.filter((kind) => legal.has(kind))
}

export function defaultSides(players: Array<{ id: string; courseHandicap: number | null }>): Sides {
  if (players.length === 2) return { teamA: [players[0]!.id], teamB: [players[1]!.id] }
  if (players.length === 4) {
    const pick = suggestTeams(players.map((player) => player.courseHandicap ?? 0))
    return {
      teamA: pick.teamA.map((index) => players[index]!.id),
      teamB: pick.teamB.map((index) => players[index]!.id),
    }
  }
  return { teamA: [], teamB: [] }
}

export function assignSide(sides: Sides, playerId: string, side: 'A' | 'B'): Sides {
  const teamA = sides.teamA.filter((id) => id !== playerId)
  const teamB = sides.teamB.filter((id) => id !== playerId)
  if (side === 'A') teamA.push(playerId)
  else teamB.push(playerId)
  return { teamA, teamB }
}

function sideProblem(players: SetupPlayer[], kinds: GameKind[], sides: Sides | undefined): string | null {
  const named = players.filter((player) => player.name.trim())
  const teamGame = kinds.some((kind) => kind === 'nassau' || kind === 'match' || kind === 'vegas')
  if (!teamGame || !sides) return null
  if (named.length === 3) return null
  const need = named.length === 4 ? 2 : named.length === 2 ? 1 : 0
  if (need === 0) return null
  if (sides.teamA.length !== need || sides.teamB.length !== need) {
    return need === 2 ? 'Each side needs two players.' : 'Each side needs one player.'
  }
  return null
}

export function setupBlock(
  players: SetupPlayer[],
  kinds: GameKind[],
  siOk: boolean,
  grossOnly: boolean,
  stakes?: Record<string, StakeDraft>,
  sides?: Sides,
): string | null {
  const named = players.filter((player) => player.name.trim())
  if (named.length < 2) return 'Add at least two players.'
  const bad = named.find((player) => handicapError(player) || playerHandicap(player) == null)
  if (bad) return handicapError(bad) ?? handicapPrompt(bad.name.trim())
  const legal = activeKinds(kinds, named.length)
  if (legal.length === 0) return 'Pick a game.'
  const needsIndex = legal.some((kind) => kind !== 'bbb' && kind !== 'coins')
  if (needsIndex && !siOk && !grossOnly) return SI_AMBER
  const stake = stakes ? firstStakeError(legal, stakes) : null
  if (stake) return stake
  return sideProblem(named, legal, sides)
}

/** One sentence for every bad stake field. The setup screen shows it once. */
export function firstStakeError(kinds: GameKind[], stakes: Record<string, StakeDraft>): string | null {
  for (const kind of kinds) {
    const draft = stakes[kind] ?? emptyStake()
    const fields = kind === 'nassau' ? [draft.front, draft.back, draft.total, draft.press] : [draft.amount]
    for (const field of fields) {
      const error = stakeError(field)
      if (error) return error
    }
  }
  return null
}

export function visibleSetupLines(block: string | null, stake: string | null, dropped: string | null): string[] {
  const lines: string[] = []
  if (stake) lines.push(stake)
  if (block && block !== stake) lines.push(block)
  if (dropped) lines.push(dropped)
  return lines
}

const DROP_LABEL: Record<GameKind, string> = {
  stableford: 'Stableford',
  modified: 'Modified',
  skins: 'Skins',
  nassau: 'Nassau',
  match: 'Match',
  wolf: 'Wolf',
  vegas: 'Vegas',
  bbb: 'Bingo Bango Bongo',
  coins: 'Coins',
}

const DROP_ORDER: GameKind[] = ['wolf', 'vegas', 'match', 'nassau', 'stableford', 'modified', 'skins', 'bbb', 'coins']

export function droppedGamesNote(selected: readonly GameKind[], count: number): string | null {
  if (count < 2) return null
  const legal = new Set(gamesForCount(count))
  const dropped = DROP_ORDER.filter((kind) => selected.includes(kind) && !legal.has(kind))
  if (dropped.length === 0) return null
  const labels = dropped.map((kind) => DROP_LABEL[kind])
  const list = labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `${list} ${labels.length === 1 ? 'is' : 'are'} off this round.`
}

function stableIds(players: SetupPlayer[]): Map<string, string> {
  const seen = new Map<string, number>()
  const ids = new Map<string, string>()
  for (const player of players) {
    const base = stablePlayerId(player.name)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    ids.set(player.id, count === 0 ? base : `${base}:${count + 1}`)
  }
  return ids
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
  sides?: Sides
}): FoursomeSave | null {
  if (setupBlock(input.players, input.kinds, input.siOk, input.grossOnly, input.stakes, input.sides)) return null
  const named = input.players.filter((player) => player.name.trim() && playerHandicap(player) != null)
  if (named.length < 2) return null
  const legal = activeKinds(input.kinds, named.length)
  if (legal.length === 0) return null
  const ids = stableIds(named)
  const players: FoursomePlayer[] = named.map((player) => ({
    id: ids.get(player.id) ?? stablePlayerId(player.name),
    name: player.name.trim(),
    courseHandicap: playerHandicap(player),
    isDeviceOwner: player.id === input.ownerId,
  }))
  if (!players.some((player) => player.isDeviceOwner)) players[0] = { ...players[0]!, isDeviceOwner: true }
  const fallback = defaultSides(named.map((player) => ({ id: player.id, courseHandicap: playerHandicap(player) })))
  const chosen = input.sides ?? fallback
  const mapSide = (list: string[]) => list.map((id) => ids.get(id)).filter((id): id is string => !!id)
  const games: FoursomeGame[] = legal.map((kind) => {
    const draft = input.stakes[kind] ?? emptyStake()
    const amount = parseStake(draft.amount)
    const game: FoursomeGame = { kind, stake: amount, pot: draft.pot }
    if (kind === 'skins') game.carry = draft.carry
    if (kind === 'nassau') {
      game.stake = null
      game.front = parseStake(draft.front)
      game.back = parseStake(draft.back)
      game.total = parseStake(draft.total)
      game.press = parseStake(draft.press)
    }
    if ((kind === 'nassau' || kind === 'match' || kind === 'vegas') && named.length !== 3) {
      game.teamA = mapSide(chosen.teamA)
      game.teamB = mapSide(chosen.teamB)
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

export function marksFromHole(hole: FoursomeHole | undefined): HoleMarks {
  if (!hole) return emptyMarks()
  return {
    wolf: hole.wolf ?? null,
    wolfSkipped: hole.wolfSkipped === true,
    bbb: hole.bbb ?? { bingo: null, bango: null, bongo: null },
    coins: hole.coins ?? [],
    press: hole.press === true,
  }
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

export function wolfRequired(save: FoursomeSave): boolean {
  return save.players.length === 4 && save.games.some((game) => game.kind === 'wolf')
}

export function logReady(rows: EntryRow[], marks?: HoleMarks, wolfOn = false): boolean {
  const scores = rows.length >= 2 && rows.every((row) => (row.gross != null || row.pickup) && !row.amber && !row.question)
  if (!scores) return false
  if (wolfOn && !marks?.wolfSkipped && !marks?.wolf) return false
  return true
}

/** Why LOG HOLE is off. Finish uses its own sentence. */
export function logHoleReason(rows: EntryRow[], marks: HoleMarks | undefined, wolfOn: boolean): string | null {
  if (logReady(rows, marks, wolfOn)) return null
  const scores = rows.length >= 2 && rows.every((row) => (row.gross != null || row.pickup) && !row.amber && !row.question)
  if (!scores) return LOG_SCORES
  return LOG_WOLF
}

export function speechHints(players: Array<{ name: string }>): string[] {
  return [
    ...players.map((player) => player.name),
    'birdie',
    'bogey',
    'double',
    'snowman',
    'pickup',
    'par',
    'eagle',
    'net',
    'bingo',
    'bango',
    'bongo',
    'greenie',
    'lone wolf',
    'press',
  ]
}

export function holesPlayed(save: FoursomeSave): number {
  return save.holes.filter((hole) => hole.scores.some((score) => score.gross != null || score.pickup)).length
}

export function lastLoggedHole(save: FoursomeSave): number | null {
  const numbers = save.holes.filter((hole) => hole.scores.some((score) => score.gross != null || score.pickup)).map((hole) => hole.number)
  if (numbers.length === 0) return null
  return Math.max(...numbers)
}

export function resumeHole(save: FoursomeSave): number {
  const last = lastLoggedHole(save)
  if (last == null) return 1
  return Math.min(18, last + 1)
}

function holeCount(holes: number): string {
  return `${holes} ${holes === 1 ? 'hole' : 'holes'}`
}

export function finishPrompt(holes: number): string | null {
  if (holes <= 0) return null
  if (holes >= 18) return 'Finish this round?'
  return `Finish this partial round (${holeCount(holes)})?`
}

export function partialLabel(holes: number): string | null {
  if (holes <= 0 || holes >= 18) return null
  return `Partial round (${holeCount(holes)})`
}

/** A correction of an earlier hole leaves the open hole's half-entered card alone. */
export function afterCorrection<T>(input: {
  openHole: number
  draftRows: T
  draftMarks: HoleMarks
  correctedHole: number
  correctedRows: T
  correctedMarks: HoleMarks
}): { hole: number; rows: T; marks: HoleMarks } {
  if (input.openHole === input.correctedHole) {
    return { hole: input.correctedHole, rows: input.correctedRows, marks: input.correctedMarks }
  }
  return { hole: input.openHole, rows: input.draftRows, marks: input.draftMarks }
}

/** A 44px toggle with one net line, two lines of the smaller disclosure, and the strip padding. Open adds the pot, the wolf, and the game line. */
export function liveStripHeight(open: boolean): number {
  const collapsed = 86
  if (!open) return collapsed
  return 158
}

export function potHero(pending: number, stake: number | null = null, players = 2, carry = true): string {
  const count = `${pending} ${pending === 1 ? 'skin' : 'skins'} on the line`
  const pot = stake == null ? null : pending * stake * Math.max(players - 1, 1)
  const line = pot == null ? count : `${count}, ${fmt(pot)}`
  const note = carry ? 'Carry-over is on.' : 'No carry-over.'
  return `${line}. ${note}`
}

/** A refused blind call is not read back. "Blind wolf. This hole." leaves nothing to confirm. */
export function refusedBlindReadback(readback: string | null): string | null {
  if (!readback) return null
  const stripped = readback.replace(/\bBlind wolf\b\.?\s*/g, ' ').replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim()
  if (!stripped || /^this hole\.?$/i.test(stripped)) return null
  return stripped
}

/**
 * One refusal, and no read-back of the call that was refused.
 * When the Blind button already shows the reason, this does not repeat it.
 */
export function blindRefusalLines(input: {
  readback: string | null
  question: string | null
  note: string | null
  holdVisible: boolean
}): { readback: string | null; question: string | null; note: string | null } {
  const readback = refusedBlindReadback(input.readback)
  const question = input.question && input.question !== BLIND_HOLD && input.question !== input.readback ? input.question : null
  const extra = input.note && input.note !== BLIND_HOLD ? input.note : null
  return {
    readback,
    question: question && question !== readback ? question : null,
    note: input.holdVisible ? extra : BLIND_HOLD,
  }
}

/** Read-back, then the question, then the note. The same sentence is kept once. */
export function visiblePhraseLines(input: {
  note: string | null
  readback: string | null
  question: string | null
}): string[] {
  const lines: string[] = []
  for (const line of [input.readback, input.question, input.note]) {
    const text = line?.trim()
    if (!text || lines.includes(text)) continue
    lines.push(text)
  }
  return lines
}

export function wolfPointsTable(names: string[], points: number[]): string[] {
  return names.map((name, index) => `${name} ${points[index] ?? 0}`)
}

export function stablefordLine(names: string[], points: number[] | null): string | null {
  if (!points || points.length === 0) return null
  const best = Math.max(...points)
  const leaders = names.filter((_, index) => (points[index] ?? 0) === best)
  if (leaders.length === 0) return null
  return `Stableford ${leaders.join(' and ')} ${best}`
}

export function dayAmount(nets: number[]): string | null {
  if (nets.length === 0) return null
  const best = Math.max(...nets)
  if (nets.every((net) => net === best)) return null
  return fmt(best, undefined, true)
}

export function oweCombinations(names: string[], nets: number[] | null): string[] {
  if (!nets || nets.length === 0) return []
  if (nets.reduce((sum, net) => sum + net, 0) !== 0) return []
  return settle(nets, names).map((row) => owesLine(String(row.frm), String(row.to), row.amount))
}

export function rivalryPick(
  players: { name: string; isDeviceOwner?: boolean }[],
  rounds: PhoneRound[],
): { a: string; b: string; winsA: number; winsB: number } | null {
  const named = players.filter((player) => player.name.trim())
  if (named.length < 2) return null
  const owner = named.find((player) => player.isDeviceOwner) ?? null
  const pool: Array<[typeof named[number], typeof named[number]]> = []
  if (owner) {
    for (const other of named) if (other.name !== owner.name) pool.push([owner, other])
  } else {
    for (let left = 0; left < named.length; left += 1) {
      for (let right = left + 1; right < named.length; right += 1) pool.push([named[left]!, named[right]!])
    }
  }
  let best: { a: string; b: string; winsA: number; winsB: number } | null = null
  let bestSwing = -1
  let bestWins = -1
  for (const [a, b] of pool) {
    const rivalry = headToHead(rounds, stablePlayerId(a.name), stablePlayerId(b.name))
    const swing = Math.abs(rivalry.gap)
    const wins = Math.abs(rivalry.winsA - rivalry.winsB)
    if (!best || swing > bestSwing || (swing === bestSwing && wins > bestWins)) {
      bestSwing = swing
      bestWins = wins
      best = { a: a.name, b: b.name, winsA: rivalry.winsA, winsB: rivalry.winsB }
    }
  }
  return best
}

export function wolfHero(name: string): string {
  return `${name} is the wolf`
}

export function rivalryHero(a: string, b: string, winsA: number, winsB: number): string {
  return `${a} ${winsA}\u2013${winsB} ${b}`
}

export function isCorrection(transcript: string): boolean {
  return /^\s*(actually|no wait|scratch that|make that|change|correction)\b/i.test(transcript)
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

function nameOf(save: FoursomeSave, id: unknown): string {
  if (typeof id !== 'string') return ''
  return save.players.find((player) => player.id === id)?.name ?? ''
}

function title(word: string): string {
  if (!word) return ''
  return word.slice(0, 1).toUpperCase() + word.slice(1)
}

function patchMarks(marks: HoleMarks, events: Array<Record<string, unknown>>): HoleMarks {
  const next: HoleMarks = {
    ...marks,
    bbb: { ...marks.bbb },
    coins: marks.coins.slice(),
  }
  for (const event of events) {
    const playerId = typeof event.playerId === 'string' ? event.playerId : null
    if ((event.type === 'bingo' || event.type === 'bango' || event.type === 'bongo') && playerId) {
      next.bbb = { ...next.bbb, [event.type]: playerId }
    }
    if (event.type === 'coin' && playerId && COIN_NAMES.has(event.coin as CoinName)) {
      const coin = event.coin as CoinName
      if (!next.coins.some((item) => item.playerId === playerId && item.coin === coin)) next.coins.push({ playerId, coin })
    }
    if (event.type === 'wolf_pick' && playerId) {
      const mode = event.wolfMode === 'blind' || event.wolfMode === 'lone' || event.wolfMode === 'partner' ? event.wolfMode : null
      if (!mode || (mode === 'partner' && typeof event.partnerId !== 'string')) continue
      next.wolf = { mode, wolfId: playerId, partnerId: typeof event.partnerId === 'string' ? event.partnerId : null }
      next.wolfSkipped = false
    }
    if (event.type === 'press') next.press = true
  }
  return next
}

function inactiveNote(save: FoursomeSave, events: Array<Record<string, unknown>>): string | null {
  const kinds = new Set(save.games.map((game) => game.kind))
  if (events.some((event) => event.type === 'bingo' || event.type === 'bango' || event.type === 'bongo') && !kinds.has('bbb')) {
    return 'Bingo Bango Bongo is not in this round.'
  }
  if (events.some((event) => event.type === 'coin') && !kinds.has('coins')) return 'Coins are not in this round.'
  if (events.some((event) => event.type === 'wolf_pick') && !kinds.has('wolf')) return 'Wolf is not in this round.'
  if (events.some((event) => event.type === 'press') && !kinds.has('nassau')) return 'Nassau is not in this round.'
  return null
}

function bindWolfEvents(
  save: FoursomeSave,
  events: Array<Record<string, unknown>>,
  holeWolfId: string | null,
): { events: Array<Record<string, unknown>>; question: string | null } {
  const names: Record<string, string> = {}
  for (const player of save.players) names[player.id] = player.name
  let question: string | null = null
  const next = events.flatMap((event) => {
    if (event.type !== 'wolf_pick') return [event]
    const mode = event.wolfMode === 'blind' || event.wolfMode === 'lone' || event.wolfMode === 'partner' ? event.wolfMode : null
    if (!mode) return [event]
    const saved = savedWolfCall({
      mode,
      namedWolfId: typeof event.playerId === 'string' ? event.playerId : null,
      partnerId: typeof event.partnerId === 'string' ? event.partnerId : null,
      holeWolfId,
      names,
    })
    if (!saved) return [event]
    if (saved.question) question = saved.question
    if (saved.rejected) return []
    return [{ ...event, playerId: saved.wolfId, partnerId: saved.partnerId, wolfMode: saved.mode }]
  })
  return { events: next, question }
}

export function applyPhrase(
  rows: EntryRow[],
  transcript: string,
  save: FoursomeSave,
  hole: { par: number; strokeIndex: number },
  ctx?: { wolfId?: string | null; marks?: HoleMarks; holeNumber?: number | null },
): PhraseApply {
  const marks = ctx?.marks ?? emptyMarks()
  const text = transcript.trim()
  const missed = { rows, marks, command: null, note: MISSED, readback: null, question: null, caught: false } as const
  if (!text) return missed
  const parsed = parsePhrase(text, {
    players: save.players.map((player) => ({ id: player.id, name: player.name, isDeviceOwner: player.isDeviceOwner })),
    par: hole.par,
    strokes: strokeMap(save, hole.strokeIndex),
    wolfId: ctx?.wolfId ?? null,
  })
  const bound = bindWolfEvents(save, parsed.events, ctx?.wolfId ?? null)
  if (parsed.intent === 'command') {
    const type = parsed.commands[0]?.type
    const command = type === 'skip_hole' || type === 'undo' ? type : null
    if (!command) return missed
    return {
      rows,
      marks,
      command,
      note: null,
      readback: command === 'undo' ? 'Undo the last hole.' : 'Skip this hole.',
      question: null,
      caught: true,
    }
  }
  const parts: string[] = []
  let next = rows
  for (const score of parsed.scores) {
    const playerId = String(score.playerId)
    const name = nameOf(save, playerId)
    const amber = Number(score.confidence) < 0.8 || score.state === 'unresolved'
    const question = typeof score.question === 'string' ? score.question : null
    if (score.state === 'pickup') parts.push(`${name} picked up`)
    else if (score.state === 'scored' && typeof score.gross === 'number') parts.push(`${name} ${score.gross}`)
    else if (question) parts.push(question)
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
  for (const event of bound.events) {
    const who = nameOf(save, event.playerId)
    if (event.type === 'bingo' || event.type === 'bango' || event.type === 'bongo') parts.push(`${title(String(event.type))} ${who}`.trim())
    else if (event.type === 'coin') parts.push(`${title(String(event.coin))} ${who}`.trim())
    else if (event.type === 'wolf_pick' && event.wolfMode === 'lone') parts.push('Lone wolf')
    else if (event.type === 'wolf_pick' && event.wolfMode === 'blind') parts.push('Blind wolf')
    else if (event.type === 'wolf_pick') parts.push(`${nameOf(save, event.playerId)} takes ${nameOf(save, event.partnerId)}`.trim())
    else if (event.type === 'press') parts.push('Press')
  }
  if (parsed.scores.length === 0 && bound.events.length === 0) {
    if (bound.question) {
      return { rows, marks, command: null, note: bound.question, readback: bound.question, question: bound.question, caught: true }
    }
    return missed
  }
  const patched = patchMarks(marks, bound.events)
  const aside = inactiveNote(save, bound.events)
  const question = parsed.questions.find((line) => !line.toLowerCase().includes("didn't catch")) ?? null
  const body = parts.join('. ')
  const readback = parts.length
    ? ctx?.holeNumber != null
      ? `Hole ${ctx.holeNumber}: ${body}`
      : `${body}. This hole.`
    : bound.question
  return {
    rows: next,
    marks: patched,
    command: null,
    note: aside ?? bound.question ?? question,
    readback,
    question: bound.question,
    caught: true,
  }
}

export function commitHole(save: FoursomeSave, holeNumber: number, rows: EntryRow[], marks: HoleMarks): FoursomeSave {
  return {
    ...save,
    holes: save.holes.map((hole) =>
      hole.number !== holeNumber
        ? hole
        : {
            ...hole,
            scores: rows.map((row) => ({ playerId: row.playerId, gross: row.pickup ? null : row.gross, pickup: row.pickup })),
            wolf: marks.wolfSkipped ? null : marks.wolf,
            wolfSkipped: marks.wolfSkipped,
            bbb: marks.bbb,
            coins: marks.coins,
            press: marks.press,
          },
    ),
  }
}

export function correctLastHole(
  save: FoursomeSave,
  transcript: string,
): { save: FoursomeSave; hole: number; readback: string | null; note: string | null; caught: boolean } {
  const hole = lastLoggedHole(save)
  if (hole == null) return { save, hole: 0, readback: null, note: 'No hole is logged yet.', caught: false }
  const card = save.holes.find((item) => item.number === hole)
  if (!card) return { save, hole, readback: null, note: MISSED, caught: false }
  const applied = applyPhrase(rowsFromHole(save, hole), transcript, save, card, {
    wolfId: card.wolf?.wolfId ?? null,
    marks: marksFromHole(card),
    holeNumber: hole,
  })
  if (!applied.caught || applied.command) return { save, hole, readback: null, note: MISSED, caught: false }
  return {
    save: commitHole(save, hole, applied.rows, applied.marks),
    hole,
    readback: applied.readback,
    note: applied.note,
    caught: true,
  }
}

export function undoLastHole(save: FoursomeSave): { save: FoursomeSave; hole: number } | null {
  const hole = lastLoggedHole(save)
  if (hole == null) return null
  return {
    hole,
    save: {
      ...save,
      holes: save.holes.map((item) =>
        item.number !== hole
          ? item
          : { ...item, scores: [], wolf: null, wolfSkipped: false, bbb: { bingo: null, bango: null, bongo: null }, coins: [], press: false },
      ),
    },
  }
}

export function toggleCoin(marks: HoleMarks, playerId: string, coin: CoinName): HoleMarks {
  const has = marks.coins.some((item) => item.playerId === playerId && item.coin === coin)
  return {
    ...marks,
    coins: has ? marks.coins.filter((item) => !(item.playerId === playerId && item.coin === coin)) : [...marks.coins, { playerId, coin }],
  }
}

export function liveScore(save: FoursomeSave): RoundScore {
  return scoreFoursome(save)
}

export function recapFor(save: FoursomeSave): string {
  return recapText(save)
}

export function rosterLine(save: FoursomeSave, game: FoursomeGame): string | null {
  if (game.kind !== 'nassau' && game.kind !== 'match' && game.kind !== 'vegas') return null
  if (game.kind === 'nassau' && save.players.length === 3) return 'Low score. No sides.'
  if (!game.teamA?.length || !game.teamB?.length) return null
  const name = (id: string) => save.players.find((player) => player.id === id)?.name ?? ''
  const left = game.teamA.map(name).filter(Boolean).join(' and ')
  const right = game.teamB.map(name).filter(Boolean).join(' and ')
  if (!left || !right) return null
  return `${left} vs ${right}`
}

export function winnerText(game: Pick<GameScore, 'points' | 'winners'> & { line?: string }): string {
  if (game.line === 'All square') return 'All square'
  if (game.points && game.points.length > 0 && game.points.every((point) => point === 0)) return 'No winner'
  if (game.winners.length === 0) return 'No winner'
  return game.winners.join(' and ')
}

export function skinsLine(
  names: string[],
  points: number[],
  nets: number[] | null,
  pending: number,
  finished: boolean,
  carry = true,
): string {
  const bits = names.flatMap((name, index) => {
    const won = points[index] ?? 0
    const net = nets ? nets[index] ?? 0 : null
    if (won === 0 && (net == null || net === 0)) return []
    const pointsLabel = `${name} ${won} ${won === 1 ? 'skin' : 'skins'}`
    if (net == null || net === 0) return [pointsLabel]
    return [`${pointsLabel}, ${fmt(net, undefined, true)}`]
  })
  const who = bits.length ? bits.join(', ') : 'No skins won'
  if (finished && !carry) return who
  const tail = finished ? (pending > 0 ? `${pending} left unplayed` : 'Played out') : `${pending} on the line`
  return `${who}. ${tail}`
}

export function gameLine(game: GameScore, ctx: { names: string[]; pending: number; finished: boolean; roster: string | null; carry?: boolean }): string {
  if (game.kind === 'skins') return skinsLine(ctx.names, game.points ?? [], game.nets, ctx.pending, ctx.finished, ctx.carry !== false)
  if ((game.kind === 'bbb' || game.kind === 'coins' || game.kind === 'wolf') && game.points && game.points.every((point) => point === 0)) {
    return 'No points on the card'
  }
  if (game.kind === 'vegas' && ctx.roster) {
    const [left, right] = ctx.roster.split(' vs ')
    return game.line.replace('Team A', left || 'Team A').replace('Team B', right || 'Team B')
  }
  return game.line
}

export function zeroSumLine(score: Pick<RoundScore, 'nets' | 'zeroSumOk' | 'note'>): string {
  if (!score.zeroSumOk) return score.note ?? "can't total this round"
  const total = score.nets.reduce((sum, net) => sum + net, 0)
  return `Zero-sum check: ${fmt(total, undefined, true)} across the group.`
}

export interface PhoneRound {
  id: string
  players: { id: string; name: string }[]
  nets: number[]
}

/** Same display name is one person, even when each round minted a new id. */
export function phoneRounds(saves: FoursomeSave[]): PhoneRound[] {
  return saves.flatMap((save) => {
    if (holesPlayed(save) === 0) return []
    const scored = scoreFoursome(save)
    if (!scored.zeroSumOk) return []
    return [{
      id: save.id,
      players: save.players.map((player) => ({ id: stablePlayerId(player.name), name: player.name.trim() })),
      nets: scored.nets,
    }]
  })
}

export function localPlayedOn(date = new Date()): string {
  return calendarDate(date)
}

export { DISCLOSURE, FOOTER, SI_AMBER, calendarDate, playedOnDate }
