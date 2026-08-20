import { create } from 'zustand';

interface PasswordPromptState {
  visible: boolean;
  verifying: boolean;
  error: string | null;
  show: () => Promise<boolean>;
  cancel: () => void;
  setVerifying: (v: boolean) => void;
  setError: (msg: string | null) => void;
  resolve: ((ok: boolean) => void) | null;
}

// A single global password-entry modal (mounted once, like CustomAlert) that
// any part of the app can await for a yes/no "was the account password
// verified" answer — used to gate revealing net worth.
export const usePasswordPrompt = create<PasswordPromptState>((set, get) => ({
  visible: false,
  verifying: false,
  error: null,
  resolve: null,

  show: () =>
    new Promise<boolean>((resolve) => {
      set({ visible: true, error: null, verifying: false, resolve });
    }),

  cancel: () => {
    get().resolve?.(false);
    set({ visible: false, resolve: null, error: null, verifying: false });
  },

  setVerifying: (v) => set({ verifying: v }),
  setError: (msg) => set({ error: msg }),
}));

/** Called by the modal itself once Firebase confirms/rejects the password. */
export function resolvePasswordPrompt(ok: boolean) {
  usePasswordPrompt.getState().resolve?.(ok);
  usePasswordPrompt.setState({ visible: false, resolve: null, error: null, verifying: false });
}
