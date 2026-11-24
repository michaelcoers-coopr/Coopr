export interface UnitLabel {
  name: string
  abbr: string
}

export const BIRDIE_BUCKS: UnitLabel = { name: 'Birdie Bucks', abbr: 'BB' }

export interface Transfer {
  frm: string | number
  to: string | number
  amount: number
}

export interface NassauBet {
  kind: 'main' | 'press'
  start: number
  up: number
  closed: boolean
  pressed: boolean
}

export interface NassauValues {
  front: number | null
  back: number | null
  total: number | null
  press: number | null
}

/** Hundredths to '30', '2.5', '2.67' with no trailing zeros. */
export function qty(c: number): string {
  const a = Math.abs(c)
  const d = Math.floor(a / 100)
  const r = a % 100
  if (r === 0) return String(d)
  if (r % 10 === 0) return `${d}.${Math.floor(r / 10)}`
  return `${d}.${String(r).padStart(2, '0')}`
}

/** '30 BB'. Minus is U+2212. */
export function fmt(c: number, unit: UnitLabel = BIRDIE_BUCKS, sign = false): string {
  const s = `${qty(c)} ${unit.abbr}`
  if (c < 0) return '\u2212' + s
  return sign && c > 0 ? '+' + s : s
}

export function pointsNet(pts: number[], value: number | null): number[] | null {
  if (value == null) return null
  const n = pts.length
  const t = pts.reduce((s, p) => s + p, 0)
  return pts.map((p) => value * (n * p - t))
}

export function potNet(scores: number[], ante: number | null, teeOrder?: number[], higherIsBetter = true): number[] | null {
  if (ante == null) return null
  const n = scores.length
  const best = higherIsBetter ? Math.max(...scores) : Math.min(...scores)
  const order = teeOrder ?? scores.map((_, i) => i)
  const w = order.filter((i) => scores[i] === best)
  const pot = n * ante
  const share = Math.floor(pot / w.length)
  const rem = pot % w.length
  const out = Array<number>(n).fill(-ante)
  w.forEach((i, k) => {
    out[i] = (out[i] ?? 0) + share + (k < rem ? 1 : 0)
  })
  return out
}

export function teamNet(sign: number, teamA: number[], teamB: number[], n: number, value: number | null): number[] {
  const out = Array<number>(n).fill(0)
  if (sign === 0 || value == null) return out
  const win = sign > 0 ? teamA : teamB
  const lose = sign > 0 ? teamB : teamA
  for (const p of win) out[p] = (out[p] ?? 0) + value
  for (const p of lose) out[p] = (out[p] ?? 0) - value
  return out
}

export function points3Net(segScores: number[], value: number | null): number[] {
  const top = Math.max(...segScores)
  const w = segScores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0)
  if (w.length !== 1 || value == null) return [0, 0, 0]
  const out = [-value, -value, -value]
  out[w[0]!] = 2 * value
  return out
}

export function vegasNet(diff: number, teamA: number[], teamB: number[], n: number, perPoint: number | null): number[] {
  if (perPoint == null) return Array<number>(n).fill(0)
  const sign = (diff > 0 ? 1 : 0) - (diff < 0 ? 1 : 0)
  return teamNet(sign, teamA, teamB, n, Math.abs(diff) * perPoint)
}

export function nassauBets(
  holeResults: Record<number, number>,
  start: number,
  end: number,
  threshold = 2,
  pressOfPress = false,
  manual: ReadonlySet<number> = new Set(),
): NassauBet[] {
  const bets: NassauBet[] = [{ kind: 'main', start, up: 0, closed: false, pressed: false }]
  for (let h = start; h <= end; h++) {
    for (const b of bets) {
      if (b.closed || h < b.start) continue
      b.up += holeResults[h] ?? 0
      if (Math.abs(b.up) > end - h) b.closed = true
    }
    if (h < end) {
      for (const b of [...bets]) {
        if (h < b.start || b.pressed) continue
        if (b.kind !== 'main' && !pressOfPress) continue
        const auto = threshold > 0 && Math.abs(b.up) >= threshold
        const called = manual.has(h)
        if (auto || called) {
          b.pressed = true
          bets.push({ kind: 'press', start: h + 1, up: 0, closed: false, pressed: false })
        }
      }
    }
  }
  return bets
}

export function nassauMoney(
  holeResults: Record<number, number>,
  teamA: number[],
  teamB: number[],
  n: number,
  values: NassauValues,
  threshold: number | null = null,
  pressOfPress = false,
  manual: ReadonlySet<number> = new Set(),
): { nets: number[]; detail: Record<string, Array<[string, number, number]>> } {
  const out = Array<number>(n).fill(0)
  const detail: Record<string, Array<[string, number, number]>> = {}
  const th = threshold && values.press != null ? threshold : 0
  const segs = { front: [1, 9] as [number, number], back: [10, 18] as [number, number], total: [1, 18] as [number, number] }
  for (const seg of ['front', 'back', 'total'] as const) {
    const v = values[seg]
    if (v == null) continue
    const [s, e] = segs[seg]
    const holes = []
    for (let h = s; h <= e; h++) holes.push(h)
    const complete = holes.every((h) => Object.prototype.hasOwnProperty.call(holeResults, h))
    const hr: Record<number, number> = {}
    if (!complete) {
      for (const h of holes) hr[h] = holeResults[h] ?? 0
    } else {
      for (const h of holes) hr[h] = holeResults[h] ?? 0
    }
    const bets = nassauBets(complete ? holeResults : hr, s, e, th, pressOfPress, manual)
    detail[seg] = bets.map((b) => [b.kind, b.start, b.up])
    for (const b of bets) {
      const val = b.kind === 'main' ? v : values.press
      const sgn = (b.up > 0 ? 1 : 0) - (b.up < 0 ? 1 : 0)
      const part = teamNet(sgn, teamA, teamB, n, val)
      part.forEach((x, i) => {
        out[i] = (out[i] ?? 0) + x
      })
    }
  }
  return { nets: out, detail }
}

export function roundWhole(nets: number[], minor = 100): number[] {
  const base = nets.map((x) => Math.floor(x / minor) * minor)
  const rem = nets.map((x, i) => x - base[i]!)
  const up = rem.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i)
  const sumBase = base.reduce((s, x) => s + x, 0)
  const need = Math.floor(-sumBase / minor)
  const out = base.slice()
  const take = need < 0 ? up.slice(0, up.length + need) : up.slice(0, need)
  for (const item of take) out[item.i] = (out[item.i] ?? 0) + minor
  return out
}

export function settle(nets: number[], names?: Array<string | number>): Transfer[] {
  const sum = nets.reduce((s, x) => s + x, 0)
  if (sum !== 0) throw new Error('nets must sum to zero')
  const labels = names ?? nets.map((_, i) => i)
  const idx = nets.map((x, i) => (x !== 0 ? i : -1)).filter((i) => i >= 0)
  const m = idx.length
  if (m === 0) return []
  const full = (1 << m) - 1
  const sums: number[] = []
  for (let mask = 0; mask <= full; mask++) {
    let s = 0
    for (let j = 0; j < m; j++) if ((mask >> j) & 1) s += nets[idx[j]!]!
    sums.push(s)
  }
  const best = new Map<number, [number, number[]]>()
  const groups = (mask: number): [number, number[]] => {
    if (mask === 0) return [0, []]
    const memo = best.get(mask)
    if (memo) return memo
    const low = mask & -mask
    let res: [number, number[]] = [-1, []]
    let sub = mask
    while (sub) {
      if ((sub & low) && sums[sub] === 0) {
        const [g, rest] = groups(mask ^ sub)
        if (g >= 0 && g + 1 > res[0]) res = [g + 1, [sub, ...rest]]
      }
      sub = (sub - 1) & mask
    }
    best.set(mask, res)
    return res
  }
  const [, parts] = groups(full)
  const tx: Transfer[] = []
  for (const mask of parts) {
    const mem = idx.filter((_, j) => (mask >> j) & 1)
    const cred = mem
      .filter((i) => nets[i]! > 0)
      .map((i) => [nets[i]!, i] as [number, number])
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    const debt = mem
      .filter((i) => nets[i]! < 0)
      .map((i) => [-nets[i]!, i] as [number, number])
      .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    let a = 0
    let b = 0
    while (a < debt.length && b < cred.length) {
      const x = Math.min(debt[a]![0], cred[b]![0])
      tx.push({ frm: labels[debt[a]![1]]!, to: labels[cred[b]![1]]!, amount: x })
      debt[a]![0] -= x
      cred[b]![0] -= x
      if (debt[a]![0] === 0) a += 1
      if (cred[b]![0] === 0) b += 1
    }
  }
  return tx
}

export function applyTransfers(nets: number[], tx: Transfer[], names: Array<string | number>): Record<string, number> {
  const bal: Record<string, number> = {}
  names.forEach((name, i) => {
    bal[String(name)] = nets[i] ?? 0
  })
  for (const t of tx) {
    const frm = String(t.frm)
    const to = String(t.to)
    bal[frm] = (bal[frm] ?? 0) + t.amount
    bal[to] = (bal[to] ?? 0) - t.amount
  }
  return bal
}

export function owesLine(from: string, to: string, amount: number, unit: UnitLabel = BIRDIE_BUCKS): string {
  return `${from} owes ${to} ${fmt(amount, unit)}`
}
