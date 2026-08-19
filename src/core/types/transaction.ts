// Shared transaction/net-worth types + category constants.
// Mirrors the Firestore schema written by functions/src/classifyTransaction.ts
// and functions/src/updateNetWorth.ts — keep these three in sync.

// Only two top-level types: money spent (EXPENSE) or money coming in / held
// as an asset (ASSET). `category` picks the subcategory within whichever
// type — see EXPENSE_CATEGORIES / ASSET_CATEGORIES below.
export type TransactionType = 'ASSET' | 'EXPENSE';

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

// ASSET categories split into two flavors that net worth treats differently
// (see ASSET_FIELD_MAP): income categories land straight in cash/bank, while
// holding categories move money out of cash/bank into that dedicated field.
export const ASSET_INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Interest', 'Dividend', 'Gift', 'Bonus', 'Refund',
] as const;

export const ASSET_HOLDING_CATEGORIES = [
  'Cash', 'Bank/Digital Cash', 'Stocks', 'Bonds', 'FD', 'RD',
  'Mutual Funds', 'Crypto', 'Gold', 'Real Estate',
] as const;

export const ASSET_CATEGORIES = [...ASSET_INCOME_CATEGORIES, ...ASSET_HOLDING_CATEGORIES] as const;

export const EMOTIONS: Emotion[] = [
  'happy', 'neutral', 'guilty', 'stressed', 'impulsive', 'proud', 'worried', 'excited',
];

// Maps an ASSET holding category -> the net-worth field it lives in. Income
// categories (Salary, Freelance, …) aren't here — they credit Bank/Digital
// Cash directly.
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
  return !!category && (ASSET_INCOME_CATEGORIES as readonly string[]).includes(category);
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
  if (type === 'ASSET') return ASSET_CATEGORIES;
  return [];
}
