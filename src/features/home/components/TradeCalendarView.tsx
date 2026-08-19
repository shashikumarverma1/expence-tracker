import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors } from '../../../core/utils';
import { TradeEntry, TradeResult, useTradeLog } from '../hooks/useTradeLog';

// ─── Config ──────────────────────────────────────────────────────

const RESULT_DOT: Record<TradeResult, string> = {
  profit:     brandColors.green,
  loss:       brandColors.red,
  'no-trade': brandColors.textMuted,
};

const RESULT_BG: Record<TradeResult, string> = {
  profit:     brandColors.greenBg,
  loss:       brandColors.redBg,
  'no-trade': brandColors.purpleDim,
};

// ─── Types ───────────────────────────────────────────────────────

interface CalDay {
  date:    number;
  dateStr: string;
  isToday: boolean;
  net:     TradeResult | null;
  count:   number;
  profits: number;
  losses:  number;
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildCalendar(year: number, month: number, trades: TradeEntry[]): CalDay[][] {
  const dayMap = new Map<string, { profits: number; losses: number; noTrade: number; count: number }>();

  trades.forEach((t) => {
    const ms = t.createdAt?.toMillis?.() ?? 0;
    if (!ms) return;
    const d   = new Date(ms);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cur = dayMap.get(key) ?? { profits: 0, losses: 0, noTrade: 0, count: 0 };
    cur.count++;
    if (t.result === 'profit')   cur.profits++;
    else if (t.result === 'loss') cur.losses++;
    else if (t.result === 'no-trade') cur.noTrade++;
    dayMap.set(key, cur);
  });

  const today       = new Date();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad    = firstDay === 0 ? 6 : firstDay - 1;

  const cells: CalDay[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ date: 0, dateStr: '', isToday: false, net: null, count: 0, profits: 0, losses: 0 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const data    = dayMap.get(dateStr);
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
    let net: TradeResult | null = null;
    if (data) {
      if (data.profits > 0 && data.losses === 0) net = 'profit';
      else if (data.losses > 0 && data.profits === 0) net = 'loss';
      else if (data.profits > 0 && data.losses > 0) net = 'loss';
      else if (data.noTrade > 0) net = 'no-trade';
    }
    cells.push({ date: d, dateStr, isToday, net, count: data?.count ?? 0, profits: data?.profits ?? 0, losses: data?.losses ?? 0 });
  }

  const weeks: CalDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  while (weeks[weeks.length - 1]?.length < 7) {
    weeks[weeks.length - 1].push({ date: 0, dateStr: '', isToday: false, net: null, count: 0, profits: 0, losses: 0 });
  }
  return weeks;
}

// ─── Day cell ────────────────────────────────────────────────────

function DayCell({ day, colors }: { day: CalDay; colors: AppColors }) {
  if (day.date === 0) return <View style={cell.pad} />;
  const bg  = day.net ? RESULT_BG[day.net] : 'transparent';
  const dot = day.net ? RESULT_DOT[day.net] : null;
  return (
    <View style={[cell.wrap, { backgroundColor: bg }, day.isToday && { borderColor: colors.primary, borderWidth: 2 }]}>
      {dot ? <View style={[cell.dot, { backgroundColor: dot }]} /> : <View style={[cell.emptyDot, { borderColor: colors.border }]} />}
      <Text style={[cell.num, { color: day.isToday ? colors.primary : colors.textMuted }]}>{day.date}</Text>
      {day.count > 1 && (
        <View style={[cell.badge, { backgroundColor: colors.primary }]}>
          <Text style={cell.badgeTxt}>{day.count}</Text>
        </View>
      )}
    </View>
  );
}

const cell = StyleSheet.create({
  pad:      { flex: 1, aspectRatio: 0.85, margin: 3 },
  wrap:     { flex: 1, aspectRatio: 0.85, margin: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dot:      { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  emptyDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2, borderWidth: 1.5 },
  num:      { fontSize: 10, fontWeight: '600' },
  badge:    { position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 8, fontWeight: '700', color: '#fff' },
});

// ─── Monthly stats card ──────────────────────────────────────────

function MonthlyStats({ trades, year, month, colors }: { trades: TradeEntry[]; year: number; month: number; colors: AppColors }) {
  const { t } = useTranslation();
  const stats = useMemo(() => {
    const inMonth = trades.filter((t) => {
      const ms = t.createdAt?.toMillis?.() ?? 0;
      const d  = new Date(ms);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const profits  = inMonth.filter((t) => t.result === 'profit').length;
    const losses   = inMonth.filter((t) => t.result === 'loss').length;
    const noTrades = inMonth.filter((t) => t.result === 'no-trade').length;
    const untagged = inMonth.length - profits - losses - noTrades;
    return { total: inMonth.length, profits, losses, noTrades, untagged };
  }, [trades, year, month]);

  const s = StyleSheet.create({
    card:  { marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
    row:   { flexDirection: 'row', gap: 8 },
    box:   { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, gap: 3 },
    val:   { fontSize: 22, fontWeight: '700', color: colors.text },
    lbl:   { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  });

  return (
    <View style={s.card}>
      <CText tx="mood_calendar.monthly_summary" style={s.title} />
      <View style={s.row}>
        <View style={[s.box, { backgroundColor: colors.primaryDim }]}>
          <Text style={s.val}>{stats.total}</Text>
          <Text style={s.lbl}>{t('mood_calendar.entries')}</Text>
        </View>
        <View style={[s.box, { backgroundColor: brandColors.greenBg }]}>
          <Text style={[s.val, { color: brandColors.greenText }]}>{stats.profits}</Text>
          <Text style={s.lbl}>{t('trade.result_profit')}</Text>
        </View>
        <View style={[s.box, { backgroundColor: brandColors.redBg }]}>
          <Text style={[s.val, { color: brandColors.redText }]}>{stats.losses}</Text>
          <Text style={s.lbl}>{t('trade.result_loss')}</Text>
        </View>
        <View style={[s.box, { backgroundColor: colors.primaryDim }]}>
          <Text style={[s.val, { color: colors.textMuted }]}>{stats.noTrades + stats.untagged}</Text>
          <Text style={s.lbl}>{t('trade.result_no_trade')}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Legend ──────────────────────────────────────────────────────

function Legend({ colors }: { colors: AppColors }) {
  const { t } = useTranslation();
  const s = StyleSheet.create({
    card:  { marginTop: 12, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
    row:   { flexDirection: 'row', justifyContent: 'space-around' },
    item:  { alignItems: 'center', gap: 4 },
    dot:   { width: 12, height: 12, borderRadius: 6 },
    lbl:   { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  });
  const items = [
    { label: t('trade.result_profit'),   color: brandColors.green },
    { label: t('trade.result_loss'),     color: brandColors.red },
    { label: t('trade.result_no_trade'), color: colors.textMuted },
  ];
  return (
    <View style={s.card}>
      <CText tx="mood_calendar.mood_key" style={s.title} />
      <View style={s.row}>
        {items.map((it) => (
          <View key={it.label} style={s.item}>
            <View style={[s.dot, { backgroundColor: it.color }]} />
            <Text style={s.lbl}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── TradeCalendarView ───────────────────────────────────────────

export function TradeCalendarView() {
  const { colors }            = useTheme();
  const { t }                 = useTranslation();
  const { trades, isLoading } = useTradeLog();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const WEEKDAYS = [
    t('mood_calendar.days.mon'), t('mood_calendar.days.tue'), t('mood_calendar.days.wed'),
    t('mood_calendar.days.thu'), t('mood_calendar.days.fri'), t('mood_calendar.days.sat'),
    t('mood_calendar.days.sun'),
  ];

  const MONTHS = [
    t('mood_calendar.months.january'),  t('mood_calendar.months.february'),
    t('mood_calendar.months.march'),    t('mood_calendar.months.april'),
    t('mood_calendar.months.may'),      t('mood_calendar.months.june'),
    t('mood_calendar.months.july'),     t('mood_calendar.months.august'),
    t('mood_calendar.months.september'),t('mood_calendar.months.october'),
    t('mood_calendar.months.november'), t('mood_calendar.months.december'),
  ];

  const weeks          = useMemo(() => buildCalendar(year, month, trades), [year, month, trades]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  const s = makeStyles(colors);

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={10} style={s.arrowBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <CText txt={`${MONTHS[month]} ${year}`} style={[s.monthTitle, { color: colors.text }]} />
        <TouchableOpacity onPress={nextMonth} hitSlop={10} style={s.arrowBtn} disabled={isCurrentMonth}>
          <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={s.weekHeader}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[s.weekDay, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        weeks.map((week, wi) => (
          <View key={wi} style={s.weekRow}>
            {week.map((day, di) => <DayCell key={`${wi}-${di}`} day={day} colors={colors} />)}
          </View>
        ))
      )}

      <MonthlyStats trades={trades} year={year} month={month} colors={colors} />
      <Legend colors={colors} />
    </ScrollView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  scroll:     { paddingHorizontal: 16, paddingBottom: 40 },
  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  arrowBtn:   { padding: 6 },
  weekHeader: { flexDirection: 'row', paddingBottom: 6 },
  weekDay:    { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  weekRow:    { flexDirection: 'row' },
  loader:     { height: 180, alignItems: 'center', justifyContent: 'center' },
});
