// Light and dark palettes for the app's chrome, plus the hooks components use to read them.
// Item status colors (STATUS_COLOR) and the blue accent are the same in both.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const KEY = 'paker.theme.v1';

export interface Theme {
  dark: boolean;
  bg: string; // screen background
  card: string; // top bar, item rows, dialogs, active mode button
  pressed: string; // item row while pressed
  selected: string; // selected item row, multi-select bar
  header: string; // category header
  menu: string; // category menu strip
  actions: string; // expanded item actions
  chip: string; // round fold / quantity buttons
  modeBar: string;
  badge: string; // "always" badge background
  text: string;
  muted: string; // secondary text
  faint: string; // hints, placeholders, empty text
  border: string; // input borders, quantity separator
  separator: string; // row hairlines
  backdrop: string;
  accent: string;
  danger: string;
}

export const LIGHT: Theme = {
  dark: false,
  bg: '#F5F6F8',
  card: 'white',
  pressed: '#F2F2F2',
  selected: '#E3EEFC',
  header: '#E8ECF2',
  menu: '#F2F4F8',
  actions: '#FAFAFA',
  chip: '#EEF1F5',
  modeBar: '#E1E5EC',
  badge: '#DCE9FB',
  text: '#111',
  muted: '#666',
  faint: '#888',
  border: '#CCC',
  separator: '#DDD',
  backdrop: 'rgba(0,0,0,0.4)',
  accent: '#2F80ED',
  danger: '#EB5757',
};

export const DARK: Theme = {
  dark: true,
  bg: '#121417',
  card: '#1E2126',
  pressed: '#2A2E34',
  selected: '#1C2E47',
  header: '#272B32',
  menu: '#22262C',
  actions: '#1A1D21',
  chip: '#30353C',
  modeBar: '#2A2E35',
  badge: '#1C2E47',
  text: '#ECEDEF',
  muted: '#A3A8B0',
  faint: '#7C8188',
  border: '#3C4149',
  separator: '#2E3238',
  backdrop: 'rgba(0,0,0,0.6)',
  accent: '#2F80ED',
  danger: '#EB5757',
};

export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: LIGHT, toggle: () => {} });

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** Builds a component's styles from the current theme (StyleSheet.create objects are static, so they are rebuilt when the theme changes). */
export function useStyles<T>(make: (t: Theme) => T): T {
  const t = useTheme();
  return useMemo(() => make(t), [t, make]);
}

/** The stored choice, or the system preference until something is stored. Toggling persists the choice. */
export function useThemePreference(): { theme: Theme; toggle: () => void } {
  const system = useColorScheme();
  const [stored, setStored] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setStored(v);
      })
      .catch((e) => console.warn('Failed to load theme', e));
  }, []);

  const dark = stored ? stored === 'dark' : system === 'dark';
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setStored(next);
    AsyncStorage.setItem(KEY, next).catch((e) => console.warn('Failed to save theme', e));
  };
  return { theme: dark ? DARK : LIGHT, toggle };
}
