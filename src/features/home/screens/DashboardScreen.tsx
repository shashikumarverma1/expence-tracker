import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, radius, shadow, formatCompactINR } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { useNetWorth } from '../hooks/useNetWorth';
import { Emotion } from '../../../core/types/transaction';
import { useBalanceVisibility } from '../../../core/store/balance/useBalanceVisibility';

const BALANCE_MASK = '••••••';

const EMOTION_EMOJI: Record<Emotion, string> = {
  happy: '😊', neutral: '😐', guilty: '😔', stressed: '😰',
  impulsive: '⚡', proud: '😌', worried: '😟', excited: '🤩',
};

const CATEGORY_PALETTE = [
  brandColors.purple, brandColors.red, brandColors.amber, brandColors.blue,
  brandColors.green, '#8D6E63', '#AB47BC', '#78909C', '#FF8A65', '#26A69A', '#4DA3FF',
];

const formatINR = formatCompactINR;

function isThisMonth(ms: number): boolean {
  const d = new Date(ms);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const MONTH_LABEL = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export function DashboardScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const { transactions } = useTransactions();
  const { netWorth } = useNetWorth();
  const hidden = useBalanceVisibility((st) => st.hidden);
  const toggleHidden = useBalanceVisibility((st) => st.toggle);
  const s = makeStyles(colors);

  const stats = useMemo(() => {
    const thisMonth = transactions.filter((tx) => isThisMonth(tx.timestamp));

    let totalIncome = 0;
    let totalExpense = 0;
    let expenseCount = 0;
    let loansThisMonth = 0;
    const byCategory = new Map<string, number>();
    const emotionOnExpense = new Map<Emotion, number>();

    for (const tx of thisMonth) {
      const type = String(tx.type).toUpperCase();
      if (type === 'INCOME') {
        // Loan money isn't real income/profit — it's borrowed, offset by an
        // equal liability — so it's tracked separately, not in totalIncome.
        if (tx.category === 'Loan') {
          loansThisMonth += tx.amount;
        } else {
          totalIncome += tx.amount;
        }
      }
      if (type === 'EXPENSE') {
        totalExpense += tx.amount;
        expenseCount += 1;
        const cat = tx.category ?? 'Other';
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + tx.amount);
        emotionOnExpense.set(tx.emotion, (emotionOnExpense.get(tx.emotion) ?? 0) + 1);
      }
    }

    // Loans taken all-time — mirrors netWorth.liabilities (the only source
    // of liabilities today is a "Loan" income entry), broken out by name.
    let totalLoans = 0;
    for (const tx of transactions) {
      if (String(tx.type).toUpperCase() === 'INCOME' && tx.category === 'Loan') {
        totalLoans += tx.amount;
      }
    }

    const categories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], i) => ({ category, amount, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }));

    const topEmotion = [...emotionOnExpense.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense,
      categories,
      topEmotion,
      expenseCount,
      loansThisMonth,
      totalLoans,
    };
  }, [transactions]);

  const maxCategoryAmount = Math.max(1, ...stats.categories.map((c) => c.amount));
  const assetsVsLiab = netWorth.totalAssets + netWorth.liabilities;
  const assetsPct = assetsVsLiab > 0 ? netWorth.totalAssets / assetsVsLiab : 0.5;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <CText txt="Dashboard" style={s.title} />
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Total net worth ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.navigate('NetWorthScreen')}
          style={[s.totalCard, { backgroundColor: colors.surface }, shadow.card]}
        >
          <TouchableOpacity
            onPress={toggleHidden}
            hitSlop={10}
            style={[s.eyeBtn, { backgroundColor: colors.primaryDim }]}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
          </TouchableOpacity>
          <CText txt="Total Net Worth" style={s.totalLabel} />
          <CText
            txt={hidden ? BALANCE_MASK : formatINR(netWorth.totalNetWorth)}
            style={[s.totalValue, { color: netWorth.totalNetWorth < 0 ? brandColors.redText : colors.text }]}
          />
          <View style={s.rowCenter}>
            <CText txt="View breakdown" style={[s.linkTxt, { color: colors.primary }]} />
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* ── This month: income / expense / savings ── */}
        <CText txt={`THIS MONTH · ${MONTH_LABEL.toUpperCase()}`} style={s.sectionLabel} />
        <View style={s.threeCol}>
          <View style={[s.miniCard, { backgroundColor: colors.surface }, shadow.card]}>
            <Ionicons name="arrow-down-circle-outline" size={18} color={brandColors.greenText} />
            <CText txt={formatINR(stats.totalIncome)} style={[s.miniValue, { color: brandColors.greenText }]} />
            <CText txt="Income" style={s.miniLabel} />
            {stats.loansThisMonth > 0 && (
              <CText txt={`incl. ${formatINR(stats.loansThisMonth)} loan`} style={s.loanHint} />
            )}
          </View>
          <View style={[s.miniCard, { backgroundColor: colors.surface }, shadow.card]}>
            <Ionicons name="arrow-up-circle-outline" size={18} color={brandColors.redText} />
            <CText txt={formatINR(stats.totalExpense)} style={[s.miniValue, { color: brandColors.redText }]} />
            <CText txt="Expense" style={s.miniLabel} />
          </View>
          <View style={[s.miniCard, { backgroundColor: colors.surface }, shadow.card]}>
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <CText
              txt={formatINR(stats.netSavings)}
              style={[s.miniValue, { color: stats.netSavings >= 0 ? colors.text : brandColors.redText }]}
            />
            <CText txt="Net Savings" style={s.miniLabel} />
          </View>
        </View>

        {/* ── Top expense category ── */}
        <CText txt="TOP EXPENSE CATEGORIES" style={s.sectionLabel} />
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card]}>
          {stats.categories.length === 0 ? (
            <CText txt="No expenses logged this month yet." style={s.muted} />
          ) : stats.categories.slice(0, 5).map((c) => (
            <View key={c.category} style={s.catRow}>
              <View style={s.catTop}>
                <CText txt={c.category} style={[s.catLabel, { color: colors.text }]} />
                <CText txt={formatINR(c.amount)} style={[s.catAmount, { color: colors.text }]} />
              </View>
              <View style={s.catBarBg}>
                <View style={[s.catBarFill, { width: `${(c.amount / maxCategoryAmount) * 100}%`, backgroundColor: c.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* ── Top emotion ── */}
        <CText txt="TOP SPENDING EMOTION" style={s.sectionLabel} />
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card, s.rowCenterStart]}>
          {stats.topEmotion ? (
            <>
              <CText txt={EMOTION_EMOJI[stats.topEmotion[0]]} style={s.emojiLg} />
              <View style={{ flex: 1 }}>
                <CText txt={stats.topEmotion[0]} style={[s.catLabel, { color: colors.text, textTransform: 'capitalize' }]} />
                <CText
                  txt={`${stats.topEmotion[1]} of ${stats.expenseCount} expense entries this month`}
                  style={s.muted}
                />
              </View>
            </>
          ) : (
            <CText txt="No emotion signal yet this month." style={s.muted} />
          )}
        </View>

        {/* ── Assets vs liabilities ── */}
        <CText txt="ASSETS VS LIABILITIES" style={s.sectionLabel} />
        <View style={[s.card, { backgroundColor: colors.surface }, shadow.card]}>
          <View style={s.catTop}>
            <CText txt={`Assets · ${hidden ? BALANCE_MASK : formatINR(netWorth.totalAssets)}`} style={[s.miniLabel, { color: brandColors.greenText }]} />
            <CText txt={`Liabilities · ${hidden ? BALANCE_MASK : formatINR(netWorth.liabilities)}`} style={[s.miniLabel, { color: brandColors.redText }]} />
          </View>
          <View style={s.splitBarBg}>
            <View style={[s.splitBarFill, { width: `${Math.max(4, assetsPct * 100)}%`, backgroundColor: brandColors.green }]} />
          </View>
          {stats.totalLoans > 0 && (
            <View style={s.loanRow}>
              <Ionicons name="cash-outline" size={14} color={brandColors.redText} />
              <CText txt="Total loans taken" style={[s.muted, { flex: 1 }]} />
              <CText txt={hidden ? BALANCE_MASK : formatINR(stats.totalLoans)} style={[s.catAmount, { color: brandColors.redText }]} />
            </View>
          )}
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

  totalCard: { borderRadius: radius.lg, padding: 20, alignItems: 'center', marginBottom: 20 },
  eyeBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  totalLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  totalValue: { fontSize: 32, fontWeight: '800', marginTop: 6, marginBottom: 8 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkTxt: { fontSize: 13, fontWeight: '600' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: 10 },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  threeCol: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniCard: { flex: 1, borderRadius: radius.lg, padding: 12, alignItems: 'flex-start', gap: 4 },
  miniValue: { fontSize: 15, fontWeight: '800' },
  miniLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  card: { borderRadius: radius.lg, padding: 16, marginBottom: 20 },
  catRow: { marginBottom: 12 },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catLabel: { fontSize: 13, fontWeight: '600' },
  catAmount: { fontSize: 13, fontWeight: '700' },
  catBarBg: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  catBarFill: { height: 6, borderRadius: 3 },

  rowCenterStart: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emojiLg: { fontSize: 34 },

  splitBarBg: { height: 10, borderRadius: 6, backgroundColor: brandColors.redBg, overflow: 'hidden' },
  splitBarFill: { height: 10, borderRadius: 6 },

  loanRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  loanHint: { fontSize: 10, color: brandColors.redText, fontWeight: '600', marginTop: 1 },
});
