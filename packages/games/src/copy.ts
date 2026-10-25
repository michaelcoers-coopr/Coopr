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

/**
 * Open questions from LEGAL_NOTES.md section 9. Not decided here.
 * Mike said players are 16+. This build does not add an age gate and does not decide the rating.
 * Not shown in the UI.
 */
export const LAWYER_OPEN = [
  'Is points-only, no-purchase, no-redemption, no-prize tracking outside gambling and money-transmission rules for the intended states and countries?',
  'Does the settle-up language ("owes") or off-app honor-system settling create exposure for COOPR?',
  'App Store 5.3 and age-rating answers; Google Play gambling policy declaration.',
  'Name clearance for Birdie Bucks, Gimmes, and Clubhouse Chips.',
  'Account deletion with an append-only ledger; privacy policy and terms, including user content and minors.',
] as const

/** Online crews, invites, synced leaderboards, and the hustler badge stay out of this build. */
export const DEFERRED_ONLINE = ['crews', 'invites', 'leaderboard-sync', 'hustler-badge'] as const
