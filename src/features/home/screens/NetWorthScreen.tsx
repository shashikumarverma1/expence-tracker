import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, radius, shadow, formatCompactINR } from '../../../core/utils';
import { useNetWorth } from '../hooks/useNetWorth';
import { ASSET_FIELD_KEYS, NetWorth } from '../../../core/types/transaction';

// ── Asset field -> display label + icon ─────────────────────────
const ASSET_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cash:        { label: 'Cash',            icon: 'cash-outline' },
  digitalCash: { label: 'Bank/Digital Cash', icon: 'card-outline' },
  stocks:      { label: 'Stocks',          icon: 'trending-up-outline' },
  bonds:       { label: 'Bonds',           icon: 'document-text-outline' },
  fd:          { label: 'FD',              icon: 'lock-closed-outline' },
  rd:          { label: 'RD',              icon: 'calendar-outline' },
  mutualFunds: { label: 'Mutual Funds',    icon: 'pie-chart-outline' },
  crypto:      { label: 'Crypto',          icon: 'logo-bitcoin' },
  gold:        { label: 'Gold',            icon: 'star-outline' },
  realEstate:  { label: 'Real Estate',     icon: 'home-outline' },
  otherAssets: { label: 'Other',           icon: 'ellipsis-horizontal-outline' },
};

// Maps a netWorth field key back to the assetClass label stored on transactions
// (used when navigating to the filtered transaction list for that class).
export const FIELD_TO_ASSET_CLASS: Record<string, string> = {
  cash: 'Cash', digitalCash: 'Bank/Digital Cash', stocks: 'Stocks', bonds: 'Bonds',
  fd: 'FD', rd: 'RD', mutualFunds: 'Mutual Funds', crypto: 'Crypto',
  gold: 'Gold', realEstate: 'Real Estate', otherAssets: 'Other',
};

const PALETTE = [
  brandColors.purple, brandColors.green, brandColors.amber, brandColors.blue,
  brandColors.red, '#4DA3FF', '#FF8A65', '#8D6E63', '#26A69A', '#AB47BC', '#78909C',
];

const formatINR = formatCompactINR;

export function NetWorthScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { netWorth, isLoading } = useNetWorth();
  const s = makeStyles(colors);

  const rows = ASSET_FIELD_KEYS
    .map((key, i) => ({
      key,
      value: (netWorth as unknown as NetWorth)[key as keyof NetWorth] as number,
      meta: ASSET_META[key],
      color: PALETTE[i % PALETTE.length],
    }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const assetsVsLiab = netWorth.totalAssets + netWorth.liabilities;
  const assetsPct = assetsVsLiab > 0 ? netWorth.totalAssets / assetsVsLiab : 0.5;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText txt="Net Worth" style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Total net worth ── */}
        <View style={[s.totalCard, { backgroundColor: colors.surface }, shadow.card]}>
          <CText txt="Total Net Worth" style={s.totalLabel} />
          <CText
            txt={formatINR(netWorth.totalNetWorth)}
            style={[s.totalValue, { color: netWorth.totalNetWorth < 0 ? brandColors.redText : colors.text }]}
          />
        </View>

        {/* ── Assets vs Liabilities bar ── */}
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card]}>
          <View style={s.rowBetween}>
            <CText txt={`Assets · ${formatINR(netWorth.totalAssets)}`} style={[s.smallLabel, { color: brandColors.greenText }]} />
            <CText txt={`Liabilities · ${formatINR(netWorth.liabilities)}`} style={[s.smallLabel, { color: brandColors.redText }]} />
          </View>
          <View style={s.splitBarBg}>
            <View style={[s.splitBarFill, { width: `${Math.max(4, assetsPct * 100)}%`, backgroundColor: brandColors.green }]} />
          </View>
        </View>

        {/* ── Asset breakdown ── */}
        <CText txt="ASSET BREAKDOWN" style={s.sectionLabel} />
        {isLoading ? (
          <CText txt="Loading…" style={s.muted} />
        ) : rows.length === 0 ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <CText txt="No assets recorded yet. Add one by voice — e.g. “5000 ka stock khareeda”." style={s.muted} />
          </View>
        ) : rows.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={[s.assetRow, { backgroundColor: colors.surface }, shadow.card]}
            activeOpacity={0.8}
            onPress={() => nav.navigate('AssetClassDetailScreen', {
              assetClass: FIELD_TO_ASSET_CLASS[r.key],
              label: r.meta.label,
            })}
          >
            <View style={[s.assetIcon, { backgroundColor: r.color + '22' }]}>
              <Ionicons name={r.meta.icon} size={18} color={r.color} />
            </View>
            <View style={s.assetMid}>
              <CText txt={r.meta.label} style={[s.assetLabel, { color: colors.text }]} />
              <View style={s.assetBarBg}>
                <View style={[s.assetBarFill, { width: `${(Math.abs(r.value) / maxAbs) * 100}%`, backgroundColor: r.color }]} />
              </View>
            </View>
            <CText
              txt={formatINR(r.value)}
              style={[s.assetValue, { color: r.value < 0 ? brandColors.redText : colors.text }]}
            />
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {/* ── Liabilities ── */}
        <CText txt="LIABILITIES" style={s.sectionLabel} />
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card]}>
          <View style={s.rowBetween}>
            <CText txt="Total outstanding debt" style={[s.assetLabel, { color: colors.text }]} />
            <CText txt={formatINR(netWorth.liabilities)} style={[s.assetValue, { color: brandColors.redText }]} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  scroll: { padding: 20, paddingBottom: 48 },

  totalCard: { borderRadius: radius.lg, padding: 20, alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  totalValue: { fontSize: 34, fontWeight: '800', marginTop: 6 },

  card: { borderRadius: radius.lg, padding: 16, marginBottom: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  smallLabel: { fontSize: 12, fontWeight: '700' },
  splitBarBg: { height: 10, borderRadius: 6, backgroundColor: brandColors.redBg, overflow: 'hidden' },
  splitBarFill: { height: 10, borderRadius: 6 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 },
  muted: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  assetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  assetMid: { flex: 1 },
  assetLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  assetBarBg: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  assetBarFill: { height: 5, borderRadius: 3 },
  assetValue: { fontSize: 14, fontWeight: '700' },
});
