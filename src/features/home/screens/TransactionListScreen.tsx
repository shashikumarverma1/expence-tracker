import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, radius, shadow, formatCompactAmount } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionGroupedList } from '../components/TransactionGroupedList';

const formatAmount = formatCompactAmount;

function IncomeExpenseRing({
  income, loan, expense, colors,
}: {
  income: number;
  loan:   number;
  expense: number;
  colors: AppColors;
}) {
  const size = 128;
  const strokeWidth = 14;
  const radiusPx = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusPx;

  const totalIncome = income + loan; // shown in the center — all money in
  const total = income + loan + expense; // drives the arc proportions

  const slices = [
    { value: income,  color: brandColors.greenText },
    { value: loan,    color: brandColors.red },
    { value: expense, color: brandColors.redText },
  ].filter((s) => s.value > 0);

  const s = makeStyles(colors);
  let offset = 0;

  return (
    <View style={[s.ringCard, { backgroundColor: colors.surface }, shadow.card]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2} cy={size / 2} r={radiusPx}
            stroke={colors.border} strokeWidth={strokeWidth} fill="none"
          />
          {total > 0 && slices.map((slice, i) => {
            const segLen = (slice.value / total) * circumference;
            const dashOffset = -offset;
            offset += segLen;
            return (
              <Circle
                key={i}
                cx={size / 2} cy={size / 2} r={radiusPx}
                stroke={slice.color} strokeWidth={strokeWidth} fill="none"
                strokeDasharray={`${segLen} ${circumference - segLen}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
            <CText
              txt={formatAmount(totalIncome)}
              style={[s.netAmount, { color: brandColors.greenText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <CText txt="total income" style={[s.netLabel, { color: colors.textMuted }]} />
          </View>
        </View>
      </View>

      <View style={{ marginLeft: 16, flex: 1 }}>
        <View style={s.legendRow}>
          <View style={[s.legendDot, { backgroundColor: brandColors.greenText }]} />
          <CText txt="Income" style={[s.legendLabel, { color: colors.text }]} />
          <CText txt={formatAmount(income)} style={[s.legendAmount, { color: brandColors.greenText }]} />
        </View>
        {loan > 0 && (
          <View style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: brandColors.red }]} />
            <CText txt="Loan" style={[s.legendLabel, { color: colors.text }]} />
            <CText txt={formatAmount(loan)} style={[s.legendAmount, { color: brandColors.red }]} />
          </View>
        )}
        <View style={s.legendRow}>
          <View style={[s.legendDot, { backgroundColor: brandColors.redText }]} />
          <CText txt="Expense" style={[s.legendLabel, { color: colors.text }]} />
          <CText txt={formatAmount(expense)} style={[s.legendAmount, { color: brandColors.redText }]} />
        </View>
      </View>
    </View>
  );
}

export function TransactionListScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { transactions } = useTransactions();
  const s = makeStyles(colors);

  // Income = INCOME-type transactions (salary, freelance, gifts, or plain
  // cash/bank added), tracked separately from "Loan" — borrowed money that's
  // still money coming in (counted in the center total) but isn't profit,
  // so it gets its own slice/line instead of being folded into Income.
  // ASSET (stocks, FD, gold, …) is a separate holdings bucket, not counted here.
  const { income, loan, expense } = useMemo(() => {
    let inc = 0, ln = 0, exp = 0;
    for (const tx of transactions) {
      const type = String(tx.type).toUpperCase();
      if (type === 'INCOME') {
        if (tx.category === 'Loan') ln += tx.amount;
        else inc += tx.amount;
      }
      if (type === 'EXPENSE') exp += tx.amount;
    }
    return { income: inc, loan: ln, expense: exp };
  }, [transactions]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText tx="transactions.screen_title" style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <TransactionGroupedList
        transactions={transactions}
        colors={colors}
        onPressItem={(tx) => nav.navigate('EditTransactionScreen', { transaction: tx })}
        emptyIcon="journal-outline"
        emptyTitleTx="transactions.no_entries_title"
        emptySubTx="transactions.no_entries_sub"
        header={<IncomeExpenseRing income={income} loan={loan} expense={expense} colors={colors} />}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },

  ringCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.lg, padding: 16, marginBottom: 16,
  },
  netAmount: { fontSize: 16, fontWeight: '700' },
  netLabel:  { fontSize: 11, marginTop: 1 },

  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLabel: { fontSize: 13, flex: 1 },
  legendAmount: { fontSize: 13, fontWeight: '700' },
});
