import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';
import { Transaction } from '../../../core/types/transaction';

function toMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return Date.now();
}

/** Live list of the signed-in user's transactions, newest first. */
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: toMillis(data.timestamp),
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
          } as Transaction;
        }));
        setIsLoading(false);
      },
      (err) => {
        console.error('[useTransactions] onSnapshot error:', err?.code, err?.message);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { transactions, isLoading };
}

/** Confirm/edit a transaction — updates the doc; updateNetWorth trigger
 *  applies it once needsConfirmation flips to false. */
export async function confirmTransaction(
  transactionId: string,
  fields: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>,
) {
  return updateDoc(doc(db, 'transactions', transactionId), {
    ...fields,
    needsConfirmation: false,
    updatedAt: Timestamp.now(),
  });
}

/** Permanently removes a transaction; updateNetWorth reverses its effect. */
export async function deleteTransaction(transactionId: string) {
  return deleteDoc(doc(db, 'transactions', transactionId));
}
