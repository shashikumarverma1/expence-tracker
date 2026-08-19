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
import { AppColors, colors as brandColors, radius, shadow } from '../../../core/utils';
import { useTransactions } from '../hooks/useTransactions';
import { useNetWorth } from '../hooks/useNetWorth';
import { Emotion, TransactionType, ASSET_FIELD_KEYS, NetWorth } from '../../../core/types/transaction';
import { useIsPro } from '../../subscription/hooks/useIsPro';
import { SubscriptionModal } from '../../subscription/screens/SubscriptionModal';
import { getExpoPushToken, saveExpoPushToken } from '../../notification/hook/expoPushToken';
import { useAuthStore } from '../../../core/store/auth/useAuthStore';
import { storage } from '../../../core/config/mmkv';

// ─── Config ──────────────────────────────────────────────────────

const TODAY_LABEL = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'short',
});

const EMOTION_COLOR: Record<Emotion, string> = {
  happy: brandColors.green, neutral: brandColors.purple, guilty: brandColors.red,
  stressed: brandColors.red, impulsive: brandColors.amber, proud: brandColors.green,
  worried: brandColors.amber, excited: brandColors.green,
};

const EMOTION_BG: Record<Emotion, string> = {
  happy: brandColors.greenBg, neutral: brandColors.purpleDim, guilty: brandColors.redBg,
  stressed: brandColors.redBg, impulsive: brandColors.amberBg, proud: brandColors.greenBg,
  worried: brandColors.amberBg, excited: brandColors.greenBg,
};

const TYPE_STYLE: Record<TransactionType, { bg: string; text: string; label: string; sign: '+' | '-' | '' }> = {
  ASSET:   { bg: brandColors.greenBg, text: brandColors.greenText, label: '📈 Asset',   sign: '+' },
  EXPENSE: { bg: brandColors.redBg,   text: brandColors.redText,   label: '🧾 Expense', sign: '-' },
};

// ─── Helpers ─────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function formatAmount(amount: number, currency = 'INR'): string {
  const sym = CURRENCY_SYMBOL[currency] ?? '₹';
  const abs = Math.abs(amount);
  let str: string;
  if (currency === 'INR') {
    str = abs >= 100000
      ? `${sym}${(abs / 100000).toFixed(abs % 100000 === 0 ? 0 : 1)}L`
      : abs >= 1000
      ? `${sym}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `${sym}${abs}`;
  } else {
    str = abs >= 1000000
      ? `${sym}${(abs / 1000000).toFixed(1)}M`
      : abs >= 1000
      ? `${sym}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}K`
      : `${sym}${abs}`;
  }
  return str;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
}

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

function NetWorthRing({ netWorth, colors }: { netWorth: NetWorth; colors: AppColors }) {
  const size = 76;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = ASSET_FIELD_KEYS
    .map((key, i) => ({ key, value: netWorth[key], color: RING_PALETTE[i % RING_PALETTE.length] }))
    .filter((r) => r.value > 0);
  const total = segments.reduce((sum, r) => sum + r.value, 0);

  let offset = 0;
  const s = makeStyles(colors);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={colors.border} strokeWidth={strokeWidth} fill="none"
          />
          {total > 0 && segments.map((seg) => {
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
      </View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        {segments.length === 0 ? (
          <CText txt="No assets recorded yet" style={[s.statLabel, { color: colors.textMuted }]} />
        ) : segments
          .slice()
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((seg) => (
            <View key={seg.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg.color, marginRight: 6 }} />
              <CText
                txt={`${RING_LABEL[seg.key] ?? seg.key} · ${formatAmount(seg.value)}`}
                style={[s.statLabel, { color: colors.text, fontSize: 12 }]}
                numberOfLines={1}
              />
            </View>
          ))}
      </View>
    </View>
  );
}

// ─── Mini entry card ─────────────────────────────────────────────

function MiniEntryCard({
  emotion, type, amount, currency, summary, timeLabel, onPress, colors,
}: {
  emotion:   Emotion;
  type:      TransactionType;
  amount:    number;
  currency?: string;
  summary:   string;
  timeLabel: string;
  onPress:   () => void;
  colors:    AppColors;
}) {
  const emotionColor = EMOTION_COLOR[emotion] ?? brandColors.purple;
  const emotionBg    = EMOTION_BG[emotion]    ?? brandColors.purpleDim;
  const ts = TYPE_STYLE[type];
  const s = makeStyles(colors);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.entryCard, { borderLeftColor: emotionColor }]}
    >
      <View style={s.entryTop}>
        <View style={[s.emotionChip, { backgroundColor: emotionBg }]}>
          <CText txt={emotion} style={[s.emotionTxt, { color: emotionColor }]} />
        </View>
        <View style={[s.resultChip, { backgroundColor: ts.bg }]}>
          <CText txt={ts.label} style={[s.resultTxt, { color: ts.text }]} />
        </View>
        <View style={[s.pnlBadge, { backgroundColor: ts.sign === '+' ? brandColors.greenBg : brandColors.redBg }]}>
          <CText
            txt={`${ts.sign}${formatAmount(amount, currency)}`}
            style={[s.pnlTxt, { color: ts.sign === '+' ? brandColors.greenText : brandColors.redText }]}
          />
        </View>
        <CText txt={timeLabel} style={[s.entryTime, { color: colors.textMuted }]} />
      </View>
      {!!summary && (
        <CText txt={summary} style={[s.entrySummary, { color: colors.text }]} />
      )}
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
  const isPro       = useIsPro();
  const [showPaywall, setShowPaywall] = useState(false);
  const [typeModal,   setTypeModal]   = useState(false);
  const [typedText,   setTypedText]   = useState('');

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

  const latest3    = transactions.slice(0, 3);
  const todayCount = transactions.filter((tx) => {
    const d  = new Date(tx.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth()      === now.getMonth()
      && d.getDate()       === now.getDate();
  }).length;

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

  const goToPatterns = () => nav.navigate('MainTabs', { screen: 'Patterns' });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <CText style={[s.appName, { color: colors.text }]}>SpendMood</CText>
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
          <NetWorthRing netWorth={netWorth} colors={colors} />
          <View style={{ alignItems: 'flex-end' }}>
            <CText style={[s.statValue, { color: colors.text, fontSize: 18 }]}>
              {`${netWorth.totalNetWorth < 0 ? '-' : ''}${formatAmount(netWorth.totalNetWorth)}`}
            </CText>
            <CText style={[s.statLabel, { color: colors.textMuted, fontSize: 11 }]}>
              net worth
            </CText>
            <CText style={[s.statLabel, { color: colors.textMuted, fontSize: 11 }]}>
              {todayCount} {todayCount === 1 ? 'entry' : 'entries'} today
            </CText>
          </View>
        </TouchableOpacity>

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

        {/* ── Recent entries ── */}
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <CText style={[s.recentTitle, { color: colors.textMuted }]}>
              {t('recent_entries.title').toUpperCase()}
            </CText>
            {latest3.length > 0 && (
              <TouchableOpacity onPress={goToPatterns} hitSlop={10}>
                <CText style={[s.viewAll, { color: colors.primary }]} tx="recent_entries.see_all" />
              </TouchableOpacity>
            )}
          </View>

          {latest3.length === 0 ? (
            <View style={s.emptyState}>
              <View style={[s.emptyIcon, { backgroundColor: colors.primaryDim }]}>
                <Ionicons name="journal-outline" size={28} color={colors.primary} />
              </View>
              <CText style={[s.emptyTitle, { color: colors.text }]} txt="No entries yet" />
              <CText style={[s.emptySub, { color: colors.textMuted }]} txt="Tap the mic and say what happened with your money." />
            </View>
          ) : latest3.map((tx) => (
            <MiniEntryCard
              key={tx.id}
              emotion={tx.emotion}
              type={tx.type}
              amount={tx.amount}
              currency={tx.currency}
              summary={tx.rawSummary}
              timeLabel={tx.createdAt ? formatTime(tx.createdAt) : ''}
              onPress={goToPatterns}
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

  emptyState:  { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon:   { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 15, fontWeight: '600' },
  emptySub:    { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  recentSection: { marginHorizontal: 20, marginTop: 4 },
  recentHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  recentTitle:   { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  viewAll:       { fontSize: 13, fontWeight: '600' },

  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, marginBottom: 10, borderLeftWidth: 3,
    ...shadow.card,
  },
  entryTop:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  emotionChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  emotionTxt:  { fontSize: 11, fontWeight: '700' },
  resultChip:  { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  resultTxt:   { fontSize: 11, fontWeight: '700' },
  pnlBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pnlTxt:      { fontSize: 11, fontWeight: '700' },
entryTime:   { marginLeft: 'auto', fontSize: 11 },
  entrySummary:{ fontSize: 13, lineHeight: 19 },
});
