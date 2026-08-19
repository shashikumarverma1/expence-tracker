import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';

// ASSET holding categories -> the net-worth field they live in. Categories not
// listed here (Salary, Freelance, Business, Interest, Dividend, Gift, Bonus,
// Refund) are income — they credit Bank/Digital Cash directly instead.
const ASSET_FIELD_MAP: Record<string, string> = {
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

const ASSET_FIELD_KEYS = [
  'cash', 'digitalCash', 'stocks', 'bonds', 'fd', 'rd',
  'mutualFunds', 'crypto', 'gold', 'realEstate', 'otherAssets',
];

const EMPTY_NET_WORTH: Record<string, number> = Object.fromEntries(
  [...ASSET_FIELD_KEYS, 'liabilities', 'totalAssets', 'totalNetWorth'].map((k) => [k, 0]),
);

// Every cash movement (expenses paid, income received, money moved into a
// holding) is assumed to flow through the same liquid bucket now that fund
// source is no longer tracked per-transaction.
const CASH_FIELD = 'digitalCash';

/** Holding category -> net-worth field, or null if `category` is an income category. */
function holdingField(category: string | null | undefined): string | null {
  if (!category) return null;
  return ASSET_FIELD_MAP[category] ?? null;
}

/**
 * Firestore trigger on transactions/{transactionId} create/update.
 * Applies the transaction's effect on netWorth/{userId} exactly once — guarded
 * by an `appliedToNetWorth` flag on the transaction doc itself, since Cloud
 * Functions triggers can retry/redeliver and this must stay idempotent.
 * Only applies once needsConfirmation is false (either it was clear from the
 * start, or the user just confirmed/edited it in the app).
 */
export const updateNetWorth = functions
  .region(REGION)
  .firestore.document('transactions/{transactionId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return; // deleted — leave net worth as-is, don't auto-reverse

    if (after.needsConfirmation) return; // still awaiting user confirmation
    if (after.appliedToNetWorth) return; // idempotency guard — already applied

    const { userId, type, amount, category } = after as {
      userId: string;
      type: string;
      amount: number;
      category: string | null;
    };

    if (!userId || typeof amount !== 'number') return;

    const netWorthRef = db.collection('netWorth').doc(userId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(netWorthRef);
      const current: Record<string, number> = snap.exists
        ? { ...EMPTY_NET_WORTH, ...(snap.data() as Record<string, number>) }
        : { ...EMPTY_NET_WORTH };

      switch (type) {
        case 'EXPENSE': {
          current[CASH_FIELD] = (current[CASH_FIELD] ?? 0) - amount;
          break;
        }
        case 'ASSET': {
          const holding = holdingField(category);
          if (holding) {
            // Holding category (Stocks, FD, …) — money moves out of cash/bank
            // into that dedicated field.
            current[holding] = (current[holding] ?? 0) + amount;
            current[CASH_FIELD] = (current[CASH_FIELD] ?? 0) - amount;
          } else {
            // Income category (Salary, Freelance, …) — credits cash/bank directly.
            current[CASH_FIELD] = (current[CASH_FIELD] ?? 0) + amount;
          }
          break;
        }
        default:
          return; // unknown type — don't touch net worth
      }

      // Negative balances are allowed (flagged in UI), never blocked here.
      const totalAssets = ASSET_FIELD_KEYS.reduce((sum, k) => sum + (current[k] ?? 0), 0);
      current.totalAssets = totalAssets;
      current.totalNetWorth = totalAssets - (current.liabilities ?? 0);

      tx.set(netWorthRef, {
        ...current,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.update(change.after.ref, { appliedToNetWorth: true });
    });
  });
