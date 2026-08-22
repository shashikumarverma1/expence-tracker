import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';

export type TradeEmotion = 'Panic' | 'FOMO' | 'Calm' | 'Revenge';
export type TradeResult  = 'profit' | 'loss' | 'no-trade';

export interface TradeEntry {
  id:            string;
  transcription: string;
  aiSummary:     string;
  emotion:       TradeEmotion;
  result?:       TradeResult;
  pnl?:          number | null;
  currency?:     string;          // 'INR' | 'USD' | 'EUR' | 'GBP'
  audioUri:      string;
  note?:         string;
  createdAt:     Timestamp;
}

export async function setTradeResult(uid: string, tradeId: string, result: TradeResult) {
  return updateDoc(doc(db, 'users', uid, 'trades', tradeId), { result });
}

export function useTradeLog() {
  const [trades,    setTrades]    = useState<TradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const q = query(
      collection(db, 'users', uid, 'trades'),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TradeEntry)));
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );

    return unsub;
  }, [uid]);

  return { trades, isLoading };
}
