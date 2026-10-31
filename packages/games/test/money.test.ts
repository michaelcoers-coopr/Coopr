import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import {
  applyTransfers,
  fmt,
  holeResults,
  nassauMoney,
  points3Net,
  pointsNet,
  potNet,
  roundWhole,
  scoreSkins,
  scoreVegas,
  scoreWolf,
  settle,
  stablefordTotals,
  vegasNet,
  type WolfCall,
} from '../src/index'

const PAR = [5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4]
const SI = [7, 11, 17, 1, 13, 3, 15, 5, 9, 8, 4, 18, 2, 12, 16, 6, 10, 14]
const GROSS = [
  [5, 4, 6, 7], [3, 4, 6, 5], [3, 4, 5, 3], [5, 3, 6, 5], [5, 4, 3, 4], [6, 5, 8, 7],
  [5, 3, 3, 4], [4, 6, 6, 5], [5, 4, 4, 5], [5, 3, 6, 3], [7, 7, 7, 6], [3, 4, 5, 4],
  [4, 5, 3, 4], [3, 4, 3, 3], [4, 2, 4, 5], [5, 6, 5, 7], [4, 4, 4, 3], [5, 5, 4, 4],
]
const LOW = [5, 0, 9, 13]
const FULL = [14, 9, 18, 22]
const partner = (wolf: number, mate: number): WolfCall => ({ mode: 'partner', wolf, partner: mate })
const WOLF: WolfCall[] = [
  partner(0, 1), partner(1, 0), partner(2, 0), partner(3, 1), partner(0, 2), partner(1, 0), partner(2, 1), partner(3, 0),
  { mode: 'lone', wolf: 0 },
  partner(1, 3), partner(2, 3), partner(3, 0), partner(0, 2),
  { mode: 'blind', wolf: 1 },
  partner(2, 1), partner(3, 2), partner(2, 3), partner(0, 2),
]

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randint(next: () => number, lo: number, hi: number): number {
  return lo + Math.floor(next() * (hi - lo + 1))
}

function combinations(arr: number[], k: number): number[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [head, ...tail] = arr
  return [...combinations(tail, k - 1).map((c) => [head!, ...c]), ...combinations(tail, k)]
}

function maxGroups(vals: number[]): number {
  let best = 0
  const rec = (rem: number[], cnt: number) => {
    if (rem.length === 0) {
      best = Math.max(best, cnt)
      return
    }
    const first = rem[0]!
    const rest = rem.slice(1)
    for (let r = 1; r <= rem.length; r++) {
      for (const comb of combinations(rest, r - 1)) {
        const grp = [first, ...comb]
        if (grp.reduce((s, i) => s + vals[i]!, 0) === 0) rec(rem.filter((x) => !grp.includes(x)), cnt + 1)
      }
    }
  }
  rec(vals.map((_, i) => i), 0)
  return best
}

describe('stakes', () => {
  test('sample round nets and settle-up', () => {
    const skins = pointsNet(scoreSkins(GROSS, LOW, SI).won, 500)
    const wolf = pointsNet(scoreWolf(GROSS, WOLF, LOW, SI), 100)
    const points = stablefordTotals(GROSS, FULL, PAR, SI, false)
    const stable = potNet(points, 1000)
    const nassau = nassauMoney(holeResults(GROSS, LOW, SI, [0, 3], [1, 2]), [0, 3], [1, 2], 4, {
      front: 2000, back: 2000, total: 2000, press: null,
    }, 2).nets
    assert.deepEqual(points, [41, 40, 38, 46])
    assert.deepEqual(skins, [3500, -500, -2500, -500])
    assert.deepEqual(wolf, [-500, -100, -100, 700])
    assert.deepEqual(stable, [-1000, -1000, -1000, 3000])
    assert.deepEqual(nassau, [2000, -2000, -2000, 2000])
    const total = [0, 1, 2, 3].map((i) => (skins![i] ?? 0) + (nassau[i] ?? 0) + (wolf![i] ?? 0) + (stable![i] ?? 0))
    assert.deepEqual(total, [4000, -3600, -5600, 5200])
    assert.equal(total.reduce((s, n) => s + n, 0), 0)
    const names = ['Mike', 'Dave', 'Tony', 'Josh']
    const tx = settle(total, names)
    const bal = applyTransfers(total, tx, names)
    assert.deepEqual(Object.values(bal), [0, 0, 0, 0])
    assert.deepEqual(
      tx.map((t) => [t.frm, t.to, t.amount]).sort(),
      [['Tony', 'Josh', 5200], ['Dave', 'Mike', 3600], ['Tony', 'Mike', 400]].sort(),
    )
    assert.equal('Dave owes Tony ' + fmt(3000), 'Dave owes Tony 30 BB')
  })

  test('skins carry, pots, nassau presses, vegas, rounding, and copy', () => {
    const carried = scoreSkins([[4, 5, 5, 6], [5, 5, 5, 5], [5, 5, 5, 5], [3, 5, 5, 5]], [0, 0, 0, 0], SI)
    assert.equal(carried.won[0], 4)
    assert.equal(carried.pending, 1)
    assert.deepEqual(pointsNet(carried.won, 100), [1200, -400, -400, -400])
    assert.deepEqual(potNet([40, 40, 30, 20], 200), [200, 200, -200, -200])
    assert.deepEqual(potNet([40, 40, 40, 20], 200), [67, 67, 66, -200])
    assert.deepEqual(pointsNet([14, 15, 15, 17], 100), [-500, -100, -100, 700])
    assert.equal(pointsNet([1, 2, 3, 4], null), null)
    assert.equal(potNet([1, 2], null), null)
    const halved: Record<number, number> = {}
    for (let h = 1; h <= 18; h++) halved[h] = 0
    assert.deepEqual(nassauMoney(halved, [0, 3], [1, 2], 4, { front: 200, back: 200, total: 200, press: null }).nets, [0, 0, 0, 0])
    const front: Record<number, number> = {}
    for (let h = 1; h <= 18; h++) front[h] = h <= 9 ? 1 : 0
    assert.deepEqual(nassauMoney(front, [0, 3], [1, 2], 4, { front: 200, back: 200, total: 200, press: null }).nets, [400, -400, -400, 400])
    const pressed: Record<number, number> = {}
    for (let h = 1; h <= 18; h++) pressed[h] = 0
    pressed[1] = -1
    pressed[2] = -1
    pressed[3] = 1
    pressed[4] = 1
    const withPress = nassauMoney(pressed, [0, 3], [1, 2], 4, { front: 200, back: 200, total: 200, press: 100 }, 2)
    assert.ok(withPress.detail.front?.some((row) => row[0] === 'press' && row[1] === 3 && row[2] === 2))
    const noPress = nassauMoney(pressed, [0, 3], [1, 2], 4, { front: 200, back: 200, total: 200, press: null }, 2)
    assert.ok(noPress.detail.front?.every((row) => row[0] === 'main'))
    assert.equal(withPress.nets.reduce((s, n) => s + n, 0), 0)
    assert.equal(noPress.nets.reduce((s, n) => s + n, 0), 0)
    assert.deepEqual(points3Net([20, 18, 15], 100), [200, -100, -100])
    assert.deepEqual(points3Net([20, 20, 15], 100), [0, 0, 0])
    assert.deepEqual(vegasNet(-18, [0, 1], [2, 3], 4, 100), [-1800, -1800, 1800, 1800])
    const oneHole = scoreVegas([[4, 5, 3, 6]], [0, 1], [2, 3], [0, 0, 0, 0], [4], [1], true, 'net', 'gross')
    assert.equal(oneHole, -18)
    const whole = roundWhole([267, 267, -534])
    assert.equal(whole.reduce((s, n) => s + n, 0), 0)
    assert.ok(whole.every((n) => n % 100 === 0))
    const rem = roundWhole([150, -50, -100])
    assert.equal(rem.reduce((s, n) => s + n, 0), 0)
    assert.ok(rem.every((n) => n % 100 === 0))
    assert.equal(fmt(3000), '30 BB')
    assert.equal(fmt(250), '2.5 BB')
    assert.equal(fmt(-1000), '\u221210 BB')
    assert.equal(fmt(100, undefined, true), '+1 BB')
    assert.equal(fmt(300, { name: 'Gimmes', abbr: 'GM' }), '3 GM')
  })

  test('3000 random ledgers settle in the minimum number of transfers', () => {
    const next = mulberry(5)
    for (let i = 0; i < 3000; i++) {
      const n = randint(next, 2, 4)
      const x = Array.from({ length: n - 1 }, () => randint(next, -30, 30) * 100)
      x.push(-x.reduce((s, v) => s + v, 0))
      const names = x.map((_, p) => `P${p}`)
      const tx = settle(x, names)
      const bal = applyTransfers(x, tx, names)
      const nz = x.filter((v) => v !== 0)
      const exp = nz.length ? nz.length - maxGroups(nz) : 0
      assert.ok(Object.values(bal).every((v) => v === 0))
      assert.equal(tx.length, exp)
      assert.ok(tx.length <= n - 1)
      assert.ok(tx.every((t) => t.amount > 0))
    }
    assert.equal(settle([300, -300, 500, -500], ['A', 'B', 'C', 'D']).length, 2)
    assert.deepEqual(settle([0, 0, 0, 0]), [])
  })

  test('whole-unit rounding stays zero-sum and within one unit', () => {
    const next = mulberry(9)
    for (let i = 0; i < 500; i++) {
      const x = Array.from({ length: 3 }, () => randint(next, -5000, 5000))
      x.push(-x.reduce((s, v) => s + v, 0))
      const rounded = roundWhole(x)
      assert.equal(rounded.reduce((s, v) => s + v, 0), 0)
      assert.ok(rounded.every((v) => v % 100 === 0))
      assert.ok(rounded.every((v, p) => Math.abs(v - x[p]!) < 100))
    }
  })
})
