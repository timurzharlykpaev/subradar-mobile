import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { DarkTheme, LightTheme, ThemeColors } from './colors';

type ThemeMode = 'dark' | 'light';

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  extraBold: 'Inter-ExtraBold',
} as const;

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  fonts: typeof fonts;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: DarkTheme,
  fonts,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemScheme === 'light' ? 'light' : 'dark');

  // Load saved theme on mount — user preference overrides system
  React.useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setMode(saved);
      } else {
        // No saved preference — follow system
        setMode(systemScheme === 'light' ? 'light' : 'dark');
      }
    });
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem('theme_mode', newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setTheme]);

  // Stabilize the context value: every render of ThemeProvider used to
  // produce a fresh `value` object, which propagated a new identity to
  // every `useTheme()` consumer (DoneAccessoryInput × N inputs, every
  // sheet, every button). With ~60 consumers in the form alone that
  // multiplied per-keystroke render cost; useMemo cuts it to one.
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? DarkTheme : LightTheme,
      fonts,
      isDark: mode === 'dark',
      toggleTheme,
      setTheme,
    }),
    [mode, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
