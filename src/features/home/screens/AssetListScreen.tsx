import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { TransactionGroupedList } from '../components/TransactionGroupedList';

export function AssetListScreen() {
  const nav = useNavigation<any>();
  const { colors, brand: brandColors } = useTheme();
  const { transactions } = useTransactions();
  const s = makeStyles(colors);

  // This is the net-worth-detail view: anything that adds to what you have
  // (real holdings like Stocks/FD/Gold, plus Cash/Bank/Salary/Loan/etc. under
  // INCOME) belongs here. EXPENSE (money leaving) and OTHER (doesn't affect
  // net worth) are excluded.
  const assets = useMemo(
    () => transactions.filter((tx) => {
      const type = String(tx.type).toUpperCase();
      return type === 'ASSET' || type === 'INCOME';
    }),
    [transactions],
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <CText tx="assets.screen_title" style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <TransactionGroupedList
        transactions={assets}
        colors={colors}
        brandColors={brandColors}
        onPressItem={(tx) => nav.navigate('EditTransactionScreen', { transaction: tx })}
        emptyIcon="trending-up-outline"
        emptyTitleTx="assets.no_entries_title"
        emptySubTx="assets.no_entries_sub"
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
