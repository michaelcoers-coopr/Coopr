import React, { createContext, useContext } from 'react';
import { makeTheme, wireframeAccent, type Theme, type AccentTheme } from '@coopr/tokens';

const ThemeContext = createContext<Theme>(makeTheme(wireframeAccent));

export function ThemeProvider({ accent = wireframeAccent, children }: { accent?: AccentTheme; children: React.ReactNode }) {
  return <ThemeContext.Provider value={makeTheme(accent)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
