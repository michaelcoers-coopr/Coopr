/**
 * One glass recipe for Home and the hole.
 * Blur, tint, border, and shadow live here so the screens do not invent their own.
 */
export const glassTheme = {
  blur: 64,
  tint: 'dark' as const,
  overlay: 'rgba(4,10,24,0.9)',
  border: 'rgba(255,255,255,0.62)',
  shadow: '#000000',
  shadowOpacity: 0.46,
  shadowRadius: 18,
  shadowOffsetY: 10,
  sheen: 0.28,
  /** White and black specks over the glass. Low enough that type stays readable. */
  grain: 0.22,
} as const;

/** Field behind the map and Home. Deeper than the navy token, same family. */
export const fieldNavy = '#06101C';
