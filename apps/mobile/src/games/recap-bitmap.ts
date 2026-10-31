import { dayLine, DISCLOSURE, fmt, type FoursomeSave, type RoundScore } from '@coopr/games';
import { dayAmount, stablefordLine, wolfPointsTable } from './present';

export interface RecapCardOptions {
  nets: boolean
  handicaps: boolean
}

/**
 * Facts on a finished recap. The live pot line stays on the strip during play.
 * A finished card does not say skins are still on the line.
 */
export function recapCardLines(save: FoursomeSave, score: RoundScore, options: RecapCardOptions): string[] {
  const names = save.players.map((player) => player.name)
  const lines = ['COOPR', dayLine(names, score.nets)]
  const amount = dayAmount(score.nets)
  if (amount) lines.push(amount)
  const stable = score.games.find((game) => game.kind === 'stableford' || game.kind === 'modified')
  const stableLine = stablefordLine(names, stable?.points ?? null)
  if (stableLine) lines.push(stableLine)
  const wolf = score.games.find((game) => game.kind === 'wolf')
  if (wolf?.points) {
    for (const row of wolfPointsTable(names, wolf.points)) lines.push(`Wolf ${row}`)
  }
  if (options.nets) {
    save.players.forEach((player, index) => {
      lines.push(`${player.name} ${fmt(score.nets[index] ?? 0, undefined, true)}`)
    })
  }
  if (options.handicaps) {
    for (const player of save.players) {
      if (player.courseHandicap == null) continue
      lines.push(`${player.name} handicap ${player.courseHandicap}`)
    }
  }
  for (const row of score.settle) lines.push(row.line)
  lines.push(DISCLOSURE)
  return lines
}

export function downloadPng(bytes: Uint8Array, filename: string): boolean {
  const doc = globalThis.document
  if (!doc) return false
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const blob = new Blob([copy], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return true
}
