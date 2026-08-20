import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import React from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, radius, shadow } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { Transaction } from '../../../core/types/transaction';

type RouteParams = { AssetClassDetailScreen: { assetClass: string; label: string } };

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AssetClassDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'AssetClassDetailScreen'>>();
  const { colors } = useTheme();
  const { transactions, isLoading } = useTransactions();
  const { assetClass, label } = route.params;

  // "Cash" and "Bank/Digital Cash" are INCOME-type categories (plain money
  // added), while the rest (Stocks, FD, Gold, …) are ASSET-type holdings —
  // match whichever type this assetClass's category actually belongs to.
  const filtered = transactions.filter(
    (tx) => (tx.type === 'ASSET' || tx.type === 'INCOME') && tx.category === assetClass,
  );

  const s = makeStyles(colors);

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => nav.navigate('EditTransactionScreen', { transaction: item })}
      style={[s.row, { backgroundColor: colors.surface }, shadow.card]}
    >
      <View style={[s.iconWrap, { backgroundColor: brandColors.greenBg }]}>
        <Ionicons name="arrow-up" size={16} color={brandColors.greenText} />
      </View>
      <View style={s.mid}>
        <CText txt={item.rawSummary || 'Asset added'} style={[s.summary, { color: colors.text }]} numberOfLines={2} />
        <CText txt={formatDate(item.timestamp)} style={[s.meta, { color: colors.textMuted }]} />
      </View>
      <CText txt={`+${formatINR(item.amount)}`} style={[s.amount, { color: brandColors.greenText }]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText txt={label} style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        ListEmptyComponent={!isLoading ? (
          <View style={s.empty}>
            <CText txt={`No ${label} transactions yet.`} style={{ color: colors.textMuted, fontSize: 13 }} />
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  list: { padding: 20, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1 },
  summary: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11 },
  amount: { fontSize: 14, fontWeight: '700' },
  empty: { paddingTop: 60, alignItems: 'center' },
});
