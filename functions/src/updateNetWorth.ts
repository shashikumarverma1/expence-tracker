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

interface AppliedFields {
  type: string;
  amount: number;
  category: string | null;
}

/** type/amount/category -> the signed per-field net-worth delta it represents. */
function computeDelta(f: AppliedFields): Record<string, number> {
  if (f.type === 'EXPENSE') {
    return { [CASH_FIELD]: -f.amount };
  }
  if (f.type === 'ASSET') {
    const holding = f.category ? ASSET_FIELD_MAP[f.category] : undefined;
    return holding ? { [holding]: f.amount } : { [CASH_FIELD]: f.amount };
  }
  return {};
}

/**
 * Firestore trigger on transactions/{transactionId} create/update/delete.
 * Keeps netWorth/{userId} in sync by reversing whatever this transaction's
 * *last applied* effect was (stored as `appliedFields` on the doc) and, if
 * the doc still exists and is confirmed, re-applying its *current* effect —
 * all inside one Firestore transaction with fresh reads.
 *
 * This single reverse-then-reapply step (instead of an apply-once boolean
 * flag) is what makes edits and deletes work correctly, and it's naturally
 * idempotent: a retried/duplicate invocation reads the same already-applied
 * state and reapplies the same delta, netting to no change. That also fixes
 * the double-counting race an apply-once flag had, where two near-
 * simultaneous writes to the same doc could each see "not yet applied" and
 * both apply the amount.
 */
export const updateNetWorth = functions
  .region(REGION)
  .firestore.document('transactions/{transactionId}')
  .onWrite(async (change, context) => {
    const referenceData = change.after.exists ? change.after.data() : change.before.data();
    const userId = referenceData?.userId as string | undefined;
    if (!userId) return;

    const txnRef = db.collection('transactions').doc(context.params.transactionId);
    const netWorthRef = db.collection('netWorth').doc(userId);

    await db.runTransaction(async (tx) => {
      const [txnSnap, nwSnap] = await Promise.all([tx.get(txnRef), tx.get(netWorthRef)]);

      const current: Record<string, number> = nwSnap.exists
        ? { ...EMPTY_NET_WORTH, ...(nwSnap.data() as Record<string, number>) }
        : { ...EMPTY_NET_WORTH };

      // Reverse whatever was last applied for this doc (read fresh here, not
      // from the trigger's before/after params, so retries/races converge).
      // If the doc's been deleted, its final pre-delete data (still carrying
      // appliedFields) is on `change.before` — it can't change further.
      const priorSrc = txnSnap.exists ? txnSnap.data() : change.before.data();
      const priorApplied = priorSrc?.appliedFields as AppliedFields | undefined;
      if (priorApplied) {
        const delta = computeDelta(priorApplied);
        for (const [k, v] of Object.entries(delta)) current[k] = (current[k] ?? 0) - v;
      }

      // Re-apply the doc's current effect, if it still exists and is confirmed.
      let nextApplied: AppliedFields | null = null;
      if (txnSnap.exists) {
        const data = txnSnap.data() as {
          needsConfirmation?: boolean; type?: string; amount?: number; category?: string | null;
        };
        if (!data.needsConfirmation && typeof data.amount === 'number'
          && (data.type === 'EXPENSE' || data.type === 'ASSET')) {
          const applied: AppliedFields = { type: data.type, amount: data.amount, category: data.category ?? null };
          const delta = computeDelta(applied);
          for (const [k, v] of Object.entries(delta)) current[k] = (current[k] ?? 0) + v;
          nextApplied = applied;
        }
      }

      if (!priorApplied && !nextApplied) return; // nothing to do

      // Negative balances are allowed (flagged in UI), never blocked here.
      const totalAssets = ASSET_FIELD_KEYS.reduce((sum, k) => sum + (current[k] ?? 0), 0);
      current.totalAssets = totalAssets;
      current.totalNetWorth = totalAssets - (current.liabilities ?? 0);

      tx.set(netWorthRef, {
        ...current,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (txnSnap.exists) {
        tx.update(txnRef, {
          appliedFields: nextApplied ?? admin.firestore.FieldValue.delete(),
        });
      }
    });
  });
