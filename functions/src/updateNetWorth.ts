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

// Income (Salary, Freelance, …) and expenses settle here since fund source
// isn't tracked per-transaction.
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
 *
 * The guard is re-checked with a fresh transactional read inside
 * db.runTransaction (not just off the trigger's `change.after` snapshot) —
 * two near-simultaneous writes to the same doc (e.g. its create event and an
 * immediate client update) each get their own stale snapshot at invocation
 * time, so checking only that snapshot let both invocations pass the guard
 * and double-apply the amount.
 */
export const updateNetWorth = functions
  .region(REGION)
  .firestore.document('transactions/{transactionId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return; // deleted — leave net worth as-is, don't auto-reverse

    if (after.needsConfirmation) return; // still awaiting user confirmation

    const { userId, type, amount, category } = after as {
      userId: string;
      type: string;
      amount: number;
      category: string | null;
    };

    if (!userId || typeof amount !== 'number') return;

    const netWorthRef = db.collection('netWorth').doc(userId);
    const txnRef = change.after.ref;

    await db.runTransaction(async (tx) => {
      const [txnSnap, snap] = await Promise.all([tx.get(txnRef), tx.get(netWorthRef)]);

      if (!txnSnap.exists || txnSnap.data()?.appliedToNetWorth) return; // already applied

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
            // Holding category (Stocks, FD, …) — adds to that asset field.
            // Not debited from cash: there's no tracked starting cash
            // balance, so treating this as a cash-to-asset transfer would
            // just drive digitalCash negative for every investment.
            current[holding] = (current[holding] ?? 0) + amount;
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
