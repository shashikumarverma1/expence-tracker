import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';

// Holding categories (ASSET type) and the two liquid INCOME categories
// (Cash, Bank/Digital Cash) -> the net-worth field they credit. Every other
// INCOME category (Salary, Freelance, Business, Interest, Dividend, Gift,
// Bonus, Refund) credits Bank/Digital Cash directly instead — see computeDelta.
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
  if (f.type === 'INCOME') {
    // "Cash" credits the cash field directly; every other income category
    // (Salary, Freelance, Bank/Digital Cash, …) credits Bank/Digital Cash.
    // This also covers Interest/Dividend earned on a held asset — that gain
    // is real net-worth growth, so it's recorded as INCOME, never folded
    // into a NEW_ASSET/SOLD_ASSET delta below.
    const field = f.category === 'Cash' ? ASSET_FIELD_MAP['Cash'] : CASH_FIELD;
    // "Loan" is borrowed money — it lands in cash/bank same as any income,
    // but it's not a net-worth gain, so an equal amount goes to liabilities.
    if (f.category === 'Loan') {
      return { [field]: f.amount, liabilities: f.amount };
    }
    return { [field]: f.amount };
  }
  const holding = f.category ? ASSET_FIELD_MAP[f.category] : undefined;
  // OLD_ASSET: the user is just stating a holding they already have — only
  // the asset field moves, no cash field is touched.
  if (f.type === 'OLD_ASSET') {
    return holding ? { [holding]: f.amount } : { [CASH_FIELD]: f.amount };
  }
  // NEW_ASSET: bought using tracked cash/bank money — a reallocation, not
  // income or expense, so total net worth is unchanged: the holding goes up
  // and cash/bank goes down by the same amount.
  if (f.type === 'NEW_ASSET') {
    return holding ? { [holding]: f.amount, [CASH_FIELD]: -f.amount } : { [CASH_FIELD]: 0 };
  }
  // SOLD_ASSET: the holding is liquidated back to cash/bank — the reverse
  // reallocation. Any profit/interest above principal must have already
  // been (or should separately be) recorded as its own INCOME entry.
  if (f.type === 'SOLD_ASSET') {
    return holding ? { [holding]: -f.amount, [CASH_FIELD]: f.amount } : { [CASH_FIELD]: f.amount };
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
      let priorApplied = priorSrc?.appliedFields as AppliedFields | undefined;
      // Legacy appliedFields recorded as type "ASSET" (pre OLD/NEW/SOLD split).
      if (priorApplied?.type === 'ASSET') priorApplied = { ...priorApplied, type: 'OLD_ASSET' };
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
        // Legacy docs written before OLD_ASSET/NEW_ASSET/SOLD_ASSET existed
        // still carry type "ASSET" — treat those the same as OLD_ASSET
        // (their original behavior: only the holding field moves).
        const effectiveType = data.type === 'ASSET' ? 'OLD_ASSET' : data.type;
        if (!data.needsConfirmation && typeof data.amount === 'number'
          && (effectiveType === 'EXPENSE' || effectiveType === 'INCOME'
            || effectiveType === 'OLD_ASSET' || effectiveType === 'NEW_ASSET' || effectiveType === 'SOLD_ASSET')) {
          const applied: AppliedFields = {
            type: effectiveType,
            amount: data.amount,
            category: data.category ?? null,
          };
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
