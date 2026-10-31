import { loadHighCedarsPilot } from '@coopr/course';
import { strokeIndexValid } from '@coopr/games';

export interface GamesHole {
  par: number
  strokeIndex: number
  yards: number | null
}

/** Beta 1 is High Cedars. The stroke index is the card's, never the hole number. */
export function highCedarsHoles(): { holes: GamesHole[]; siOk: boolean; yards: Array<number | null> } {
  const holes = loadHighCedarsPilot().record.scorecard.slice(0, 18).map((hole) => ({
    par: hole.par ?? 0,
    strokeIndex: hole.strokeIndex ?? 0,
    yards: hole.yardagesByTee.white ?? null,
  }))
  return {
    holes,
    siOk: strokeIndexValid(holes.map((hole) => hole.strokeIndex)),
    yards: holes.map((hole) => hole.yards),
  }
}
