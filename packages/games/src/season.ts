/** On-phone season totals. */

export interface SeasonRound {
  id: string
  players: { id: string; name: string }[]
  nets: number[]
}

export interface SeasonRow {
  id: string
  name: string
  net: number
  rounds: number
  wins: number
}

export function seasonTable(rounds: SeasonRound[]): SeasonRow[] {
  const rows = new Map<string, SeasonRow>()
  for (const round of rounds) {
    const top = Math.max(...round.nets)
    round.players.forEach((p, i) => {
      const row = rows.get(p.id) ?? { id: p.id, name: p.name, net: 0, rounds: 0, wins: 0 }
      row.name = p.name
      row.net += round.nets[i] ?? 0
      row.rounds += 1
      if ((round.nets[i] ?? 0) === top) row.wins += 1
      rows.set(p.id, row)
    })
  }
  return [...rows.values()].sort((a, b) => b.net - a.net || a.name.localeCompare(b.name))
}

export interface Rivalry {
  winsA: number
  winsB: number
  ties: number
  gap: number
  biggest: number
  form: Array<'W' | 'L' | 'T'>
}

export function headToHead(rounds: SeasonRound[], a: string, b: string): Rivalry {
  const out: Rivalry = { winsA: 0, winsB: 0, ties: 0, gap: 0, biggest: 0, form: [] }
  for (const round of rounds) {
    const ia = round.players.findIndex((p) => p.id === a)
    const ib = round.players.findIndex((p) => p.id === b)
    if (ia < 0 || ib < 0) continue
    const na = round.nets[ia] ?? 0
    const nb = round.nets[ib] ?? 0
    const d = na - nb
    out.gap += d
    if (Math.abs(d) > Math.abs(out.biggest)) out.biggest = d
    if (d > 0) {
      out.winsA += 1
      out.form.push('W')
    } else if (d < 0) {
      out.winsB += 1
      out.form.push('L')
    } else {
      out.ties += 1
      out.form.push('T')
    }
  }
  return out
}
