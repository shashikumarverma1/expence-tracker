import { collection, doc, onSnapshot, query, QueryDocumentSnapshot, Timestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../../../core/config';

export interface TradePnl {
  amount:   number;
  currency: string;
}

export interface DailyReport {
  date:            string;
  tradesLogged:    number;
  winRate:         number | null;
  dominantEmotion: string;
  bestTradeTime:   string;
  panicPercent:    number;
  fomoPercent:     number;
  revengePercent:  number;
  calmPercent:     number;
  bestTrade:       TradePnl | null;
  worstTrade:      TradePnl | null;
}

export interface WeeklyReport {
  weekRange:      string;
  totalTrades:    number;
  winRate:        number | null;
  panicPercent:   number;
  fomoPercent:    number;
  revengePercent: number;
  calmPercent:    number;
  bestDay:        string;
  worstDay:       string;
  bestTrade:      TradePnl | null;
  worstTrade:     TradePnl | null;
}

export interface MonthlyReport {
  month:           string;
  totalTrades:     number;
  winRate:         number | null;
  lossRate:        number | null;
  panicPercent:    number;
  fomoPercent:     number;
  revengePercent:  number;
  calmPercent:     number;
  bestTimeOfDay:   string;
  bestTimeWinRate: number;
  worstDay:        string;
  streakTrigger:   string;
  topPattern:      null;
  bestTrade:       TradePnl | null;
  worstTrade:      TradePnl | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

type TradeDoc = {
  result?:   'profit' | 'loss' | 'no-trade';
  emotion?:  string;
  pnl?:      number | null;
  currency?: string;
  createdAt: Timestamp;
};

function pct(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function winRate(docs: TradeDoc[]): number | null {
  const decided = docs.filter((d) => d.result === 'profit' || d.result === 'loss');
  if (decided.length === 0) return null;
  return pct(decided.filter((d) => d.result === 'profit').length, decided.length);
}

function lossRate(docs: TradeDoc[]): number | null {
  const decided = docs.filter((d) => d.result === 'profit' || d.result === 'loss');
  if (decided.length === 0) return null;
  return pct(decided.filter((d) => d.result === 'loss').length, decided.length);
}

function bestWorstPnl(docs: TradeDoc[]): { bestTrade: TradePnl | null; worstTrade: TradePnl | null } {
  const profits = docs.filter((d) => d.result === 'profit' && d.pnl != null) as (TradeDoc & { pnl: number })[];
  const losses  = docs.filter((d) => d.result === 'loss'   && d.pnl != null) as (TradeDoc & { pnl: number })[];
  const best  = profits.length > 0 ? profits.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worst = losses.length  > 0 ? losses.reduce((a, b)  => (b.pnl < a.pnl ? b : a)) : null;
  return {
    bestTrade:  best  ? { amount: best.pnl,  currency: best.currency  ?? 'INR' } : null,
    worstTrade: worst ? { amount: worst.pnl, currency: worst.currency ?? 'INR' } : null,
  };
}

function dominantEmotion(docs: TradeDoc[]): string {
  const counts: Record<string, number> = {};
  docs.forEach((d) => { if (d.emotion) counts[d.emotion] = (counts[d.emotion] ?? 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
}

function emotionPct(docs: TradeDoc[], emotion: string) {
  return pct(docs.filter((d) => d.emotion === emotion).length, docs.length);
}


const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function bestWorstDay(docs: TradeDoc[]): { bestDay: string; worstDay: string } {
  const byDay: Record<number, { wins: number; total: number }> = {};
  docs.forEach((d) => {
    const day = d.createdAt.toDate().getDay();
    if (!byDay[day]) byDay[day] = { wins: 0, total: 0 };
    if (d.result === 'profit') byDay[day].wins++;
    if (d.result === 'profit' || d.result === 'loss') byDay[day].total++;
  });
  const entries = Object.entries(byDay).filter(([, v]) => v.total > 0);
  if (entries.length === 0) return { bestDay: '—', worstDay: '—' };
  entries.sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total));
  return {
    bestDay:  DAYS[Number(entries[0][0])],
    worstDay: DAYS[Number(entries[entries.length - 1][0])],
  };
}

function bestTradeTime(docs: TradeDoc[]): string {
  if (docs.length === 0) return '—';
  // find the profit trade with highest pnl, return its time
  const profits = docs.filter((d) => d.result === 'profit');
  if (profits.length === 0) return '—';
  const best = profits.reduce((a, b) => ((a.pnl ?? 0) >= (b.pnl ?? 0) ? a : b));
  const d = best.createdAt.toDate();
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

function bestTimeOfDay(docs: TradeDoc[]): { slot: string; wr: number } {
  // bucket trades into 1-hour slots, find slot with highest win rate (min 2 trades)
  const slots: Record<string, { wins: number; total: number }> = {};
  docs.forEach((d) => {
    const h = d.createdAt.toDate().getHours();
    const label = `${h % 12 || 12}–${(h + 1) % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
    if (!slots[label]) slots[label] = { wins: 0, total: 0 };
    if (d.result === 'profit') slots[label].wins++;
    if (d.result === 'profit' || d.result === 'loss') slots[label].total++;
  });
  const valid = Object.entries(slots).filter(([, v]) => v.total >= 2);
  if (valid.length === 0) return { slot: '—', wr: 0 };
  valid.sort((a, b) => (b[1].wins / b[1].total) - (a[1].wins / a[1].total));
  const [label, { wins, total }] = valid[0];
  return { slot: label, wr: Math.round((wins / total) * 100) };
}

function streakTrigger(docs: TradeDoc[]): string {
  // look for longest consecutive loss streak to identify the trigger count
  let maxStreak = 0, cur = 0;
  [...docs].reverse().forEach((d) => {
    if (d.result === 'loss') { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  });
  if (maxStreak === 0) return '—';
  return `after ${maxStreak} consecutive loss${maxStreak > 1 ? 'es' : ''}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOf(unit: 'day' | 'week' | 'month'): Date {
  const d = new Date();
  if (unit === 'day')   { d.setHours(0, 0, 0, 0); }
  if (unit === 'week')  { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); }
  if (unit === 'month') { d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); }
  return d;
}

function computeDaily(docs: TradeDoc[]): DailyReport {
  return {
    date:            formatDate(new Date()),
    tradesLogged:    docs.length,
    winRate:         winRate(docs),
    dominantEmotion: dominantEmotion(docs),
    bestTradeTime:   bestTradeTime(docs),
    panicPercent:    emotionPct(docs, 'Panic'),
    fomoPercent:     emotionPct(docs, 'FOMO'),
    revengePercent:  emotionPct(docs, 'Revenge'),
    calmPercent:     emotionPct(docs, 'Calm'),
    ...bestWorstPnl(docs),
  };
}

function computeWeekly(docs: TradeDoc[]): WeeklyReport {
  const now   = new Date();
  const start = startOf('week');
  const fmt   = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const { bestDay, worstDay } = bestWorstDay(docs);
  return {
    weekRange:      `${fmt(start)} – ${fmt(now)}`,
    totalTrades:    docs.length,
    winRate:        winRate(docs),
    panicPercent:   emotionPct(docs, 'Panic'),
    fomoPercent:    emotionPct(docs, 'FOMO'),
    revengePercent: emotionPct(docs, 'Revenge'),
    calmPercent:    emotionPct(docs, 'Calm'),
    bestDay,
    worstDay,
    ...bestWorstPnl(docs),
  };
}

function computeMonthly(docs: TradeDoc[]): MonthlyReport {
  const now = new Date();
  const { slot, wr } = bestTimeOfDay(docs);
  const { bestDay, worstDay } = bestWorstDay(docs);
  return {
    month:           now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    totalTrades:     docs.length,
    winRate:         winRate(docs),
    lossRate:        lossRate(docs),
    panicPercent:   emotionPct(docs, 'Panic'),
    fomoPercent:    emotionPct(docs, 'FOMO'),
    revengePercent: emotionPct(docs, 'Revenge'),
    calmPercent:    emotionPct(docs, 'Calm'),
    bestTimeOfDay:  slot,
    bestTimeWinRate: wr,
    worstDay,
    streakTrigger:   streakTrigger(docs),
    topPattern:      null,
    ...bestWorstPnl(docs),
  };
}

// ─── Hook ────────────────────────────────────────────────────────

function parseDocs(snap: { docs: QueryDocumentSnapshot[] }): TradeDoc[] {
  return snap.docs.map((d) => d.data() as TradeDoc);
}

export function useTradeReports() {
  const [entryCount, setEntryCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [daily,      setDaily]      = useState<DailyReport | null>(null);
  const [weekly,     setWeekly]     = useState<WeeklyReport | null>(null);
  const [monthly,    setMonthly]    = useState<MonthlyReport | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) { setIsLoading(false); return; }

    const col = collection(db, 'users', uid, 'trades');
    const ts  = (d: Date) => Timestamp.fromDate(d);

    let resolved = 0;
    const done = () => { resolved++; if (resolved >= 4) setIsLoading(false); };

    // daily
    const dayStart = startOf('day');
    const unsubDay = onSnapshot(
      query(col, where('createdAt', '>=', ts(dayStart))),
      (snap) => {
        const docs = parseDocs(snap);
        setTodayCount(docs.length);
        setDaily(docs.length > 0 ? computeDaily(docs) : null);
        done();
      }, done,
    );

    // weekly
    const weekStart = startOf('week');
    const unsubWeek = onSnapshot(
      query(col, where('createdAt', '>=', ts(weekStart))),
      (snap) => {
        const docs = parseDocs(snap);
        setWeekly(docs.length > 0 ? computeWeekly(docs) : null);
        done();
      }, done,
    );

    // monthly
    const monthStart = startOf('month');
    const unsubMonth = onSnapshot(
      query(col, where('createdAt', '>=', ts(monthStart))),
      (snap) => {
        const docs = parseDocs(snap);
        setMonthly(docs.length > 0 ? computeMonthly(docs) : null);
        done();
      }, done,
    );

    // total entryCount from user doc (for lock thresholds on weekly/monthly)
    const unsubUser = onSnapshot(doc(db, 'users', uid), (snap) => {
      setEntryCount((snap.data()?.entryCount as number) ?? 0);
      done();
    }, done);

    return () => { unsubDay(); unsubWeek(); unsubMonth(); unsubUser(); };
  }, [uid]);

  return { entryCount, todayCount, daily, weekly, monthly, isLoading };
}
