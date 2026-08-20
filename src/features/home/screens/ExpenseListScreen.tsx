import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionGroupedList } from '../components/TransactionGroupedList';

export function ExpenseListScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { transactions } = useTransactions();
  const s = makeStyles(colors);

  const expenses = useMemo(
    () => transactions.filter((tx) => String(tx.type).toUpperCase() === 'EXPENSE'),
    [transactions],
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <CText tx="expenses.screen_title" style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <TransactionGroupedList
        transactions={expenses}
        colors={colors}
        onPressItem={(tx) => nav.navigate('EditTransactionScreen', { transaction: tx })}
        emptyIcon="receipt-outline"
        emptyTitleTx="expenses.no_entries_title"
        emptySubTx="expenses.no_entries_sub"
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
});
