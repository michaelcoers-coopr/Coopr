/** User-facing lines. LEGAL_NOTES.md section 2 keeps these words out of UI copy. */
export const DISCLOSURE = "Birdie Bucks are game points with no real-world value. They can't be bought, sold or redeemed."
export const FOOTER = 'Side-game scorekeeping. COOPR counts, nothing changes hands in the app.'
export const SI_AMBER = 'No stroke index for this course. Add the 18 numbers, or go gross-only.'
export const ZERO_SUM_FAIL = "can't total this round"

export function handicapPrompt(name: string): string {
  return `Enter ${name}'s course handicap, or play him scratch (0).`
}

export const BANNED_WORD = /\b(money|cash|dollars|bet|wager|gambling)\b|[$€£¥]/i

export function userFacingCopy(): string[] {
  return [DISCLOSURE, FOOTER, SI_AMBER, ZERO_SUM_FAIL, handicapPrompt('Dave')]
}
