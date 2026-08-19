import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';
import { collections } from '../../../core/enum/eCollections';

export interface WeeklyReport {
  id: string;            // weekStartDate string e.g. '2025-06-09'
  topMood: string;
  recurringTheme: string;
  insight: string;
  entriesCount: number;
  weekStartDate: Timestamp;
  weekEndDate: Timestamp;
  createdAt: Timestamp;
}

function getThisWeekStartStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

export function useWeeklyInsights() {
  const [reports, setReports]       = useState<WeeklyReport[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, collections.users, uid, collections.weeklyReports),
      orderBy('weekStartDate', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WeeklyReport));
        setReports(docs);
        setIsLoading(false);
      },
      () => {
        setError('Failed to load insights');
        setIsLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  const thisWeekStr    = getThisWeekStartStr();
  const currentReport  = reports.find((r) => r.id === thisWeekStr) ?? null;
  const pastReports    = reports.filter((r) => r.id !== thisWeekStr);

  return { currentReport, pastReports, isLoading, error };
}
