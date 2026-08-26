import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import React from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, radius, shadow } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { isAssetType, Transaction, TransactionType } from '../../../core/types/transaction';
import { useBalanceVisibility } from '../../../core/store/balance/useBalanceVisibility';

type RouteParams = { AssetClassDetailScreen: { assetClass: string; label: string } };

const BALANCE_MASK = '••••••';

function formatINR(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AssetClassDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'AssetClassDetailScreen'>>();
  const { colors, brand: brandColors } = useTheme();
  const { transactions, isLoading } = useTransactions();
  const { assetClass, label } = route.params;
  const hidden = useBalanceVisibility((s) => s.hidden);

  // Legacy docs written before OLD_ASSET/NEW_ASSET/SOLD_ASSET existed still
  // carry type "ASSET" — treat those as OLD_ASSET (their original behavior).
  const normalizeType = (type: TransactionType): TransactionType =>
    (type as string) === 'ASSET' ? 'OLD_ASSET' : type;

  // "Cash" and "Bank/Digital Cash" are INCOME-type categories (plain money
  // added), while the rest (Stocks, FD, Gold, …) are asset-type holdings —
  // match whichever type this assetClass's category actually belongs to.
  const filtered = transactions.filter(
    (tx) => (isAssetType(normalizeType(tx.type)) || tx.type === 'INCOME') && tx.category === assetClass,
  );

  const s = makeStyles(colors);

  const renderItem = ({ item }: { item: Transaction }) => {
    const isSold = normalizeType(item.type) === 'SOLD_ASSET';
    const isAsset = isAssetType(normalizeType(item.type));
    const sign = isSold ? '-' : '+';
    const color = isSold ? brandColors.redText : brandColors.greenText;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => nav.navigate('EditTransactionScreen', { transaction: item })}
        style={[s.row, { backgroundColor: colors.surface }, shadow.card]}
      >
        <View style={[s.iconWrap, { backgroundColor: isSold ? brandColors.redBg : brandColors.greenBg }]}>
          <Ionicons name={isSold ? 'arrow-down' : 'arrow-up'} size={16} color={color} />
        </View>
        <View style={s.mid}>
          <CText
            txt={isAsset && hidden ? BALANCE_MASK : (item.rawSummary || 'Asset added')}
            style={[s.summary, { color: colors.text }]}
            numberOfLines={2}
          />
          <CText txt={formatDate(item.timestamp)} style={[s.meta, { color: colors.textMuted }]} />
        </View>
        <CText
          txt={isAsset && hidden ? BALANCE_MASK : `${sign}${formatINR(item.amount)}`}
          style={[s.amount, { color }]}
        />
      </TouchableOpacity>
    );
  };

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
