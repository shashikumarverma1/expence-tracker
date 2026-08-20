import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, colors as brandColors, radius, shadow, formatCompactAmount } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { useNetWorth } from '../hooks/useNetWorth';
import { useMonthlyBudget, setMonthlyBudget } from '../hooks/useMonthlyBudget';
import { ASSET_FIELD_KEYS, NetWorth, TransactionType } from '../../../core/types/transaction';
import { useIsPro } from '../../subscription/hooks/useIsPro';
import { SubscriptionModal } from '../../subscription/screens/SubscriptionModal';
import { getExpoPushToken, saveExpoPushToken } from '../../notification/hook/expoPushToken';
import { useAuthStore } from '../../../core/store/auth/useAuthStore';
import { storage } from '../../../core/config/mmkv';

// ─── Config ──────────────────────────────────────────────────────

const TODAY_LABEL = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'short',
});

// ─── Helpers ─────────────────────────────────────────────────────

const formatAmount = formatCompactAmount;

// ─── Net worth ring ──────────────────────────────────────────────

const RING_PALETTE = [
  brandColors.purple, brandColors.green, brandColors.amber, brandColors.blue,
  brandColors.red, '#4DA3FF', '#FF8A65', '#8D6E63', '#26A69A', '#AB47BC', '#78909C',
];

const RING_LABEL: Record<string, string> = {
  cash: 'Cash', digitalCash: 'Bank/Digital Cash', stocks: 'Stocks', bonds: 'Bonds',
  fd: 'FD', rd: 'RD', mutualFunds: 'Mutual Funds', crypto: 'Crypto',
  gold: 'Gold', realEstate: 'Real Estate', otherAssets: 'Other',
};

function NetWorthRing({
  netWorth, colors, onSelectAsset,
}: {
  netWorth: NetWorth;
  colors: AppColors;
  onSelectAsset: (assetClass: string, label: string) => void;
}) {
  const size = 112;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = ASSET_FIELD_KEYS
    .map((key, i) => ({ key, value: netWorth[key], color: RING_PALETTE[i % RING_PALETTE.length] }))
    .filter((r) => r.value > 0);

  // Loan money already sits inside cash/digitalCash above (it's real money
  // you have), but it's still owed — draw it as its own red slice too, so
  // the ring visually flags how much of the total is borrowed.
  const loanSegment = netWorth.liabilities > 0
    ? { key: 'loan', value: netWorth.liabilities, color: brandColors.red }
    : null;
  const ringSegments = loanSegment ? [...segments, loanSegment] : segments;
  const total = ringSegments.reduce((sum, r) => sum + r.value, 0);

  let offset = 0;
  const s = makeStyles(colors);

  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={colors.border} strokeWidth={strokeWidth} fill="none"
          />
          {total > 0 && ringSegments.map((seg) => {
            const segLen = (seg.value / total) * circumference;
            const dashArray = `${segLen} ${circumference - segLen}`;
            const dashOffset = -offset;
            offset += segLen;
            return (
              <Circle
                key={seg.key}
                cx={size / 2} cy={size / 2} r={radius}
                stroke={seg.color} strokeWidth={strokeWidth} fill="none"
                strokeDasharray={dashArray}
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
              txt={`${netWorth.totalNetWorth < 0 ? '-' : ''}${formatAmount(netWorth.totalNetWorth)}`}
              style={[s.statValue, { color: colors.text, fontSize: 15 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            <CText txt="net worth" style={[s.statLabel, { color: colors.textMuted, fontSize: 10 }]} />
          </View>
        </View>
      </View>
      <View style={{ marginLeft: 14, flex: 1 }}>
        {segments.length === 0 ? (
          <CText txt="No assets recorded yet" style={[s.statLabel, { color: colors.textMuted }]} />
        ) : segments
          .slice()
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
          .map((seg) => {
            const label = RING_LABEL[seg.key] ?? seg.key;
            return (
              <TouchableOpacity
                key={seg.key}
                onPress={() => onSelectAsset(label, label)}
                activeOpacity={0.6}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color, marginRight: 6 }} />
                <CText
                  txt={`${label} · ${formatAmount(seg.value)}`}
                  style={[s.statLabel, { color: colors.text, fontSize: 12 }]}
                  numberOfLines={1}
                />
              </TouchableOpacity>
            );
          })}
        {/* Loan money still shows as its own red slice in the ring (it's
            cash you have), but the center total above is true net worth
            (assets minus this), matching Dashboard/Net Worth screens. */}
        {loanSegment && (
          <TouchableOpacity
            onPress={() => onSelectAsset('Loan', 'Loan')}
            activeOpacity={0.6}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brandColors.red, marginRight: 6 }} />
            <CText
              txt={`Loan · ${formatAmount(loanSegment.value)}`}
              style={[s.statLabel, { color: brandColors.redText, fontSize: 12 }]}
              numberOfLines={1}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Budget bar ──────────────────────────────────────────────────

function BudgetBar({
  spent, budget, colors, onPress,
}: {
  spent:   number;
  budget:  number;
  colors:  AppColors;
  onPress: () => void;
}) {
  const s = makeStyles(colors);

  if (budget <= 0) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[s.budgetCard, s.budgetCardEmpty, { backgroundColor: colors.surface }, shadow.card]}
      >
        <View style={[s.budgetIconWrap, { backgroundColor: colors.primaryDim }]}>
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <CText style={[s.budgetTitle, { color: colors.text }]} tx="budget.set_cta" />
          <CText style={[s.budgetSub, { color: colors.textMuted }]} tx="budget.set_cta_sub" />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  const pct = Math.min(spent / budget, 1);
  const over = spent > budget;
  const barColor = over ? brandColors.redText : pct >= 0.8 ? brandColors.amberText : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.budgetCard, { backgroundColor: colors.surface }, shadow.card]}
    >
      <View style={s.budgetHeaderRow}>
        <CText style={[s.budgetTitle, { color: colors.text }]} tx="budget.title" />
        <CText
          txt={`${formatAmount(spent)} / ${formatAmount(budget)}`}
          style={[s.budgetAmounts, { color: over ? brandColors.redText : colors.textMuted }]}
        />
      </View>
      <View style={[s.budgetTrack, { backgroundColor: colors.border }]}>
        <View style={[s.budgetFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
      <CText
        style={[s.budgetSub, { color: over ? brandColors.redText : colors.textMuted, marginTop: 6 }]}
        txt={over
          ? `Over budget by ${formatAmount(spent - budget)}`
          : `${formatAmount(budget - spent)} left this month`}
      />
    </TouchableOpacity>
  );
}

// ─── Transaction row ─────────────────────────────────────────────

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const time = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}

const TX_ROW_STYLE: Record<TransactionType, { icon: React.ComponentProps<typeof Ionicons>['name']; bg: string; fg: string; sign: '+' | '-' | '' }> = {
  EXPENSE: { icon: 'arrow-down-outline', bg: brandColors.redBg,    fg: brandColors.redText,   sign: '-' },
  INCOME:  { icon: 'arrow-up-outline',   bg: brandColors.greenBg,  fg: brandColors.greenText, sign: '+' },
  ASSET:   { icon: 'trending-up-outline', bg: brandColors.blueBg,  fg: brandColors.blueText,  sign: '+' },
  OTHER:   { icon: 'ellipse-outline',    bg: brandColors.purpleDim, fg: brandColors.purple,   sign: '' },
};

function TransactionRow({
  type, amount, currency, category, summary, timeLabel, onPress, colors,
}: {
  type:      TransactionType;
  amount:    number;
  currency?: string;
  category:  string | null;
  summary:   string;
  timeLabel: string;
  onPress:   () => void;
  colors:    AppColors;
}) {
  const s = makeStyles(colors);
  const ts = TX_ROW_STYLE[type] ?? TX_ROW_STYLE.OTHER;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.expenseRow, { backgroundColor: colors.surface }]}>
      <View style={[s.expenseIcon, { backgroundColor: ts.bg }]}>
        <Ionicons name={ts.icon} size={16} color={ts.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <CText
          txt={category || summary || 'Entry'}
          style={[s.expenseTitle, { color: colors.text }]}
          numberOfLines={1}
        />
        {!!summary && category && (
          <CText txt={summary} style={[s.expenseSub, { color: colors.textMuted }]} numberOfLines={1} />
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <CText txt={`${ts.sign}${formatAmount(amount, currency)}`} style={[s.expenseAmount, { color: ts.fg }]} />
        <CText txt={timeLabel} style={[s.expenseTime, { color: colors.textMuted }]} numberOfLines={1} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

const BTN = 110;
const RING = BTN + 32;

export function HomeScreen() {
  const nav         = useNavigation<any>();
  const uid         = useAuthStore((s) => s.user?.uid);
  const { colors }  = useTheme();
  const { t }       = useTranslation();
  const { transactions } = useTransactions();
  const { netWorth }     = useNetWorth();
  const { monthlyBudget } = useMonthlyBudget();
  const isPro       = useIsPro();
  const [showPaywall, setShowPaywall] = useState(false);
  const [typeModal,   setTypeModal]   = useState(false);
  const [typedText,   setTypedText]   = useState('');
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  const s = makeStyles(colors);

  // ── Ask notification permission once on first HomeScreen visit ──
  useEffect(() => {
    (async () => {
      const asked = await storage.getAsync('notif_permission_asked');
      if (asked) return;
      await storage.set('notif_permission_asked', 'true');
      try {
        const token = await getExpoPushToken();
        if (token && uid) await saveExpoPushToken(uid, token);
      } catch {}
    })();
  }, []);

  const latest3Transactions = transactions.slice(0, 3);

  const monthSpent = transactions.reduce((sum, tx) => {
    if (String(tx.type).toUpperCase() !== 'EXPENSE') return sum;
    const d = new Date(tx.timestamp);
    const now = new Date();
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return sum;
    return sum + tx.amount;
  }, 0);

  const openBudgetModal = () => {
    setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : '');
    setBudgetModal(true);
  };

  const handleSaveBudget = async () => {
    const amt = parseFloat(budgetInput);
    if (!uid || isNaN(amt) || amt < 0) return;
    setSavingBudget(true);
    try {
      await setMonthlyBudget(uid, amt);
      setBudgetModal(false);
    } finally {
      setSavingBudget(false);
    }
  };

  // Pulsing ring animation
  const pulse        = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse,        { toValue: 1.35, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse,        { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, [pulse, pulseOpacity]);

  const FREE_LIMIT = 10;
  const hitLimit   = !isPro && transactions.length >= FREE_LIMIT;


  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <CText style={[s.appName, { color: colors.text }]}>Money Flow</CText>
            <CText style={[s.date,    { color: colors.textMuted }]}>{TODAY_LABEL}</CText>
          </View>
          <TouchableOpacity
            onPress={() => nav.navigate('DashboardScreen')}
            hitSlop={10}
            style={[s.dashboardBtn, { backgroundColor: colors.primaryDim }]}
          >
            <Ionicons name="grid-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Free limit banner ── */}
        {!isPro && (
          <View style={[s.limitBanner, { backgroundColor: colors.primaryDim }]}>
            <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
            <CText style={[s.limitTxt, { color: colors.primary }]}>
              {transactions.length < FREE_LIMIT
                ? t('home_screen.free_limit', { count: FREE_LIMIT - transactions.length })
                : t('home_screen.free_limit_reached')}
            </CText>
          </View>
        )}

        {/* ── Net worth card ── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => nav.navigate('NetWorthScreen')}
          style={[s.statCard, { backgroundColor: colors.surface }, shadow.card]}
        >
          <NetWorthRing
            netWorth={netWorth}
            colors={colors}
            onSelectAsset={(assetClass, label) => nav.navigate('AssetClassDetailScreen', { assetClass, label })}
          />
          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* ── Monthly budget ── */}
        <BudgetBar
          spent={monthSpent}
          budget={monthlyBudget}
          colors={colors}
          onPress={openBudgetModal}
        />

        {/* ── Record button ── */}
        <View style={s.recordArea}>
          <View style={s.recordWrapper}>
            <Animated.View
              style={[
                s.pulseRing,
                { borderColor: colors.primary, transform: [{ scale: pulse }], opacity: pulseOpacity },
              ]}
            />
            <TouchableOpacity
              onPress={() => nav.navigate('RecordingScreen')}
              activeOpacity={0.85}
              style={[s.recordBtn, { backgroundColor: colors.primaryDim }, shadow.button]}
            >
              <Ionicons name="mic" size={44} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <CText style={[s.recordHint, { color: colors.textMuted }]} tx="record_btn.tap_to_record" />

          <TouchableOpacity onPress={() => setTypeModal(true)} activeOpacity={0.7} hitSlop={10}>
            <CText style={[s.typeLink, { color: colors.primary }]} tx="home_screen.type_instead" />
          </TouchableOpacity>

          {hitLimit && (
            <TouchableOpacity
              onPress={() => setShowPaywall(true)}
              activeOpacity={0.85}
              style={[s.upgradeBtn, { backgroundColor: colors.primary }, shadow.button]}
            >
              <CText style={[s.upgradeTxt, { color: '#fff' }]}>
                {t('home_screen.free_limit_reached')}
              </CText>
            </TouchableOpacity>
          )}
        </View>

        <SubscriptionModal visible={showPaywall} onClose={() => setShowPaywall(false)} />

        {/* ── Type trade modal ── */}
        <Modal visible={typeModal} transparent animationType="slide" onRequestClose={() => setTypeModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { backgroundColor: colors.surface }]}>
              <CText style={[s.modalTitle, { color: colors.text }]}>
                {t('record_screen.title')}
              </CText>
              <CText style={[s.modalHint, { color: colors.textMuted }]}>
                {t('record_screen.speak_freely')}
              </CText>
              <TextInput
                style={[s.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder={t('record_screen.tap_to_start')}
                placeholderTextColor={colors.textMuted}
                multiline
                value={typedText}
                onChangeText={setTypedText}
                autoFocus
              />
              <View style={s.modalBtns}>
                <TouchableOpacity onPress={() => { setTypeModal(false); setTypedText(''); }} style={s.modalCancel}>
                  <CText style={{ color: colors.textMuted, fontWeight: '600' }} tx="cancel" />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!typedText.trim()}
                  onPress={() => {
                    const text = typedText.trim();
                    setTypeModal(false);
                    setTypedText('');
                    nav.navigate('ConfirmTransactionScreen', { transcript: text });
                  }}
                  style={[s.modalSubmit, { backgroundColor: colors.primary, opacity: typedText.trim() ? 1 : 0.4 }]}
                >
                  <CText style={{ color: '#fff', fontWeight: '700' }} tx="record_screen.continue" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Budget modal ── */}
        <Modal visible={budgetModal} transparent animationType="slide" onRequestClose={() => setBudgetModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalCard, { backgroundColor: colors.surface }]}>
              <CText style={[s.modalTitle, { color: colors.text }]} tx="budget.modal_title" />
              <CText style={[s.modalHint, { color: colors.textMuted }]} tx="budget.modal_hint" />
              <TextInput
                style={[s.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, minHeight: 0 }]}
                placeholder={t('budget.placeholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={budgetInput}
                onChangeText={setBudgetInput}
                autoFocus
              />
              <View style={s.modalBtns}>
                <TouchableOpacity onPress={() => setBudgetModal(false)} style={s.modalCancel}>
                  <CText style={{ color: colors.textMuted, fontWeight: '600' }} tx="cancel" />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={savingBudget || !budgetInput.trim()}
                  onPress={handleSaveBudget}
                  style={[s.modalSubmit, { backgroundColor: colors.primary, opacity: savingBudget || !budgetInput.trim() ? 0.4 : 1 }]}
                >
                  <CText style={{ color: '#fff', fontWeight: '700' }} tx="budget.save" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Transactions ── */}
        <View style={s.expenseSection}>
          <View style={s.expenseHeader}>
            <CText style={[s.expenseHeaderTitle, { color: colors.textMuted }]}>
              {t('transactions.title').toUpperCase()}
            </CText>
            {latest3Transactions.length > 0 && (
              <TouchableOpacity onPress={() => nav.navigate('TransactionListScreen')} hitSlop={10}>
                <CText style={[s.viewAll, { color: colors.primary }]} tx="transactions.see_all" />
              </TouchableOpacity>
            )}
          </View>

          {latest3Transactions.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primaryDim }]}>
                <Ionicons name="journal-outline" size={28} color={colors.primary} />
              </View>
              <CText style={[s.emptyTitle, { color: colors.text }]} tx="transactions.no_entries_title" />
              <CText style={[s.emptySub, { color: colors.textMuted }]} tx="transactions.no_entries_sub" />
            </View>
          ) : latest3Transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              type={tx.type}
              amount={tx.amount}
              currency={tx.currency}
              category={tx.category}
              summary={tx.rawSummary}
              timeLabel={tx.createdAt ? formatDateTime(tx.createdAt) : ''}
              onPress={() => nav.navigate('EditTransactionScreen', { transaction: tx })}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20,
  },
  appName: { fontSize: 26, fontWeight: '700', letterSpacing: 0.3 },
  date:    { fontSize: 13, marginTop: 2 },
  dashboardBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  limitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 24, marginBottom: 16,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
  },
  limitTxt: { fontSize: 12, fontWeight: '600', flex: 1 },

  statCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 24, marginBottom: 28,
    padding: 16, borderRadius: radius.lg,
  },
  statIcon:  { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 13, marginTop: 1 },

  budgetCard: {
    marginHorizontal: 24, marginBottom: 4,
    padding: 16, borderRadius: radius.lg,
  },
  budgetCardEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  budgetIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  budgetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  budgetTitle: { fontSize: 14, fontWeight: '700' },
  budgetAmounts: { fontSize: 13, fontWeight: '600' },
  budgetSub: { fontSize: 12 },
  budgetTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 4 },

  recordArea:   { alignItems: 'center', gap: 20, paddingVertical: 28 },
  recordWrapper:{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: RING, height: RING,
    borderRadius: radius.full, borderWidth: 2,
  },
  recordBtn: {
    width: BTN, height: BTN, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  recordHint: { fontSize: 15, fontWeight: '500' },
  typeLink:   { fontSize: 13, fontWeight: '600', marginTop: -10 },
  upgradeBtn: { marginTop: 4, paddingHorizontal: 28, paddingVertical: 12, borderRadius: radius.xl },
  upgradeTxt: { fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard:    { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 36 },
  modalTitle:   { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalHint:    { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  textInput: {
    borderWidth: 1, borderRadius: radius.md, padding: 12,
    fontSize: 14, minHeight: 110, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtns:   { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalSubmit: { borderRadius: radius.md, paddingHorizontal: 20, paddingVertical: 10 },

  expenseSection: { marginHorizontal: 20, marginTop: 4 },
  expenseHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  expenseHeaderTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  viewAll:        { fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon:  { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub:   { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radius.lg, padding: 12, marginBottom: 10,
    ...shadow.card,
  },
  expenseIcon:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  expenseTitle:  { fontSize: 14, fontWeight: '600' },
  expenseSub:    { fontSize: 12, marginTop: 1 },
  expenseAmount: { fontSize: 14, fontWeight: '700' },
  expenseTime:   { fontSize: 11, marginTop: 1 },
});
