/**
 * Dev and founder builds leave this unset or set it to 1.
 * A public or store build sets EXPO_PUBLIC_FOUNDER_TOOLS=0, and Metro then
 * swaps `@coopr/seed` for a stub that has none of the founder history.
 */
export const FOUNDER_TOOLS_ENABLED = process.env.EXPO_PUBLIC_FOUNDER_TOOLS !== '0';
