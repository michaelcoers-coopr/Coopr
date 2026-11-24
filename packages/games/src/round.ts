import { DISCLOSURE, FOOTER, ZERO_SUM_FAIL, handicapPrompt } from './copy'
import { fmt, owesLine, pointsNet, roundWhole, settle, type NassauValues } from './money'
import {
  countbackWinner,
  holeResults,
  matchValue,
  nassauValue,
  pointsNassauValue,
  scoreSkins,
  scoreVegas,
  scoreWolf,
  stablefordPoints,
  stablefordTotals,
  stablefordValue,
  suggestTeams,
  type GrossCell,
  type WolfCall,
} from './scoring'
import { playingHandicaps, strokeIndexValid, strokesOn } from './strokes'

export type GameKind = 'stableford' | 'modified' | 'skins' | 'nassau' | 'match' | 'wolf' | 'vegas' | 'bbb' | 'coins'

export interface FoursomePlayer {
  id: string
  name: string
  courseHandicap: number | null
  isDeviceOwner: boolean
}

export interface FoursomeGame {
  kind: GameKind
  stake: number | null
  front?: number | null
  back?: number | null
  total?: number | null
  press?: number | null
  pot?: boolean
  teamA?: string[]
  teamB?: string[]
  carry?: boolean
  gross?: boolean
}

export interface HoleScore {
  playerId: string
  gross: number | null
  pickup: boolean
}

export interface FoursomeHole {
  number: number
  par: number
  strokeIndex: number
  scores: HoleScore[]
  wolf?: { mode: 'partner' | 'lone' | 'blind'; wolfId: string; partnerId: string | null } | null
  /** An explicit skip. A hole with no call and no skip is not logged. */
  wolfSkipped?: boolean
  coins?: { playerId: string; coin: 'greenie' | 'sandie' | 'arnie' | 'barkie' }[]
  bbb?: { bingo: string | null; bango: string | null; bongo: string | null }
  press?: boolean
}

export interface FoursomeSave {
  id: string
  courseName: string
  players: FoursomePlayer[]
  games: FoursomeGame[]
  holes: FoursomeHole[]
  grossOnly: boolean
  wholeUnits: boolean
  finishedOn: string | null
}

export interface GameScore {
  kind: GameKind
  label: string
  points: number[] | null
  nets: number[] | null
  winners: string[]
  line: string
}

export interface SettleLine {
  from: string
  to: string
  amount: number
  line: string
}

export interface RoundScore {
  games: GameScore[]
  nets: number[]
  exactNets: number[]
  zeroSumOk: boolean
  settle: SettleLine[]
  note: string | null
  skinsPending: number
  birdies: { name: string; count: number }[]
  snowmen: { name: string; count: number }[]
}

const LOW = new Set<GameKind>(['skins', 'nassau', 'match', 'wolf', 'vegas'])
const LABELS: Record<GameKind, string> = {
  stableford: 'Stableford',
  modified: 'Modified Stableford',
  skins: 'Skins',
  nassau: 'Nassau',
  match: 'Match',
  wolf: 'Wolf',
  vegas: 'Vegas',
  bbb: 'Bingo Bango Bongo',
  coins: 'Coins',
}

export function gamesForCount(n: number): GameKind[] {
  const all: GameKind[] = ['stableford', 'modified', 'skins', 'nassau', 'match', 'wolf', 'vegas', 'bbb', 'coins']
  return all.filter((kind) => {
    if (kind === 'wolf') return n === 4
    if (kind === 'vegas') return n === 4
    if (kind === 'match') return n === 2 || n === 4
    if (kind === 'nassau') return n === 2 || n === 3 || n === 4
    return n >= 2 && n <= 4
  })
}

export function emptyHoles(card: Array<{ par: number; strokeIndex: number }>): FoursomeHole[] {
  return card.slice(0, 18).map((hole, i) => ({
    number: i + 1,
    par: hole.par,
    strokeIndex: hole.strokeIndex,
    scores: [],
  }))
}

function indexes(save: FoursomeSave): number[] {
  const by = new Map(save.holes.map((h) => [h.number, h.strokeIndex]))
  return Array.from({ length: 18 }, (_, i) => by.get(i + 1) ?? 0)
}

function pars(save: FoursomeSave): number[] {
  const by = new Map(save.holes.map((h) => [h.number, h.par]))
  return Array.from({ length: 18 }, (_, i) => by.get(i + 1) ?? 4)
}

function matrix(save: FoursomeSave): GrossCell[][] {
  const ids = save.players.map((p) => p.id)
  const by = new Map(save.holes.map((h) => [h.number, h]))
  return Array.from({ length: 18 }, (_, n) => {
    const hole = by.get(n + 1)
    if (!hole || hole.scores.length === 0) return ids.map(() => null as GrossCell)
    return ids.map((id) => {
      const score = hole.scores.find((s) => s.playerId === id)
      if (!score) return null
      if (score.pickup) return 'pickup'
      return score.gross
    })
  })
}

function phFor(save: FoursomeSave, game: FoursomeGame): number[] | null {
  const gross = save.grossOnly || game.gross === true
  if (gross) return save.players.map(() => 0)
  if (game.kind === 'bbb' || game.kind === 'coins') return save.players.map(() => 0)
  if (save.players.some((p) => p.courseHandicap == null)) return null
  const chs = save.players.map((p) => p.courseHandicap ?? 0)
  return playingHandicaps(chs, LOW.has(game.kind) ? 'low' : 'full')
}

function namesOf(save: FoursomeSave, indexesWon: number[]): string[] {
  return indexesWon.map((i) => save.players[i]?.name ?? '')
}

function winnerIndexes(values: number[], higher = true): number[] {
  if (values.length === 0) return []
  const best = higher ? Math.max(...values) : Math.min(...values)
  return values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
}

export interface SavedWolfCall {
  mode: 'partner' | 'lone' | 'blind'
  wolfId: string
  partnerId: string | null
  question: string | null
  /** A wolf cannot take themself. The call is dropped and `question` is the prompt. */
  rejected: boolean
}

/**
 * The hole's rotation wolf is the wolf that gets scored.
 * A phrase that names someone else does not replace that id.
 */
export function savedWolfCall(input: {
  mode: 'partner' | 'lone' | 'blind'
  namedWolfId: string | null
  partnerId: string | null
  holeWolfId: string | null
  names: Readonly<Record<string, string>>
}): SavedWolfCall | null {
  const wolfId = input.holeWolfId ?? input.namedWolfId
  if (!wolfId) return null
  if (input.mode !== 'partner') return { mode: input.mode, wolfId, partnerId: null, question: null, rejected: false }
  if (!input.partnerId) return null
  let partnerId = input.partnerId
  if (partnerId === wolfId && input.namedWolfId && input.namedWolfId !== wolfId) partnerId = input.namedWolfId
  const wolfName = input.names[wolfId] || 'The wolf'
  if (partnerId === wolfId) {
    return { mode: 'partner', wolfId, partnerId: null, question: `${wolfName} can't take ${wolfName}. Pick someone else.`, rejected: true }
  }
  const named = input.namedWolfId
  const partnerName = input.names[partnerId] || 'them'
  const question = named && named !== wolfId ? `${wolfName} is the wolf, did you mean ${wolfName} takes ${partnerName}?` : null
  return { mode: 'partner', wolfId, partnerId, question, rejected: false }
}

/** Headline for a staked round. A flat card is all square, not four winners. */
export function dayLine(names: string[], nets: number[]): string {
  if (nets.length === 0) return 'All square'
  const best = Math.max(...nets)
  if (nets.every((net) => net === best)) return 'All square'
  const winners = names.filter((_, index) => (nets[index] ?? 0) === best)
  if (winners.length === 1) return `${winners[0]} takes the day`
  return `${winners.join(' and ')} share the day`
}

function teamIndexes(save: FoursomeSave, ids: string[] | undefined, fallback: number[]): number[] {
  if (!ids || ids.length === 0) return fallback
  return ids.map((id) => save.players.findIndex((p) => p.id === id)).filter((i) => i >= 0)
}

function nassauTeams(save: FoursomeSave, game: FoursomeGame): { teamA: number[]; teamB: number[] } {
  const n = save.players.length
  if (n === 2) {
    const teamA = teamIndexes(save, game.teamA, [0])
    const teamB = teamIndexes(save, game.teamB, [1])
    if (teamA.length === 1 && teamB.length === 1 && teamA[0] !== teamB[0]) return { teamA, teamB }
    return { teamA: [0], teamB: [1] }
  }
  if (n === 4) {
    const suggested = suggestTeams(save.players.map((p) => p.courseHandicap ?? 0))
    return {
      teamA: teamIndexes(save, game.teamA, suggested.teamA),
      teamB: teamIndexes(save, game.teamB, suggested.teamB),
    }
  }
  return { teamA: [], teamB: [] }
}

function pointsByHole(save: FoursomeSave, phs: number[], mod = false): number[][] {
  const rows = matrix(save)
  const par = pars(save)
  const si = indexes(save)
  return rows.map((row, h) =>
    save.players.map((_, p) => {
      const cell = row[p]
      if (cell == null) return 0
      return stablefordPoints(cell, par[h] ?? 4, strokesOn(phs[p] ?? 0, si[h] ?? 18), mod)
    }),
  )
}

function manualPresses(save: FoursomeSave): Set<number> {
  const holes = new Set<number>()
  for (const hole of save.holes) if (hole.press) holes.add(hole.number)
  return holes
}

export function scoreFoursome(save: FoursomeSave): RoundScore {
  const n = save.players.length
  const siOk = save.grossOnly || strokeIndexValid(indexes(save))
  const missing = save.players.find((p) => p.courseHandicap == null)
  const rows = matrix(save)
  const par = pars(save)
  const si = indexes(save)
  const games: GameScore[] = []
  let skinsPending = 1
  for (const game of save.games) {
    const label = LABELS[game.kind]
    const needsNet = game.kind !== 'bbb' && game.kind !== 'coins'
    if (needsNet && !siOk && !game.gross) {
      games.push({ kind: game.kind, label, points: null, nets: null, winners: [], line: 'Gross only until the stroke index is set.' })
      continue
    }
    const phs = phFor(save, game)
    if (phs == null) {
      games.push({
        kind: game.kind,
        label,
        points: null,
        nets: null,
        winners: [],
        line: missing ? handicapPrompt(missing.name) : 'Enter a course handicap.',
      })
      continue
    }
    games.push(scoreGame(save, game, rows, phs, par, si))
    if (game.kind === 'skins') skinsPending = scoreSkins(rows, phs, si, game.carry !== false).pending
  }
  const exact = Array<number>(n).fill(0)
  let any = false
  for (const game of games) {
    if (!game.nets) continue
    any = true
    game.nets.forEach((v, i) => {
      exact[i] = (exact[i] ?? 0) + v
    })
  }
  const exactSum = exact.reduce((s, v) => s + v, 0)
  const zeroSumOk = exactSum === 0
  const nets = zeroSumOk && save.wholeUnits ? roundWhole(exact) : exact.slice()
  let note: string | null = null
  let transfers: SettleLine[] = []
  if (!zeroSumOk) note = ZERO_SUM_FAIL
  else if (any) {
    transfers = settle(nets, save.players.map((p) => p.name)).map((t) => ({
      from: String(t.frm),
      to: String(t.to),
      amount: t.amount,
      line: owesLine(String(t.frm), String(t.to), t.amount),
    }))
  }
  return {
    games,
    nets,
    exactNets: exact,
    zeroSumOk,
    settle: transfers,
    note,
    skinsPending,
    birdies: factCounts(save, (gross, holePar) => gross === holePar - 1),
    snowmen: factCounts(save, (gross) => gross === 8),
  }
}

function scoreGame(
  save: FoursomeSave,
  game: FoursomeGame,
  rows: GrossCell[][],
  phs: number[],
  par: number[],
  si: number[],
): GameScore {
  const label = LABELS[game.kind]
  const n = save.players.length
  if (game.kind === 'stableford' || game.kind === 'modified') {
    const pts = stablefordTotals(rows, phs, par, si, game.kind === 'modified')
    const pot = game.pot !== false
    const nets = stablefordValue(pts, game.stake, pot)
    const byHole = pointsByHole(save, phs, game.kind === 'modified')
    const winners = pot ? winnerIndexes(pts) : countbackWinner(byHole)
    return { kind: game.kind, label, points: pts, nets, winners: namesOf(save, winners), line: pointsLine(save, pts, nets) }
  }
  if (game.kind === 'skins') {
    const { won, pending } = scoreSkins(rows, phs, si, game.carry !== false)
    const nets = pointsNet(won, game.stake)
    const onLine = game.stake == null ? `${pending} on the line` : `${pending} on the line, ${fmt(pending * game.stake * Math.max(n - 1, 1))} if it ends now`
    return {
      kind: game.kind,
      label,
      points: won,
      nets,
      winners: namesOf(save, winnerIndexes(won)),
      line: `${pointsLine(save, won, nets)}. ${onLine}`,
    }
  }
  if (game.kind === 'wolf' && n === 4) {
    const calls: Array<WolfCall | null> = Array.from({ length: 18 }, (_, h) => {
      const hole = save.holes.find((x) => x.number === h + 1)
      if (!hole?.wolf) return null
      const wolf = save.players.findIndex((p) => p.id === hole.wolf!.wolfId)
      if (wolf < 0) return null
      if (hole.wolf.mode === 'partner') {
        const partner = save.players.findIndex((p) => p.id === hole.wolf!.partnerId)
        if (partner < 0) return null
        return { mode: 'partner', wolf, partner }
      }
      return { mode: hole.wolf.mode, wolf }
    })
    const pts = scoreWolf(rows, calls, phs, si)
    const nets = pointsNet(pts, game.stake)
    return { kind: game.kind, label, points: pts, nets, winners: namesOf(save, winnerIndexes(pts)), line: pointsLine(save, pts, nets) }
  }
  if (game.kind === 'vegas' && n === 4) {
    const teams = nassauTeams(save, game)
    const diff = scoreVegas(rows, teams.teamA, teams.teamB, phs, par, si)
    const nets = game.stake == null ? null : vegasStake(diff, teams.teamA, teams.teamB, n, game.stake)
    const side = diff === 0 ? 'All square' : diff > 0 ? 'Team A' : 'Team B'
    return { kind: game.kind, label, points: [diff], nets, winners: diff === 0 ? [] : namesOf(save, diff > 0 ? teams.teamA : teams.teamB), line: `${side} ${Math.abs(diff)}` }
  }
  if (game.kind === 'nassau' && n === 3) {
    const values = legValues(game)
    const byHole = pointsByHole(save, phs, false)
    const nets = pointsNassauValue(byHole, values)
    const pts = byHole.reduce((acc, row) => row.map((v, i) => (acc[i] ?? 0) + v), Array<number>(n).fill(0))
    return { kind: game.kind, label, points: pts, nets, winners: namesOf(save, winnerIndexes(pts)), line: pointsLine(save, pts, nets) }
  }
  if ((game.kind === 'nassau' || game.kind === 'match') && (n === 2 || n === 4)) {
    const teams = nassauTeams(save, game)
    const results = holeResults(rows, phs, si, teams.teamA, teams.teamB)
    if (game.kind === 'match') {
      const nets = matchValue(results, teams.teamA, teams.teamB, n, game.stake)
      const up = Object.keys(results).length ? runningUp(results) : 0
      const winners = up === 0 ? [] : namesOf(save, up > 0 ? teams.teamA : teams.teamB)
      return { kind: game.kind, label, points: [up], nets, winners, line: up === 0 ? 'All square' : `${winners.join(' and ')} ${Math.abs(up)} up` }
    }
    const scored = nassauValue(results, teams.teamA, teams.teamB, n, legValues(game), manualPresses(save))
    const nets = scored.nets
    const tied = !!nets && nets.length > 0 && nets.every((net) => net === nets[0])
    const winners = nets && !tied ? namesOf(save, winnerIndexes(nets)) : []
    return { kind: game.kind, label, points: null, nets, winners, line: nets ? (tied ? 'All square' : moneyLine(save, nets)) : 'Points only' }
  }
  if (game.kind === 'bbb' || game.kind === 'coins') {
    const pts = Array<number>(n).fill(0)
    for (const hole of save.holes) {
      if (game.kind === 'coins') {
        for (const coin of hole.coins ?? []) {
          const i = save.players.findIndex((p) => p.id === coin.playerId)
          if (i >= 0) pts[i] = (pts[i] ?? 0) + 1
        }
      } else if (hole.bbb) {
        for (const id of [hole.bbb.bingo, hole.bbb.bango, hole.bbb.bongo]) {
          if (!id) continue
          const i = save.players.findIndex((p) => p.id === id)
          if (i >= 0) pts[i] = (pts[i] ?? 0) + 1
        }
      }
    }
    const nets = pointsNet(pts, game.stake)
    return { kind: game.kind, label, points: pts, nets, winners: namesOf(save, winnerIndexes(pts)), line: pointsLine(save, pts, nets) }
  }
  return { kind: game.kind, label, points: null, nets: null, winners: [], line: 'Not in this round' }
}

function vegasStake(diff: number, teamA: number[], teamB: number[], n: number, stake: number): number[] {
  const sign = (diff > 0 ? 1 : 0) - (diff < 0 ? 1 : 0)
  const out = Array<number>(n).fill(0)
  const win = sign > 0 ? teamA : teamB
  const lose = sign > 0 ? teamB : teamA
  if (sign === 0) return out
  for (const p of win) out[p] = Math.abs(diff) * stake
  for (const p of lose) out[p] = -Math.abs(diff) * stake
  return out
}

function runningUp(results: Record<number, number>): number {
  let up = 0
  for (let h = 1; h <= 18; h++) {
    if (!Object.prototype.hasOwnProperty.call(results, h)) continue
    up += results[h] ?? 0
    if (Math.abs(up) > 18 - h) break
  }
  return up
}

function legValues(game: FoursomeGame): NassauValues {
  return {
    front: game.front ?? null,
    back: game.back ?? null,
    total: game.total ?? null,
    press: game.press ?? null,
  }
}

function pointsLine(save: FoursomeSave, pts: number[], nets: number[] | null): string {
  return save.players.map((p, i) => `${p.name} ${pts[i] ?? 0}${nets ? ' ' + fmt(nets[i] ?? 0, undefined, true) : ''}`).join(', ')
}

function moneyLine(save: FoursomeSave, nets: number[]): string {
  return save.players.map((p, i) => `${p.name} ${fmt(nets[i] ?? 0, undefined, true)}`).join(', ')
}

function factCounts(save: FoursomeSave, hit: (gross: number, par: number) => boolean): { name: string; count: number }[] {
  return save.players.map((p) => {
    let count = 0
    for (const hole of save.holes) {
      const score = hole.scores.find((s) => s.playerId === p.id)
      if (!score || score.pickup || score.gross == null) continue
      if (hit(score.gross, hole.par)) count += 1
    }
    return { name: p.name, count }
  }).filter((row) => row.count > 0)
}

export function recapText(save: FoursomeSave, score: RoundScore = scoreFoursome(save)): string {
  const lines: string[] = []
  const staked = score.games.some((g) => g.nets)
  if (!score.zeroSumOk) lines.push(ZERO_SUM_FAIL)
  else if (!staked) lines.push('Points only. No stakes entered.')
  else {
    lines.push(dayLine(save.players.map((p) => p.name), score.nets))
    lines.push(save.players.map((p, i) => `${p.name} ${fmt(score.nets[i] ?? 0, undefined, true)}`).join(', '))
  }
  for (const game of score.games) {
    if (game.winners.length === 0) continue
    lines.push(`${game.label}: ${game.winners.join(' and ')}`)
  }
  const roast = roastLine(score)
  if (roast) lines.push(roast)
  if (score.zeroSumOk) for (const row of score.settle) lines.push(row.line)
  lines.push(DISCLOSURE)
  lines.push(FOOTER)
  return lines.join('\n')
}

function roastLine(score: RoundScore): string | null {
  const birdie = [...score.birdies].sort((a, b) => b.count - a.count)[0]
  if (birdie) return `${birdie.name} made ${birdie.count} ${birdie.count === 1 ? 'birdie' : 'birdies'}.`
  const snow = [...score.snowmen].sort((a, b) => b.count - a.count)[0]
  if (snow) return `${snow.name} made ${snow.count} ${snow.count === 1 ? 'snowman' : 'snowmen'}.`
  const skins = score.games.find((g) => g.kind === 'skins' && g.points)
  if (skins?.points) {
    const best = Math.max(...skins.points)
    if (best > 0) {
      const i = skins.points.indexOf(best)
      const name = skins.winners[0]
      if (name) return `${name} won ${best} ${best === 1 ? 'skin' : 'skins'}.`
      void i
    }
  }
  return null
}

export function stripCells(save: FoursomeSave, score: RoundScore = scoreFoursome(save)): Array<{ name: string; text: string }> {
  const staked = score.games.some((g) => g.nets)
  return save.players.map((p, i) => ({
    name: p.name,
    text: staked && score.zeroSumOk ? fmt(score.nets[i] ?? 0, undefined, true) : '—',
  }))
}
