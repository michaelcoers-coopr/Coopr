// Design tokens. NEUTRAL WIREFRAME until the founder brand system is approved
// (spec sections 62-64). Two rules the app must never break:
//   1. The accent is a single swappable token — never hardcode a brand color in
//      feature code. Read `tokens.accent`.
//   2. Semantic colors (danger/warning/success, hazard, over/under par) are
//      INDEPENDENT of the accent and can never be overridden by a user's accent
//      (spec section 60).

export interface AccentTheme {
  accent: string;
  accentOn: string; // text/icon color on top of accent
}

// Placeholder accent. The default launch color (~#8AC926) and any personal colorway
// are supplied later via this same shape — feature code does not change.
export const wireframeAccent: AccentTheme = {
  accent: '#5B6670', // neutral slate placeholder, NOT a brand value
  accentOn: '#FFFFFF',
};

// Permanent core neutrals (the one part of the palette the spec fixes).
export const neutrals = {
  ink: '#0B0D0F',
  surface: '#141518',
  surfaceRaised: '#1E2024',
  border: '#2A2D32',
  textPrimary: '#F5F6F7',
  textSecondary: '#A7ADB4',
  textMuted: '#6C727A',
  white: '#FFFFFF',
} as const;

// Semantic colors — independent, accessibility-safe, never accent-driven.
export const semantic = {
  danger: '#E5484D',
  warning: '#F1A10D',
  success: '#30A46C',
  hazardWater: '#3B82F6',
  hazardSand: '#D9A441',
  overPar: '#E5484D',
  underPar: '#30A46C',
  even: '#A7ADB4',
} as const;

// Risk levels map to semantic colors, not the accent.
export const riskColor = {
  low: semantic.success,
  moderate: semantic.warning,
  elevated: '#F1750D',
  high: semantic.danger,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 40 } as const;

export function makeTheme(accent: AccentTheme = wireframeAccent) {
  return { ...accent, ...neutrals, semantic, riskColor, spacing, radius, fontSize };
}

export type Theme = ReturnType<typeof makeTheme>;
