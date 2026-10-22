/**
 * Navy, white, and crest red. One ice accent is reserved for a live number.
 * There is no green fill. The Navy Fill crest is the supplied raster. It is not redrawn.
 * Menus use the light palette. The hole screen uses the play palette.
 */
export const TAGLINE = "The smartest caddie you'll ever carry";

export const colors = {
  bg: '#F7F5F2',
  text: '#0B1F3A',
  accent: '#0B1F3A',
  onAccent: '#FFFFFF',
  muted: '#3D4C60',
  card: '#FFFFFF',
  line: '#E4E1DC',
  danger: '#C8102E',
  navy: '#0B1F3A',
  white: '#FFFFFF',
  red: '#C8102E',
} as const;

/** Near-black play field. The ice accent is the live yardage only. */
export const play = {
  bg: '#070B10',
  sheet: '#10161E',
  card: '#171E28',
  ink: '#F4F7FB',
  muted: '#9AA6B5',
  line: 'rgba(255,255,255,0.14)',
  glass: 'rgba(7,11,16,0.62)',
  live: '#5CE1FF',
  shadow: 'rgba(0,0,0,0.45)',
} as const;

export const space = {
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
  7: 56,
} as const;

export const radius = {
  chip: 999,
  card: 24,
  control: 16,
  sheet: 28,
} as const;

export const type = {
  hero: 72,
  title: 34,
  club: 32,
  body: 17,
  caption: 13,
  micro: 11,
} as const;

export const touch = 56;

export const font = {
  family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
} as const;

export const motion = {
  springFriction: 7,
  springTension: 80,
  rollFrames: 10,
} as const;
