import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';

const ASSET_FIELD_MAP: Record<string, string> = {
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

const ASSET_FIELD_KEYS = [
  'cash', 'digitalCash', 'stocks', 'bonds', 'fd', 'rd',
  'mutualFunds', 'crypto', 'gold', 'realEstate', 'otherAssets',
];

const EMPTY_NET_WORTH: Record<string, number> = Object.fromEntries(
  [...ASSET_FIELD_KEYS, 'liabilities', 'totalAssets', 'totalNetWorth'].map((k) => [k, 0]),
);

function fundField(fundSource: string | null | undefined): string {
  return ASSET_FIELD_MAP[fundSource ?? 'Bank/Digital Cash'] ?? 'digitalCash';
}

function assetField(assetClass: string | null | undefined): string | null {
  if (!assetClass) return null;
  return ASSET_FIELD_MAP[assetClass] ?? 'otherAssets';
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

    const { userId, type, amount, fundSource, assetClass } = after as {
      userId: string;
      type: string;
      amount: number;
      fundSource: string | null;
      assetClass: string | null;
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
          const f = fundField(fundSource);
          current[f] = (current[f] ?? 0) - amount;
          break;
        }
        case 'INCOME': {
          const f = fundField(fundSource);
          current[f] = (current[f] ?? 0) + amount;
          break;
        }
        case 'ASSET_ADD': {
          const a = assetField(assetClass) ?? 'otherAssets';
          const f = fundField(fundSource);
          current[a] = (current[a] ?? 0) + amount;
          current[f] = (current[f] ?? 0) - amount;
          break;
        }
        case 'ASSET_REDUCE': {
          const a = assetField(assetClass) ?? 'otherAssets';
          const f = fundField(fundSource);
          current[a] = (current[a] ?? 0) - amount;
          current[f] = (current[f] ?? 0) + amount;
          break;
        }
        case 'LIABILITY_ADD': {
          current.liabilities = (current.liabilities ?? 0) + amount;
          break;
        }
        case 'LIABILITY_REDUCE': {
          current.liabilities = (current.liabilities ?? 0) - amount;
          const f = fundField(fundSource);
          current[f] = (current[f] ?? 0) - amount;
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
