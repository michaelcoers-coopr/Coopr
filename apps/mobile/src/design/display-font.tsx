import { createContext, useContext, type ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { font } from '@coopr/tokens';

/** Loaded family name. Bebas Neue digits share one width, and the face includes tnum. */
export const DISPLAY_FACE = 'BebasNeue';

const DisplayFaceContext = createContext<string>(font.family);

/** Heavy condensed face for headlines and the big numbers. Body copy stays the system face. */
export function DisplayFontProvider({ children }: { children: ReactNode }) {
  const [loaded] = useFonts({ [DISPLAY_FACE]: require('../../assets/fonts/BebasNeue-Regular.ttf') });
  return <DisplayFaceContext.Provider value={loaded ? DISPLAY_FACE : font.family}>{children}</DisplayFaceContext.Provider>;
}

export function useDisplayFace(): string {
  return useContext(DisplayFaceContext);
}
