/**
 * Dev, Expo Go, and the EAS preview channel leave this unset or set it to 1.
 * `npm run preview:publish` forces 1 for that channel only.
 * The production EAS profile sets EXPO_PUBLIC_FOUNDER_TOOLS=0, and Metro then
 * swaps `@coopr/seed` for a stub that has none of the founder history.
 */
export const FOUNDER_TOOLS_ENABLED = process.env.EXPO_PUBLIC_FOUNDER_TOOLS !== '0';
