/** Line-icon names for the five landing results. Drawn in the app, not a second set of words. */
export const RESULT_ICONS = {
  fairway: 'flag',
  left: 'left',
  right: 'right',
  short: 'down',
  hazard: 'hazard',
} as const;

export type ResultIcon = (typeof RESULT_ICONS)[keyof typeof RESULT_ICONS];
