import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, font, radius, shadow, formatCompactAmount } from '../../../core/utils';
import { useTransactions } from '../../home/hooks/useTransactions';

// ─── Helpers ─────────────────────────────────────────────────────

const formatAmount = formatCompactAmount;

function SLabel({ txt, colors }: { txt: string; colors: AppColors }) {
  const s = makeStyles(colors);
  return <CText txt={txt} style={[s.sectionLabel, { color: colors.textMuted }]} />;
}

function LegendDot({ color, label, colors }: { color: string; label: string; colors: AppColors }) {
  return (
    <View style={ps.legendItem}>
      <View style={[ps.legendDot, { backgroundColor: color }]} />
      <CText style={[ps.legendTxt, { color: colors.textMuted }]}>{label}</CText>
    </View>
  );
}

// ─── Shared report helpers ────────────────────────────────────────

function AnimatedBar({ value, color, delay = 0, colors }: { value: number; color: string; delay?: number; colors: AppColors }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 700, delay, useNativeDriver: false }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[rs.track, { backgroundColor: colors.border }]}>
      <Animated.View style={[rs.bar, { width, backgroundColor: color }]} />
    </View>
  );
}

function CardHeader({ label, labelColor, right, colors }: { label: string; labelColor: string; right: string; colors: AppColors }) {
  return (
    <View style={rs.cardHeader}>
      <CText txt={label} style={[rs.cardLabel, { color: labelColor }]} />
      <CText txt={right}  style={[rs.cardDate,  { color: colors.textMuted }]} />
    </View>
  );
}

// ─── Month ring (circular income/expense split) ───────────────────

function MonthRing({
  income, expense, size, isCurrent, colors,
}: {
  income: number;
  expense: number;
  size: number;
  isCurrent: boolean;
  colors: AppColors;
}) {
  const strokeWidth = isCurrent ? 5 : 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const total = income + expense;
  const incomeLen = total > 0 ? (income / total) * circumference : 0;
  const expenseLen = total > 0 ? (expense / total) * circumference : 0;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={r} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
        {incomeLen > 0 && (
          <Circle
            cx={center} cy={center} r={r}
            stroke={brandColors.greenText} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${incomeLen} ${circumference - incomeLen}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
        {expenseLen > 0 && (
          <Circle
            cx={center} cy={center} r={r}
            stroke={brandColors.redText} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={`${expenseLen} ${circumference - expenseLen}`}
            strokeDashoffset={-incomeLen}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>
    </View>
  );
}

// ─── Money flow card ───────────────────────────────────────────────

const MONTH_LABEL_FMT: Intl.DateTimeFormatOptions = { month: 'short' };

function useMoneyFlow() {
  const { transactions } = useTransactions();

  return React.useMemo(() => {
    const now = new Date();

    let monthIncome = 0;
    let monthExpense = 0;
    const categoryTotals = new Map<string, number>();

    // Last 6 calendar months, oldest first, including the current month.
    const months: { year: number; month: number; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('en-IN', MONTH_LABEL_FMT), income: 0, expense: 0 });
    }

    for (const tx of transactions) {
      const type = String(tx.type).toUpperCase();
      const d = new Date(tx.timestamp);
      const isThisMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      // Loan money isn't real income — it's borrowed, offset by an equal
      // liability — so it's excluded from the income/net figures here.
      const isIncome = type === 'INCOME' && tx.category !== 'Loan';

      if (isThisMonth) {
        if (isIncome) monthIncome += tx.amount;
        if (type === 'EXPENSE') {
          monthExpense += tx.amount;
          const cat = tx.category ?? 'Other';
          categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + tx.amount);
        }
      }

      const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (bucket) {
        if (isIncome) bucket.income += tx.amount;
        if (type === 'EXPENSE') bucket.expense += tx.amount;
      }
    }

    const categories = [...categoryTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    const sixMonthNet = months.reduce((sum, m) => sum + (m.income - m.expense), 0);

    return {
      monthIncome,
      monthExpense,
      net: monthIncome - monthExpense,
      categories,
      months,
      sixMonthNet,
      hasData: transactions.length > 0,
    };
  }, [transactions]);
}

function MoneyFlowCard({ colors }: { colors: AppColors }) {
  const { monthIncome, monthExpense, net, categories, months, sixMonthNet, hasData } = useMoneyFlow();
  const maxCategory = Math.max(1, ...categories.map((c) => c.amount));
  const netColor = net > 0 ? brandColors.greenText : net < 0 ? brandColors.redText : colors.textMuted;
  const sixMonthNetColor = sixMonthNet > 0 ? brandColors.greenText : sixMonthNet < 0 ? brandColors.redText : colors.textMuted;

  if (!hasData) {
    return (
      <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.border }, shadow.card]}>
        <View style={rs.lockedInner}>
          <View style={[rs.lockIcon, { backgroundColor: colors.primaryDim }]}>
            <Ionicons name="swap-vertical" size={24} color={colors.primary} />
          </View>
          <CText txt="Log a transaction to see your money flow" style={[rs.lockedTxt, { color: colors.textMuted }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[rs.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: brandColors.blue }, shadow.card]}>
      <CardHeader
        label="MONEY FLOW"
        labelColor={brandColors.blue}
        right={new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        colors={colors}
      />

      {/* Income / Expense / Net this month */}
      <View style={rs.chipRow}>
        <View style={[rs.statChip, { backgroundColor: brandColors.greenBg }]}>
          <CText txt={formatAmount(monthIncome)} style={[rs.statChipTxt, { color: brandColors.greenText }]} />
          <CText txt="income" style={[rs.statChipSub, { color: brandColors.greenText }]} />
        </View>
        <View style={[rs.statChip, { backgroundColor: brandColors.redBg }]}>
          <CText txt={formatAmount(monthExpense)} style={[rs.statChipTxt, { color: brandColors.redText }]} />
          <CText txt="expense" style={[rs.statChipSub, { color: brandColors.redText }]} />
        </View>
        <View style={[rs.statChip, { backgroundColor: net >= 0 ? brandColors.greenBg : brandColors.redBg }]}>
          <CText txt={`${net < 0 ? '-' : ''}${formatAmount(net)}`} style={[rs.statChipTxt, { color: netColor }]} />
          <CText txt="net" style={[rs.statChipSub, { color: netColor }]} />
        </View>
      </View>

      {/* Top expense categories this month */}
      {categories.length > 0 && (
        <>
          <View style={[rs.divider, { backgroundColor: colors.border }]} />
          <CText txt="Where it went" style={[rs.sectionHint, { color: colors.textMuted }]} />
          {categories.map((c, i) => (
            <View key={c.category} style={rs.behaviorRow}>
              <View style={rs.rowBetween}>
                <CText txt={c.category} style={[rs.rowLabel, { color: colors.textMuted }]} />
                <CText txt={formatAmount(c.amount)} style={[rs.rowValue, { color: colors.text }]} />
              </View>
              <AnimatedBar
                value={(c.amount / maxCategory) * 100}
                color={brandColors.red}
                delay={i * 80}
                colors={colors}
              />
            </View>
          ))}
        </>
      )}

      {/* 6-month income vs expense trend */}
      <View style={[rs.divider, { backgroundColor: colors.border }]} />
      <View style={rs.trendHeader}>
        <CText txt="Last 6 months" style={[rs.sectionHint, { color: colors.textMuted, marginBottom: 0 }]} />
        <CText
          txt={`${sixMonthNet < 0 ? '-' : ''}${formatAmount(sixMonthNet)} net`}
          style={[rs.trendNet, { color: sixMonthNetColor }]}
        />
      </View>

      <View style={[rs.trendCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={rs.trendRow}>
          {months.map((m, i) => {
            const isCurrent = i === months.length - 1;
            const hasData = m.income > 0 || m.expense > 0;
            return (
              <View key={i} style={rs.trendCol}>
                <MonthRing
                  income={m.income}
                  expense={m.expense}
                  size={isCurrent ? 44 : 36}
                  isCurrent={isCurrent}
                  colors={colors}
                />
                {isCurrent && hasData && (
                  <View style={rs.trendValues}>
                    {m.income > 0 && <CText txt={formatAmount(m.income)} style={[rs.trendValue, { color: brandColors.greenText }]} numberOfLines={1} />}
                    {m.expense > 0 && <CText txt={formatAmount(m.expense)} style={[rs.trendValue, { color: brandColors.redText }]} numberOfLines={1} />}
                  </View>
                )}
                <CText
                  txt={m.label}
                  style={[rs.trendLabel, { color: isCurrent ? colors.text : colors.textMuted, fontWeight: isCurrent ? '800' : '600' }]}
                />
              </View>
            );
          })}
        </View>
        <View style={[ps.legend, { marginBottom: 0, marginTop: 10, justifyContent: 'center' }]}>
          <LegendDot color={brandColors.greenText} label="Income" colors={colors} />
          <LegendDot color={brandColors.redText}   label="Expense" colors={colors} />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

export function PatternScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <View style={s.header}>
        <CText tx="pattern.title"           style={[s.title,    { color: colors.text }]} />
        <CText tx="pattern.subtitle_report" style={[s.subtitle, { color: colors.textMuted }]} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <SLabel txt="MONEY FLOW" colors={colors} />
        <MoneyFlowCard colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Report card styles ───────────────────────────────────────────

const rs = StyleSheet.create({
  card:           { borderRadius: radius.lg, padding: 16, marginBottom: 6, borderWidth: 1, borderLeftWidth: 3 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel:      { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  cardDate:       { fontSize: 12 },
  rowBetween:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rowLabel:       { fontSize: 13 },
  rowValue:       { fontSize: 13, fontWeight: '600' },
  track:          { height: 6, borderRadius: radius.full, overflow: 'hidden', marginBottom: 8 },
  bar:            { height: '100%' },
  behaviorRow:    { marginBottom: 2 },
  chipRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statChip:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  statChipTxt:    { fontSize: 20, fontWeight: '700' },
  statChipSub:    { fontSize: 11, fontWeight: '600', marginTop: 1 },
  divider:        { height: 1, marginVertical: 12 },
  sectionHint:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  lockedInner:    { alignItems: 'center', paddingVertical: 24, gap: 10 },
  lockIcon:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  lockedTxt:      { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  trendHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trendNet:      { fontSize: 11, fontWeight: '700' },
  trendCard:     { borderRadius: radius.md, borderWidth: 1, padding: 12, paddingTop: 14 },
  trendRow:      { flexDirection: 'row', alignItems: 'flex-end' },
  trendCol:      { alignItems: 'center', flex: 1, gap: 6 },
  trendValues:   { alignItems: 'center', marginTop: 4, minHeight: 14 },
  trendValue:    { fontSize: 9, fontWeight: '700' },
  trendLabel:    { fontSize: 11 },
});

// ─── Legend styles ────────────────────────────────────────────────

const ps = StyleSheet.create({
  legend:     { flexDirection: 'row', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 11, fontWeight: '600' },
});

// ─── Shared styles ────────────────────────────────────────────────

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:     { flex: 1 },
  header:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  title:    { fontSize: 24, ...font.bold },
  subtitle: { fontSize: 13, marginTop: 2 },
  content:  { paddingHorizontal: 20, paddingBottom: 48 },

  sectionLabel: {
    fontSize: 11, ...font.bold, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 10,
  },
});
