import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';
import { NetWorth } from '../../../core/types/transaction';

const EMPTY: NetWorth = {
  cash: 0, digitalCash: 0, stocks: 0, bonds: 0, fd: 0, rd: 0,
  mutualFunds: 0, crypto: 0, gold: 0, realEstate: 0, otherAssets: 0,
  liabilities: 0, totalAssets: 0, totalNetWorth: 0, lastUpdated: 0,
};

/** Live netWorth/{uid} doc — the single source of truth for the dashboard. */
export function useNetWorth() {
  const [netWorth, setNetWorth] = useState<NetWorth>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, 'netWorth', uid),
      (snap) => {
        const data = snap.data();
        setNetWorth(data ? {
          ...EMPTY,
          ...data,
          lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toMillis() : 0,
        } as NetWorth : EMPTY);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [uid]);

  return { netWorth, isLoading };
}
