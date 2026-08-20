import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../config/firebase';
import { usePasswordPrompt } from './usePasswordPrompt';

const STORAGE_KEY = 'balance_hidden';

interface BalanceVisibilityState {
  hidden: boolean;
  show: () => void;
  hide: () => void;
}

// Net worth is hidden by default (privacy-first). Revealing it requires
// re-entering the account password (see revealNetWorth below) — hiding it
// back never does, that's always safe.
export const useBalanceVisibility = create<BalanceVisibilityState>((set) => ({
  hidden: true,

  show: () => {
    AsyncStorage.setItem(STORAGE_KEY, '0');
    set({ hidden: false });
  },

  hide: () => {
    AsyncStorage.setItem(STORAGE_KEY, '1');
    set({ hidden: true });
  },
}));

// Call this once on app start to restore whatever the user last chose.
export const loadSavedBalanceVisibility = async () => {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved != null) useBalanceVisibility.setState({ hidden: saved === '1' });
};

/**
 * The eye-icon tap handler every screen should call. Hiding is instant and
 * needs no check. Revealing requires the account's login password — unless
 * the account has no password at all (Google-only sign-in), in which case
 * there's nothing to verify against, so it just reveals.
 */
export async function revealNetWorth() {
  const { hidden, show, hide } = useBalanceVisibility.getState();

  if (!hidden) {
    hide();
    return;
  }

  const hasPasswordProvider = auth.currentUser?.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    show();
    return;
  }

  const verified = await usePasswordPrompt.getState().show();
  if (verified) show();
}
