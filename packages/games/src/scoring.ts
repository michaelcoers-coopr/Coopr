import { nassauMoney, points3Net, pointsNet, potNet, teamNet, vegasNet, type NassauValues } from './money'
import { strokesOn } from './strokes'

/** A hole cell. null = not entered. 'pickup' = picked up. */
export type GrossCell = number | 'pickup' | null

export type WolfCall =
  | { mode: 'partner'; wolf: number; partner: number }
  | { mode: 'lone' | 'blind'; wolf: number }

export function stablefordPoints(gross: GrossCell, par: number, strokes: number, mod = false): number {
  if (gross == null || gross === 'pickup') return mod ? -3 : 0
  const net = gross - strokes
  const d = net - par
  if (!mod) return Math.max(0, 2 - d)
  if (d <= -3) return 8
  if (d === -2) return 5
  if (d === -1) return 2
  if (d === 0) return 0
  if (d === 1) return -1
  return -3
}

export function stablefordTotals(
  gross: GrossCell[][],
  phs: number[],
  par: number[],
  si: number[],
  mod = false,
): number[] {
  const n = phs.length
  const pts = Array<number>(n).fill(0)
  for (let h = 0; h < gross.length; h++) {
    const row = gross[h]
    if (!row) continue
    for (let p = 0; p < n; p++) {
      const g = row[p]
      if (g == null) continue
      pts[p] = (pts[p] ?? 0) + stablefordPoints(g, par[h] ?? 4, strokesOn(phs[p] ?? 0, si[h] ?? 18), mod)
    }
  }
  return pts
}

function holeReady(row: GrossCell[] | null | undefined): row is GrossCell[] {
  return !!row && row.length > 0 && row.every((cell) => cell != null)
}

export function scoreSkins(
  gross: GrossCell[][],
  phs: number[],
  si: number[],
  carry = true,
): { won: number[]; pending: number } {
  const n = phs.length
  const won = Array<number>(n).fill(0)
  let pend = 1
  for (let h = 0; h < gross.length; h++) {
    const row = gross[h]
    if (!holeReady(row)) continue
    const nets: Array<number | 'pickup'> = row.map((cell, p) =>
      cell === 'pickup' ? 'pickup' : (cell as number) - strokesOn(phs[p] ?? 0, si[h] ?? 18),
    )
    const nums = nets.filter((v): v is number => typeof v === 'number')
    if (nums.length === 0) {
      if (carry) pend += 1
      else pend = 1
      continue
    }
    const m = Math.min(...nums)
    const w = nets.map((v, p) => (v === m ? p : -1)).filter((p) => p >= 0)
    if (w.length === 1) {
      won[w[0]!] = (won[w[0]!] ?? 0) + pend
      pend = 1
    } else if (carry) pend += 1
    else pend = 1
  }
  return { won, pending: pend }
}

function sideBest(nets: Array<number | 'pickup'>, team: number[]): { best: number | null; pickup: boolean } {
  let best: number | null = null
  let pickup = false
  for (const i of team) {
    const v = nets[i]
    if (v === 'pickup') pickup = true
    else if (typeof v === 'number' && (best == null || v < best)) best = v
  }
  return { best, pickup }
}

/** +1 team A won the hole, -1 team B, 0 halved. null if the hole is not complete. */
export function betterBallSign(row: GrossCell[], phs: number[], si: number, teamA: number[], teamB: number[]): number | null {
  if (!holeReady(row)) return null
  const nets: Array<number | 'pickup'> = row.map((cell, p) =>
    cell === 'pickup' ? 'pickup' : (cell as number) - strokesOn(phs[p] ?? 0, si),
  )
  const a = sideBest(nets, teamA)
  const b = sideBest(nets, teamB)
  if (a.best == null && b.best == null) return 0
  if (a.best == null) return -1
  if (b.best == null) return 1
  return (a.best < b.best ? 1 : 0) - (a.best > b.best ? 1 : 0)
}

export function holeResults(
  gross: GrossCell[][],
  phs: number[],
  si: number[],
  teamA: number[],
  teamB: number[],
): Record<number, number> {
  const out: Record<number, number> = {}
  for (let h = 0; h < gross.length && h < 18; h++) {
    const row = gross[h]
    if (!row) continue
    const sign = betterBallSign(row, phs, si[h] ?? 18, teamA, teamB)
    if (sign != null) out[h + 1] = sign
  }
  return out
}

export function scoreWolf(gross: GrossCell[][], decisions: Array<WolfCall | null>, phs: number[], si: number[]): number[] {
  const pts = [0, 0, 0, 0]
  for (let h = 0; h < gross.length; h++) {
    const row = gross[h]
    const d = decisions[h]
    if (!row || !d || !holeReady(row)) continue
    const nt: Array<number | 'pickup'> = row.map((cell, p) =>
      cell === 'pickup' ? 'pickup' : (cell as number) - strokesOn(phs[p] ?? 0, si[h] ?? 18),
    )
    if (d.mode === 'partner') {
      const A = [d.wolf, d.partner]
      const B = [0, 1, 2, 3].filter((p) => !A.includes(p))
      const award = cmpSides(sideBest(nt, A), sideBest(nt, B))
      if (award === 'A') for (const p of A) pts[p] = (pts[p] ?? 0) + 2
      else if (award === 'B') for (const p of B) pts[p] = (pts[p] ?? 0) + 3
    } else {
      const mult = d.mode === 'blind' ? 2 : 1
      const B = [0, 1, 2, 3].filter((p) => p !== d.wolf)
      const award = cmpSides(sideBest(nt, [d.wolf]), sideBest(nt, B))
      if (award === 'A') pts[d.wolf] = (pts[d.wolf] ?? 0) + 4 * mult
      else if (award === 'B') for (const p of B) pts[p] = (pts[p] ?? 0) + 1 * mult
    }
  }
  return pts
}

function cmpSides(
  a: { best: number | null; pickup: boolean },
  b: { best: number | null; pickup: boolean },
): 'A' | 'B' | 'tie' {
  if (a.best == null && b.best == null) return 'tie'
  if (a.best == null) return 'B'
  if (b.best == null) return 'A'
  if (a.best < b.best) return 'A'
  if (b.best < a.best) return 'B'
  if (a.pickup && !b.pickup) return 'B'
  if (b.pickup && !a.pickup) return 'A'
  return 'tie'
}

export function wolfOnHole(hole1: number, points: number[], teeOrder: number[]): number {
  const h = hole1 - 1
  if (h < 16) return teeOrder[h % teeOrder.length]!
  let m = Infinity
  for (const p of teeOrder) m = Math.min(m, points[p] ?? 0)
  for (const p of teeOrder) if ((points[p] ?? 0) === m) return p
  return teeOrder[0]!
}

function vegasNumber(a: number, b: number, flip: boolean): number {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return flip ? hi * 10 + lo : lo * 10 + hi
}

function digit(cell: number | 'pickup'): number {
  return cell === 'pickup' ? 9 : Math.min(cell, 9)
}

export function scoreVegas(
  gross: GrossCell[][],
  teamA: number[],
  teamB: number[],
  phs: number[] | null,
  par: number[],
  si: number[],
  flip = true,
  numbersOn: 'net' | 'gross' = 'net',
  birdieOn: 'net' | 'gross' = 'gross',
): number {
  let tot = 0
  for (let h = 0; h < gross.length; h++) {
    const row = gross[h]
    if (!holeReady(row)) continue
    const scored = (p: number, on: 'net' | 'gross'): number => {
      const cell = row[p]!
      if (cell === 'pickup') return 9
      const st = on === 'net' && phs ? strokesOn(phs[p] ?? 0, si[h] ?? 18) : 0
      return Math.min(9, cell - st)
    }
    const birdied = (team: number[]): boolean => {
      let best = Infinity
      let any = false
      for (const p of team) {
        const cell = row[p]!
        if (cell === 'pickup') continue
        any = true
        const st = birdieOn === 'net' && phs ? strokesOn(phs[p] ?? 0, si[h] ?? 18) : 0
        best = Math.min(best, cell - st)
      }
      return any && best <= (par[h] ?? 4) - 1
    }
    const ba = birdied(teamA)
    const bb = birdied(teamB)
    const fa = flip && bb && !ba
    const fb = flip && ba && !bb
    const sa = teamA.map((p) => scored(p, numbersOn))
    const sb = teamB.map((p) => scored(p, numbersOn))
    const na = vegasNumber(sa[0] ?? 9, sa[1] ?? 9, fa)
    const nb = vegasNumber(sb[0] ?? 9, sb[1] ?? 9, fb)
    tot += nb - na
  }
  return tot
}

export function suggestTeams(handicaps: number[]): { teamA: number[]; teamB: number[] } {
  if (handicaps.length === 2) return { teamA: [0], teamB: [1] }
  const order = handicaps.map((ch, i) => ({ ch, i })).sort((a, b) => a.ch - b.ch || a.i - b.i)
  if (order.length === 4) return { teamA: [order[0]!.i, order[3]!.i], teamB: [order[1]!.i, order[2]!.i] }
  return { teamA: order.map((o) => o.i), teamB: [] }
}

export function skinsValue(won: number[], stake: number | null): number[] | null {
  return pointsNet(won, stake)
}

export function wolfValue(pts: number[], stake: number | null): number[] | null {
  return pointsNet(pts, stake)
}

export function stablefordValue(pts: number[], stake: number | null, pot: boolean): number[] | null {
  if (stake == null) return null
  return pot ? potNet(pts, stake) : pointsNet(pts, stake)
}

export function nassauValue(
  results: Record<number, number>,
  teamA: number[],
  teamB: number[],
  n: number,
  values: NassauValues,
  manual: ReadonlySet<number> = new Set(),
): { nets: number[] | null; detail: Record<string, Array<[string, number, number]>> } {
  if (values.front == null && values.back == null && values.total == null) return { nets: null, detail: {} }
  const scored = nassauMoney(results, teamA, teamB, n, values, 2, false, manual)
  return { nets: scored.nets, detail: scored.detail }
}

export function matchValue(
  results: Record<number, number>,
  teamA: number[],
  teamB: number[],
  n: number,
  stake: number | null,
): number[] | null {
  if (stake == null) return null
  const values: NassauValues = { front: null, back: null, total: stake, press: null }
  return nassauMoney(results, teamA, teamB, n, values, null).nets
}

export function pointsNassauValue(pointsByHole: number[][], values: NassauValues): number[] | null {
  if (values.front == null && values.back == null && values.total == null) return null
  const n = pointsByHole[0]?.length ?? 3
  const sumSeg = (s: number, e: number) => {
    const tot = Array<number>(n).fill(0)
    for (let h = s; h <= e; h++) {
      const row = pointsByHole[h - 1]
      if (!row) continue
      row.forEach((p, i) => {
        tot[i] = (tot[i] ?? 0) + p
      })
    }
    return tot
  }
  const out = Array<number>(n).fill(0)
  const segs: Array<['front' | 'back' | 'total', number, number]> = [
    ['front', 1, 9],
    ['back', 10, 18],
    ['total', 1, 18],
  ]
  for (const [seg, s, e] of segs) {
    const v = values[seg]
    if (v == null) continue
    const part = n === 3 ? points3Net(sumSeg(s, e), v) : []
    part.forEach((x, i) => {
      out[i] = (out[i] ?? 0) + x
    })
  }
  return out
}

export function countbackWinner(pointsByHole: number[][]): number[] {
  const n = pointsByHole[0]?.length ?? 0
  const total = Array<number>(n).fill(0)
  for (const row of pointsByHole) row.forEach((p, i) => {
    total[i] = (total[i] ?? 0) + (p ?? 0)
  })
  let live = total.map((p, i) => (p === Math.max(...total) ? i : -1)).filter((i) => i >= 0)
  const windows = [
    [9, 17],
    [12, 17],
    [15, 17],
    [17, 17],
  ] as const
  for (const [s, e] of windows) {
    if (live.length <= 1) break
    const seg = live.map((i) => {
      let t = 0
      for (let h = s; h <= e; h++) t += pointsByHole[h]?.[i] ?? 0
      return t
    })
    const best = Math.max(...seg)
    live = live.filter((_, k) => seg[k] === best)
  }
  return live
}

