import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../constants/colors';
import type { ColorTheme } from '../constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

const MODE_KEY = 'theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Fase 1 del plan de modo oscuro: solo el "plumbing" (contexto + persistencia
// del override) -- ninguna pantalla consume `colors` de acá todavía, así que
// esto no cambia nada visualmente. `constants/colors.ts` sigue exportando
// `colors` como alias de `lightColors` para los ~114 archivos que importan
// directo; la migración pantalla por pantalla a `useColors()` es la fase 2+.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      setLoaded(true);
    });
  }, []);

  function setMode(next: ThemeMode) {
    setModeState(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }

  // Antes de leer el storage, asume claro -- evita un parpadeo a oscuro en
  // dispositivos con el sistema en oscuro mientras `loaded` sigue en false.
  const resolvedDark = loaded && (mode === 'dark' || (mode === 'system' && systemScheme === 'dark'));

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: resolvedDark,
      colors: resolvedDark ? darkColors : lightColors,
      setMode,
    }),
    [mode, resolvedDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): ColorTheme {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useColors must be used within ThemeProvider');
  return context.colors;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
