// Shared transaction/net-worth types + category constants.
// Mirrors the Firestore schema written by functions/src/classifyTransaction.ts
// and functions/src/updateNetWorth.ts — keep these three in sync.

// Four top-level types:
// - EXPENSE — money going out (spent, paid, lost).
// - INCOME  — money coming in that isn't already held as an investment
//             (salary, freelance, gifts, interest, or simply cash/bank added).
// - ASSET   — money moved into something you already hold/invest in
//             (stocks, bonds, FD, RD, mutual funds, crypto, gold, real estate).
// - OTHER   — anything that doesn't fit the above (lending money, a note-to-
//             self, an unclear entry). Never affects net worth.
export type TransactionType = 'EXPENSE' | 'INCOME' | 'ASSET' | 'OTHER';

export type Emotion =
  | 'happy'
  | 'neutral'
  | 'guilty'
  | 'stressed'
  | 'impulsive'
  | 'proud'
  | 'worried'
  | 'excited';

export const EXPENSE_CATEGORIES = [
  'Grocery', 'Food & Dining', 'Entertainment', 'Bills & Utilities',
  'Travel & Transport', 'Shopping', 'Health & Medical', 'Education',
  'Rent', 'Subscriptions',
] as const;

// INCOME: money coming in that isn't already an investment/holding — this
// includes plain cash/bank additions, which credit the same net-worth field
// a "Salary" entry would (see ASSET_FIELD_MAP). "Loan" is the one exception:
// it still credits cash/bank, but it also adds an equal amount to
// liabilities, since borrowed money isn't a net-worth gain (see updateNetWorth).
export const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Interest', 'Dividend', 'Gift', 'Bonus', 'Refund',
  'Cash', 'Bank/Digital Cash', 'Loan',
] as const;

// ASSET: things you already hold or are investing in — a distinct holding
// field on NetWorth, not just liquid cash.
export const ASSET_CATEGORIES = [
  'Stocks', 'Bonds', 'FD', 'RD', 'Mutual Funds', 'Crypto', 'Gold', 'Real Estate',
] as const;

export const EMOTIONS: Emotion[] = [
  'happy', 'neutral', 'guilty', 'stressed', 'impulsive', 'proud', 'worried', 'excited',
];

// Maps a category -> the net-worth field it credits. Covers both INCOME's
// "Cash"/"Bank/Digital Cash" categories and ASSET's holding categories.
// Any other INCOME category (Salary, Freelance, …) credits Bank/Digital Cash
// directly — handled by the caller, not this map.
export const ASSET_FIELD_MAP: Record<string, keyof NetWorth> = {
  'Cash': 'cash',
  'Bank/Digital Cash': 'digitalCash',
  'Stocks': 'stocks',
  'Bonds': 'bonds',
  'FD': 'fd',
  'RD': 'rd',
  'Mutual Funds': 'mutualFunds',
  'Crypto': 'crypto',
  'Gold': 'gold',
  'Real Estate': 'realEstate',
  'Other': 'otherAssets',
};

export const ASSET_FIELD_KEYS = [
  'cash', 'digitalCash', 'stocks', 'bonds', 'fd', 'rd',
  'mutualFunds', 'crypto', 'gold', 'realEstate', 'otherAssets',
] as const;

export function isIncomeCategory(category: string | null | undefined): boolean {
  return !!category && (INCOME_CATEGORIES as readonly string[]).includes(category);
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string | null;
  emotion: Emotion;
  confidence: number;
  rawSummary: string;
  rawVoiceText: string;
  audioUrl: string | null;
  needsConfirmation: boolean;
  timestamp: number; // ms epoch (converted from Firestore Timestamp on read)
  createdAt: number;
  updatedAt: number;
}

export interface NetWorth {
  cash: number;
  digitalCash: number;
  stocks: number;
  bonds: number;
  fd: number;
  rd: number;
  mutualFunds: number;
  crypto: number;
  gold: number;
  realEstate: number;
  otherAssets: number;
  liabilities: number;
  totalAssets: number;
  totalNetWorth: number;
  lastUpdated: number;
}

export function categoriesForType(type: TransactionType): readonly string[] {
  if (type === 'EXPENSE') return EXPENSE_CATEGORIES;
  if (type === 'INCOME') return INCOME_CATEGORIES;
  if (type === 'ASSET') return ASSET_CATEGORIES;
  return [];
}
