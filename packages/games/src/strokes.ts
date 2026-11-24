/** Strokes received on a hole. Plus handicaps give strokes back on the easiest holes. */
export function strokesOn(ch: number, si: number, n = 18): number {
  if (ch >= 0) return Math.floor(ch / n) + (si <= ch % n ? 1 : 0)
  const p = -ch
  return -(Math.floor(p / n) + (si > n - (p % n) ? 1 : 0))
}

export function playingHandicaps(chs: number[], mode: 'full' | 'low' = 'low'): number[] {
  if (mode === 'full') return chs.slice()
  const m = Math.min(...chs)
  return chs.map((c) => c - m)
}

export function strokeIndexValid(indexes: Array<number | null | undefined>): boolean {
  if (indexes.length !== 18) return false
  const seen = new Set<number>()
  for (const si of indexes) {
    if (si == null || !Number.isInteger(si) || si < 1 || si > 18 || seen.has(si)) return false
    seen.add(si)
  }
  return seen.size === 18
}

/** Empty text is "not entered". At most two decimal places. No symbols. */
export function parseStake(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2))
}
