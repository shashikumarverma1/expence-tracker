import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppColors, darkColors, lightColors } from '../utils';


type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  colors: AppColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const systemTheme =  Appearance.getColorScheme() ?? 'light';

export const useTheme = create<ThemeState>((set) => ({
  mode: systemTheme,
  colors: systemTheme == 'dark' ? darkColors : lightColors,

 toggleTheme: () =>
  set((state) => {
    const next: ThemeMode = state.mode === 'light' ? 'dark' : 'light';
    AsyncStorage.setItem('appTheme', next);
    return {
      mode: next,
      colors: next === 'dark' ? darkColors : lightColors, // ✅ fixed
    };
  }),

  setTheme: (mode) => {
    AsyncStorage.setItem('appTheme', mode);
    set({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
    });
  },
}));

// Call this on app start to load saved theme
export const loadSavedTheme = async () => {
  const saved = await AsyncStorage.getItem('appTheme') as ThemeMode | null;
  if (saved) useTheme.getState().setTheme(saved);
};