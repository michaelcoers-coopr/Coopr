/** difflib.SequenceMatcher ratio. Junk is off for short strings (n < 200), matching Python's default. */

function chainB(b: string): Map<string, number[]> {
  const b2j = new Map<string, number[]>()
  for (let i = 0; i < b.length; i++) {
    const elt = b[i]!
    const indices = b2j.get(elt)
    if (indices) indices.push(i)
    else b2j.set(elt, [i])
  }
  if (b.length >= 200) {
    const ntest = Math.floor(b.length / 100) + 1
    for (const [elt, idxs] of b2j) {
      if (idxs.length > ntest) b2j.delete(elt)
    }
  }
  return b2j
}

function findLongestMatch(
  a: string,
  b: string,
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): [number, number, number] {
  let besti = alo
  let bestj = blo
  let bestsize = 0
  let j2len = new Map<number, number>()
  for (let i = alo; i < ahi; i++) {
    const newj2len = new Map<number, number>()
    const js = b2j.get(a[i]!) ?? []
    for (const j of js) {
      if (j < blo) continue
      if (j >= bhi) break
      const k = (j2len.get(j - 1) ?? 0) + 1
      newj2len.set(j, k)
      if (k > bestsize) {
        besti = i - k + 1
        bestj = j - k + 1
        bestsize = k
      }
    }
    j2len = newj2len
  }
  while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
    besti -= 1
    bestj -= 1
    bestsize += 1
  }
  while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
    bestsize += 1
  }
  return [besti, bestj, bestsize]
}

function matchingBlocks(a: string, b: string): Array<[number, number, number]> {
  const b2j = chainB(b)
  const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]]
  const blocks: Array<[number, number, number]> = []
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!
    const [i, j, k] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi)
    if (k) {
      blocks.push([i, j, k])
      if (alo < i && blo < j) queue.push([alo, i, blo, j])
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi])
    }
  }
  blocks.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2])
  const nonAdjacent: Array<[number, number, number]> = []
  let i1 = 0
  let j1 = 0
  let k1 = 0
  for (const [i2, j2, k2] of blocks) {
    if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2
    else {
      if (k1) nonAdjacent.push([i1, j1, k1])
      i1 = i2
      j1 = j2
      k1 = k2
    }
  }
  if (k1) nonAdjacent.push([i1, j1, k1])
  nonAdjacent.push([a.length, b.length, 0])
  return nonAdjacent
}

export function sequenceRatio(a: string, b: string): number {
  const matches = matchingBlocks(a, b).reduce((sum, block) => sum + block[2], 0)
  const length = a.length + b.length
  return length ? (2 * matches) / length : 1
}

/** Python 3 round: half to even, otherwise the nearest value. */
export function pyRound(n: number, digits: number): number {
  const p = 10 ** digits
  const x = n * p
  const floor = Math.floor(x)
  const frac = x - floor
  if (Math.abs(frac - 0.5) < 1e-9) {
    const even = floor % 2 === 0 ? floor : floor + 1
    return even / p
  }
  return Math.round(x) / p
}
