// Pure ledger reducer. Every function here is side-effect-free: given a
// state and a transaction, it returns a brand-new state (or throws on
// invalid input) — nothing is mutated in place, so callers (a zustand store,
// a React reducer, a test) can diff/undo/replay freely.
//
// ── The core invariant ──────────────────────────────────────────
// Net Worth = Cash + Σ(active asset values)
//
// Net worth may ONLY move on INCOME (+amount) or EXPENSE (-amount) — money
// crossing the system's boundary. BUY_ASSET and SELL_ASSET only move value
// between cash and a holding (an internal transfer) and must net to zero.
// REVALUE_ASSET is the one exception that touches an asset's value without
// any cash moving — a real gain/loss (e.g. a stock's price changed), so net
// worth moves by exactly the revaluation delta.
import {
  Asset,
  AssetType,
  BuyAssetPayload,
  EMPTY_LEDGER_STATE,
  ExpensePayload,
  IncomePayload,
  LedgerOptions,
  LedgerState,
  LedgerTransaction,
  LedgerTransactionType,
  RevalueAssetPayload,
  SellAssetPayload,
} from './types';

export class LedgerError extends Error {}

function newId(): string {
  // React Native's Hermes doesn't guarantee crypto.randomUUID; this is only
  // used for local ids, not anything security-sensitive.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function assertPositiveAmount(amount: number, label = 'amount'): void {
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    throw new LedgerError(`${label} must be a positive number, got ${amount}`);
  }
}

/** Case-insensitive lookup by name — the one place "does this asset already exist" is decided. */
export function getAssetByName(state: LedgerState, name: string): Asset | undefined {
  const needle = name.trim().toLowerCase();
  return state.assets.find((a) => a.name.trim().toLowerCase() === needle);
}

/** Cash + every *active* asset's value. Inactive (fully sold) assets are excluded. */
export function getNetWorth(state: LedgerState): number {
  return state.assets.reduce((sum, a) => sum + (a.isActive ? a.value : 0), state.cash);
}

function pushTransaction(
  state: LedgerState,
  type: LedgerTransactionType,
  fields: Partial<Omit<LedgerTransaction, 'id' | 'type' | 'timestamp'>>,
): LedgerTransaction[] {
  const tx: LedgerTransaction = {
    id: newId(),
    type,
    assetId: fields.assetId ?? null,
    amount: fields.amount ?? 0,
    category: fields.category ?? null,
    timestamp: Date.now(),
    note: fields.note,
  };
  return [...state.transactions, tx];
}

function buyAsset(state: LedgerState, payload: BuyAssetPayload, options: LedgerOptions): LedgerState {
  const { assetName, assetType, amount, note } = payload;
  assertPositiveAmount(amount);
  if (!options.allowNegativeCash && amount > state.cash) {
    throw new LedgerError(
      `Insufficient cash: have ${state.cash}, tried to spend ${amount} on "${assetName}"`,
    );
  }

  const now = Date.now();
  const existing = getAssetByName(state, assetName);
  let assets: Asset[];
  let assetId: string;

  if (existing) {
    // Reuse the same holding even if it was previously fully sold
    // (isActive: false) — buying back into it reactivates it rather than
    // creating a second entry with the same name.
    assetId = existing.id;
    assets = state.assets.map((a) =>
      a.id === existing.id
        ? { ...a, value: a.value + amount, isActive: true, updatedAt: now }
        : a,
    );
  } else {
    const created: Asset = {
      id: newId(),
      name: assetName,
      type: assetType,
      value: amount,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    assetId = created.id;
    assets = [...state.assets, created];
  }

  return {
    cash: state.cash - amount,
    assets,
    transactions: pushTransaction(state, 'BUY_ASSET', { assetId, amount, note }),
  };
}

function sellAsset(state: LedgerState, payload: SellAssetPayload): LedgerState {
  const { assetName, amount, note } = payload;
  assertPositiveAmount(amount);

  const existing = getAssetByName(state, assetName);
  if (!existing || !existing.isActive || existing.value <= 0) {
    throw new LedgerError(`No active holding named "${assetName}" to sell`);
  }
  if (amount > existing.value) {
    throw new LedgerError(
      `Cannot sell ${amount} of "${assetName}" — only ${existing.value} held`,
    );
  }

  const now = Date.now();
  const remaining = existing.value - amount;
  const assets = state.assets.map((a) =>
    a.id === existing.id
      ? { ...a, value: remaining, isActive: remaining > 0, updatedAt: now }
      : a,
  );

  return {
    cash: state.cash + amount,
    assets,
    transactions: pushTransaction(state, 'SELL_ASSET', { assetId: existing.id, amount, note }),
  };
}

function income(state: LedgerState, payload: IncomePayload): LedgerState {
  assertPositiveAmount(payload.amount);
  return {
    ...state,
    cash: state.cash + payload.amount,
    transactions: pushTransaction(state, 'INCOME', {
      amount: payload.amount, category: payload.category, note: payload.note,
    }),
  };
}

function expense(state: LedgerState, payload: ExpensePayload, options: LedgerOptions): LedgerState {
  assertPositiveAmount(payload.amount);
  if (!options.allowNegativeCash && payload.amount > state.cash) {
    throw new LedgerError(`Insufficient cash: have ${state.cash}, tried to spend ${payload.amount}`);
  }
  return {
    ...state,
    cash: state.cash - payload.amount,
    transactions: pushTransaction(state, 'EXPENSE', {
      amount: payload.amount, category: payload.category, note: payload.note,
    }),
  };
}

function revalueAsset(state: LedgerState, payload: RevalueAssetPayload): LedgerState {
  const { assetName, newValue, delta, note } = payload;
  const existing = getAssetByName(state, assetName);
  if (!existing) throw new LedgerError(`No holding named "${assetName}" to revalue`);

  const hasNewValue = typeof newValue === 'number';
  const hasDelta = typeof delta === 'number';
  if (hasNewValue === hasDelta) {
    throw new LedgerError('REVALUE_ASSET requires exactly one of newValue or delta');
  }

  const resolvedDelta = hasDelta ? (delta as number) : (newValue as number) - existing.value;
  const nextValue = existing.value + resolvedDelta;
  if (nextValue < 0) {
    throw new LedgerError(`Revaluation would take "${assetName}" negative (${nextValue})`);
  }

  const now = Date.now();
  const assets = state.assets.map((a) =>
    a.id === existing.id ? { ...a, value: nextValue, isActive: nextValue > 0, updatedAt: now } : a,
  );

  return {
    ...state,
    assets,
    transactions: pushTransaction(state, 'REVALUE_ASSET', {
      assetId: existing.id, amount: resolvedDelta, note,
    }),
  };
}

/**
 * The single entry point for mutating the ledger. Always returns a new
 * LedgerState; throws LedgerError on invalid input (never mutates `state`).
 */
export function handleTransaction(
  state: LedgerState,
  type: 'BUY_ASSET',
  payload: BuyAssetPayload,
  options?: LedgerOptions,
): LedgerState;
export function handleTransaction(
  state: LedgerState,
  type: 'SELL_ASSET',
  payload: SellAssetPayload,
  options?: LedgerOptions,
): LedgerState;
export function handleTransaction(
  state: LedgerState,
  type: 'INCOME',
  payload: IncomePayload,
  options?: LedgerOptions,
): LedgerState;
export function handleTransaction(
  state: LedgerState,
  type: 'EXPENSE',
  payload: ExpensePayload,
  options?: LedgerOptions,
): LedgerState;
export function handleTransaction(
  state: LedgerState,
  type: 'REVALUE_ASSET',
  payload: RevalueAssetPayload,
  options?: LedgerOptions,
): LedgerState;
export function handleTransaction(
  state: LedgerState,
  type: LedgerTransactionType,
  payload: BuyAssetPayload | SellAssetPayload | IncomePayload | ExpensePayload | RevalueAssetPayload,
  options: LedgerOptions = {},
): LedgerState {
  switch (type) {
    case 'BUY_ASSET': return buyAsset(state, payload as BuyAssetPayload, options);
    case 'SELL_ASSET': return sellAsset(state, payload as SellAssetPayload);
    case 'INCOME': return income(state, payload as IncomePayload);
    case 'EXPENSE': return expense(state, payload as ExpensePayload, options);
    case 'REVALUE_ASSET': return revalueAsset(state, payload as RevalueAssetPayload);
    default: {
      const _exhaustive: never = type;
      throw new LedgerError(`Unknown transaction type: ${_exhaustive}`);
    }
  }
}

export { EMPTY_LEDGER_STATE };
export type { AssetType };
