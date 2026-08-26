// Zustand store wrapping the pure ledger.ts reducer, persisted to Firestore
// (ledgers/{uid}) instead of AsyncStorage — this is what makes the ledger
// shared across a user's devices rather than local to one install. The
// ledger.ts functions themselves are unaffected; only the `storage` below
// changed, plus the live-sync wiring at the bottom of this file.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { firestoreLedgerStorage, subscribeLedgerToFirestore } from './firestoreLedgerStorage';
import { getAssetByName, getNetWorth, handleTransaction, LedgerError } from './ledger';
import {
  Asset,
  BuyAssetPayload,
  EMPTY_LEDGER_STATE,
  ExpensePayload,
  IncomePayload,
  LedgerOptions,
  LedgerState,
  RevalueAssetPayload,
  SellAssetPayload,
} from './types';

interface LedgerStore extends LedgerState {
  options: LedgerOptions;
  setOptions: (options: LedgerOptions) => void;
  // Each action mirrors handleTransaction, applying the returned state and
  // re-throwing LedgerError (e.g. "insufficient cash") so callers can show
  // it as a form error rather than silently no-op'ing.
  buyAsset: (payload: BuyAssetPayload) => void;
  sellAsset: (payload: SellAssetPayload) => void;
  income: (payload: IncomePayload) => void;
  expense: (payload: ExpensePayload) => void;
  revalueAsset: (payload: RevalueAssetPayload) => void;
  reset: () => void;
}

export const useLedger = create<LedgerStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_LEDGER_STATE,
      options: {},

      setOptions: (options) => set({ options }),

      buyAsset: (payload) => {
        const { options, ...state } = get();
        set(handleTransaction(state, 'BUY_ASSET', payload, options));
      },
      sellAsset: (payload) => {
        const { options, ...state } = get();
        set(handleTransaction(state, 'SELL_ASSET', payload, options));
      },
      income: (payload) => {
        const { options, ...state } = get();
        set(handleTransaction(state, 'INCOME', payload, options));
      },
      expense: (payload) => {
        const { options, ...state } = get();
        set(handleTransaction(state, 'EXPENSE', payload, options));
      },
      revalueAsset: (payload) => {
        const { options, ...state } = get();
        set(handleTransaction(state, 'REVALUE_ASSET', payload, options));
      },
      reset: () => set({ ...EMPTY_LEDGER_STATE }),
    }),
    {
      name: 'cashleak-ledger',
      storage: createJSONStorage(() => firestoreLedgerStorage),
      partialize: ({ cash, assets, transactions }) => ({ cash, assets, transactions }),
      // No uid at store-creation time (auth may not have resolved yet) —
      // don't attempt a read/write until initLedgerFirestoreSync() below
      // has fired at least once for a signed-in user.
      skipHydration: true,
    },
  ),
);

/**
 * Wires the ledger store to ledgers/{uid} in Firestore: re-hydrates on
 * sign-in/sign-out and keeps it live-synced across devices via onSnapshot.
 * Call once — e.g. alongside the existing onAuthStateChanged listener in
 * src/navigation/drawer/drawer.tsx — passing the new uid (or null on
 * sign-out). Returns an unsubscribe function to call before switching users
 * again or on unmount.
 */
export function initLedgerFirestoreSync(uid: string | null): () => void {
  if (!uid) {
    useLedger.setState({ ...EMPTY_LEDGER_STATE });
    return () => {};
  }

  // Reflects the user's own writes back in too, but that's a no-op diff
  // against what's already in the store, so it doesn't loop.
  return subscribeLedgerToFirestore(uid, (raw) => {
    if (!raw) {
      useLedger.setState({ ...EMPTY_LEDGER_STATE });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<LedgerState>;
      useLedger.setState({
        cash: parsed.cash ?? 0,
        assets: parsed.assets ?? [],
        transactions: parsed.transactions ?? [],
      });
    } catch {
      // Malformed doc — leave the store as-is rather than wiping it out.
    }
  });
}

/** Derived net worth for the current store state — re-renders whenever cash/assets change. */
export function useNetWorth(): number {
  return useLedger((s) => getNetWorth(s));
}

export function useAssetByName(name: string): Asset | undefined {
  return useLedger((s) => getAssetByName(s, name));
}

export { LedgerError };
