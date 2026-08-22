import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';

/** Live monthlyBudget field on users/{uid} — 0 means "not set". */
export function useMonthlyBudget() {
  const [monthlyBudget, setMonthlyBudgetState] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data();
        const value = typeof data?.monthlyBudget === 'number' ? data.monthlyBudget : 0;
        setMonthlyBudgetState(value);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [uid]);

  return { monthlyBudget, isLoading };
}

/** Persists the user's monthly budget; merges into users/{uid} so it
 *  doesn't clobber other profile fields (displayName, photoURL, …). */
export async function setMonthlyBudget(uid: string, amount: number) {
  return setDoc(doc(db, 'users', uid), { monthlyBudget: amount }, { merge: true });
}
