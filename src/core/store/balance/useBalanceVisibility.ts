import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'balance_hidden';

interface BalanceVisibilityState {
  hidden: boolean;
  toggle: () => void;
}

// Net worth is hidden by default (privacy-first) — a tap on the eye icon
// reveals it, same pattern as most banking apps.
export const useBalanceVisibility = create<BalanceVisibilityState>((set) => ({
  hidden: true,

  toggle: () =>
    set((state) => {
      const next = !state.hidden;
      AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return { hidden: next };
    }),
}));

// Call this once on app start to restore whatever the user last chose.
export const loadSavedBalanceVisibility = async () => {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved != null) useBalanceVisibility.setState({ hidden: saved === '1' });
};
