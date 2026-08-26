import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import CText from '../../../core/component/CText';
import { AppColors, getBrandColors, radius, shadow } from '../../../core/utils';

type BrandColors = ReturnType<typeof getBrandColors>;
import { isAssetType, Transaction, TransactionType } from '../../../core/types/transaction';

// Legacy docs written before OLD_ASSET/NEW_ASSET/SOLD_ASSET existed still
// carry type "ASSET" — treat those as OLD_ASSET (their original behavior).
function normalizeType(type: TransactionType): TransactionType {
  return (type as string) === 'ASSET' ? 'OLD_ASSET' : type;
}
import { useBalanceVisibility } from '../../../core/store/balance/useBalanceVisibility';

const BALANCE_MASK = '••••••';
const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function formatAmount(amount: number, currency = 'INR'): string {
  const sym = CURRENCY_SYMBOL[currency] ?? '₹';
  return `${sym}${Math.abs(amount).toLocaleString('en-IN')}`;
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const time = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getTypeStyle(brandColors: BrandColors): Record<TransactionType, { icon: React.ComponentProps<typeof Ionicons>['name']; bg: string; fg: string; sign: '+' | '-' | '' }> {
  return {
    // `sign` here is the row's own display sign (does this holding go up or
    // down) — separate from whether it counts toward the day's net-worth-
    // changing total, which groupByMonthThenDay computes on its own using
    // NET_CONTRIBUTES below (NEW_ASSET/SOLD_ASSET are reallocations between
    // cash and a holding, so they never change net worth even though the
    // row itself still shows a +/- for that holding).
    EXPENSE:    { icon: 'arrow-down-outline',    bg: brandColors.redBg,     fg: brandColors.redText,   sign: '-' },
    INCOME:     { icon: 'arrow-up-outline',      bg: brandColors.greenBg,  fg: brandColors.greenText, sign: '+' },
    OLD_ASSET:  { icon: 'trending-up-outline',   bg: brandColors.blueBg,    fg: brandColors.blueText,  sign: '+' },
    NEW_ASSET:  { icon: 'trending-up-outline',   bg: brandColors.blueBg,    fg: brandColors.blueText,  sign: '+' },
    SOLD_ASSET: { icon: 'trending-down-outline', bg: brandColors.blueBg,    fg: brandColors.blueText,  sign: '-' },
    OTHER:      { icon: 'ellipse-outline',       bg: brandColors.purpleDim, fg: brandColors.purple,    sign: '' },
  };
}

// NEW_ASSET/SOLD_ASSET move money between cash and a holding — a pure
// reallocation that never changes net worth, so they don't contribute to
// the day's running "net" total shown in the section header.
const NET_NEUTRAL_TYPES: readonly TransactionType[] = ['NEW_ASSET', 'SOLD_ASSET'];

// Two-level grouping (month → day) flattened into SectionList sections.
type DaySection = { title: string; monthTitle: string; net: number; hasAsset: boolean; data: Transaction[] };

function groupByMonthThenDay(
  items: Transaction[],
  typeStyle: Record<TransactionType, { sign: '+' | '-' | '' }>,
): DaySection[] {
  const sections: DaySection[] = [];
  let currentMonthKey = '';
  let currentDayKey = '';

  for (const tx of items) {
    const monthKey = monthLabel(tx.timestamp);
    const dayKey = dayLabel(tx.timestamp);

    if (monthKey !== currentMonthKey || dayKey !== currentDayKey) {
      sections.push({ title: dayKey, monthTitle: monthKey, net: 0, hasAsset: false, data: [] });
      currentMonthKey = monthKey;
      currentDayKey = dayKey;
    }

    const section = sections[sections.length - 1];
    section.data.push(tx);
    const type = normalizeType(tx.type);
    const sign = typeStyle[type]?.sign;
    if (!NET_NEUTRAL_TYPES.includes(type)) {
      section.net += sign === '-' ? -tx.amount : sign === '+' ? tx.amount : 0;
    }
    if (isAssetType(type)) section.hasAsset = true;
  }

  return sections;
}

export function TransactionGroupedList({
  transactions, colors, brandColors, onPressItem, emptyIcon, emptyTitleTx, emptySubTx, header,
}: {
  transactions: Transaction[];
  colors: AppColors;
  brandColors: BrandColors;
  onPressItem: (tx: Transaction) => void;
  emptyIcon: React.ComponentProps<typeof Ionicons>['name'];
  emptyTitleTx: string;
  emptySubTx: string;
  header?: React.ReactElement | null;
}) {
  const s = makeStyles(colors);
  const TYPE_STYLE = getTypeStyle(brandColors);
  const sections = useMemo(() => groupByMonthThenDay(transactions, TYPE_STYLE), [transactions, brandColors]);
  const hidden = useBalanceVisibility((st) => st.hidden);

  let lastMonthTitle = '';

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={s.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => {
        const showMonth = section.monthTitle !== lastMonthTitle;
        lastMonthTitle = section.monthTitle;
        const netColor = section.net > 0 ? brandColors.greenText : section.net < 0 ? brandColors.redText : colors.textMuted;
        const netSign = section.net > 0 ? '+' : section.net < 0 ? '-' : '';
        return (
          <View>
            {showMonth && (
              <CText txt={section.monthTitle.toUpperCase()} style={[s.monthHeader, { color: colors.textMuted }]} />
            )}
            <View style={s.dayHeader}>
              <CText txt={section.title} style={[s.dayHeaderTitle, { color: colors.text }]} />
              {section.net !== 0 && (
                <CText
                  txt={hidden && section.hasAsset ? BALANCE_MASK : `${netSign}${formatAmount(section.net)}`}
                  style={[s.dayHeaderTotal, { color: netColor }]}
                />
              )}
            </View>
          </View>
        );
      }}
      renderItem={({ item }) => {
        const itemType = normalizeType(item.type);
        const ts = TYPE_STYLE[itemType] ?? TYPE_STYLE.OTHER;
        return (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPressItem(item)}
            style={[s.row, { backgroundColor: colors.surface }, shadow.card]}
          >
            <View style={[s.iconWrap, { backgroundColor: ts.bg }]}>
              <Ionicons name={ts.icon} size={16} color={ts.fg} />
            </View>
            <View style={s.mid}>
              <CText
                txt={isAssetType(itemType) && hidden ? BALANCE_MASK : (item.category || item.rawSummary || 'Entry')}
                style={[s.summary, { color: colors.text }]}
                numberOfLines={1}
              />
              {!(isAssetType(itemType) && hidden) && !!item.rawSummary && item.category && (
                <CText txt={item.rawSummary} style={[s.meta, { color: colors.textMuted }]} numberOfLines={1} />
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <CText
                txt={isAssetType(itemType) && hidden ? BALANCE_MASK : `${ts.sign}${formatAmount(item.amount, item.currency)}`}
                style={[s.amount, { color: ts.fg }]}
              />
              <CText txt={formatDateTime(item.timestamp)} style={[s.time, { color: colors.textMuted }]} numberOfLines={1} />
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={(
        <View style={s.empty}>
          <View style={[s.emptyIcon, { backgroundColor: colors.primaryDim }]}>
            <Ionicons name={emptyIcon} size={28} color={colors.primary} />
          </View>
          <CText tx={emptyTitleTx} style={[s.emptyTitle, { color: colors.text }]} />
          <CText tx={emptySubTx} style={[s.emptySub, { color: colors.textMuted }]} />
        </View>
      )}
    />
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  list: { padding: 20, paddingBottom: 48 },

  monthHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, marginTop: 4,
  },
  dayHeaderTitle: { fontSize: 13, fontWeight: '600' },
  dayHeaderTotal: { fontSize: 13, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1 },
  summary: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11 },
  amount: { fontSize: 14, fontWeight: '700' },
  time: { fontSize: 11, marginTop: 1 },

  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
