/**
 * One glass recipe for Home and the hole.
 * Blur, tint, border, and shadow live here so the screens do not invent their own.
 */
export const glassTheme = {
  blur: 64,
  tint: 'dark' as const,
  overlay: 'rgba(11,31,58,0.84)',
  border: 'rgba(255,255,255,0.42)',
  shadow: '#000000',
  shadowOpacity: 0.36,
  shadowRadius: 18,
  shadowOffsetY: 10,
  sheen: 0.22,
} as const;
