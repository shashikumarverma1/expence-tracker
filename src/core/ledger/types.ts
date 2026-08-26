// Standalone ledger/portfolio model — tracks Cash + named Asset holdings and
// keeps Net Worth accurate by construction (see ledger.ts for the invariant).
//
// This is deliberately separate from src/core/types/transaction.ts (the
// existing voice-classified EXPENSE/INCOME/OLD_ASSET/NEW_ASSET/SOLD_ASSET
// model backed by Firestore + Cloud Functions). That model tracks net worth
// as aggregate *category buckets* (one number per "Stocks", "Bonds", …).
// This ledger instead tracks *named* asset holdings ("HDFC Bond #1",
// "Reliance Stock") individually, and adds a fifth transaction type
// (REVALUE_ASSET) for marking a holding's value up/down without any cash
// changing hands — something the bucket model has no equivalent for.
// Use this module where per-holding tracking or mark-to-market revaluation
// is needed; keep using the Firestore model for everything else.

export type AssetType =
  | 'bond' | 'stock' | 'gold' | 'crypto' | 'mutualFund' | 'property' | 'other';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  // false once a SELL_ASSET brings value to 0 — kept in the array (not
  // deleted) so transaction history stays intact and the holding can be
  // bought back into later without losing its identity/id.
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export type LedgerTransactionType =
  | 'BUY_ASSET' | 'SELL_ASSET' | 'INCOME' | 'EXPENSE' | 'REVALUE_ASSET';

export interface LedgerTransaction {
  id: string;
  type: LedgerTransactionType;
  // Set for BUY_ASSET/SELL_ASSET/REVALUE_ASSET, null for INCOME/EXPENSE.
  assetId: string | null;
  // The transaction's face amount: the buy/sell/income/expense amount, or
  // the signed value delta for REVALUE_ASSET (positive = marked up).
  amount: number;
  // Set for INCOME/EXPENSE (e.g. "Salary", "Rent"), null otherwise.
  category: string | null;
  timestamp: number;
  note?: string;
}

export interface LedgerState {
  cash: number;
  assets: Asset[];
  transactions: LedgerTransaction[];
}

export interface LedgerOptions {
  // When false (default), BUY_ASSET/EXPENSE throw if amount > current cash.
  // Set true for users who want to track a negative/overdrawn cash balance
  // (e.g. logging spend before logging the income that covers it).
  allowNegativeCash?: boolean;
}

export interface BuyAssetPayload {
  assetName: string;
  assetType: AssetType;
  amount: number;
  note?: string;
}

export interface SellAssetPayload {
  assetName: string;
  amount: number;
  note?: string;
}

export interface IncomePayload {
  amount: number;
  category: string;
  note?: string;
}

export interface ExpensePayload {
  amount: number;
  category: string;
  note?: string;
}

// Exactly one of newValue/delta must be given.
export interface RevalueAssetPayload {
  assetName: string;
  newValue?: number;
  delta?: number;
  note?: string;
}

export type LedgerPayload =
  | { type: 'BUY_ASSET'; payload: BuyAssetPayload }
  | { type: 'SELL_ASSET'; payload: SellAssetPayload }
  | { type: 'INCOME'; payload: IncomePayload }
  | { type: 'EXPENSE'; payload: ExpensePayload }
  | { type: 'REVALUE_ASSET'; payload: RevalueAssetPayload };

export const EMPTY_LEDGER_STATE: LedgerState = { cash: 0, assets: [], transactions: [] };
