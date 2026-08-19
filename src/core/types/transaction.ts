// Shared transaction/net-worth types + category constants.
// Mirrors the Firestore schema written by functions/src/classifyTransaction.ts
// and functions/src/updateNetWorth.ts — keep these three in sync.

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'ASSET_ADD'
  | 'ASSET_REDUCE'
  | 'LIABILITY_ADD'
  | 'LIABILITY_REDUCE';

export type Emotion =
  | 'happy'
  | 'neutral'
  | 'guilty'
  | 'stressed'
  | 'impulsive'
  | 'proud'
  | 'worried'
  | 'excited';

export type FundSource = 'Cash' | 'Bank/Digital Cash' | 'Card' | 'UPI' | 'Other';

export const EXPENSE_CATEGORIES = [
  'Grocery', 'Food & Dining', 'Entertainment', 'Bills & Utilities',
  'Travel & Transport', 'Shopping', 'Health & Medical', 'Education',
  'Rent', 'Subscriptions', 'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Interest', 'Dividend',
  'Gift', 'Bonus', 'Refund', 'Other',
] as const;

export const ASSET_CLASSES = [
  'Cash', 'Bank/Digital Cash', 'Stocks', 'Bonds', 'FD', 'RD',
  'Mutual Funds', 'Crypto', 'Gold', 'Real Estate', 'Other',
] as const;

export const LIABILITY_TYPES = [
  'Personal Loan', 'Home Loan', 'Credit Card', 'Borrowed from Person', 'Other',
] as const;

export const EMOTIONS: Emotion[] = [
  'happy', 'neutral', 'guilty', 'stressed', 'impulsive', 'proud', 'worried', 'excited',
];

// Maps a net-worth field key -> the human label used for fundSource / assetClass.
export const ASSET_FIELD_MAP: Record<string, keyof NetWorth> = {
  'Cash': 'cash',
  'Bank/Digital Cash': 'digitalCash',
  'Card': 'digitalCash',
  'UPI': 'digitalCash',
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

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string | null;
  assetClass: string | null;
  liabilityType: string | null;
  fundSource: string | null;
  merchantOrSource: string | null;
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
  if (type === 'INCOME') return INCOME_CATEGORIES;
  if (type === 'EXPENSE') return EXPENSE_CATEGORIES;
  return [];
}
