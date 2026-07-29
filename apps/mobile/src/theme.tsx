import React, { createContext, useContext } from 'react';
import { makeTheme, cooprAccent, type Theme, type AccentTheme } from '@coopr/tokens';

const ThemeContext = createContext<Theme>(makeTheme(cooprAccent));

export function ThemeProvider({ accent = cooprAccent, children }: { accent?: AccentTheme; children: React.ReactNode }) {
  return <ThemeContext.Provider value={makeTheme(accent)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
