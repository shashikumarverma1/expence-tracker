import React, { useCallback, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Reanimated, {
  useSharedValue, withTiming, runOnJS, useAnimatedStyle,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SubscriptionModal } from '../../subscription/screens/SubscriptionModal';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import CText from '../../../core/component/CText';
import { CButton } from '../../../core/component/Button';
import { useTheme } from '../../../core/hook';
import { AppColors, font, radius, shadow } from '../../../core/utils';
import { colors as brandColors } from '../../../core/utils/themes/colors';
import { useAuthStore } from '../../../core/store';
import { auth, db } from '../../../core/config';
import { collections } from '../../../core/enum/eCollections';
import { storage } from '../../../core/config/mmkv';
import { getExpoPushToken, saveExpoPushToken } from '../../notification/hook/expoPushToken';

// ─── MMKV keys ───────────────────────────────────────────────────

export const ONBOARDING_KEYS = {
  marketType: 'market_type',
  brokerName: 'broker_name',
  complete:   'onboarding_complete',
} as const;

// ─── Data ────────────────────────────────────────────────────────

type MarketType = 'Indian F&O' | 'US Stocks' | 'Crypto' | 'Forex';

const MARKETS: MarketType[] = ['Indian F&O', 'US Stocks', 'Crypto', 'Forex'];

const MARKET_EMOJI: Record<MarketType, string> = {
  'Indian F&O': '📊',
  'US Stocks':  '🇺🇸',
  'Crypto':     '₿',
  'Forex':      '💱',
};

const BROKERS: Record<MarketType, string[]> = {
  'Indian F&O': ['Zerodha', 'Upstox', 'Angel One', 'Other'],
  'US Stocks':  ['Robinhood', 'Webull', 'Schwab', 'Other'],
  'Crypto':     ['Binance', 'Coinbase', 'Bybit', 'Other'],
  'Forex':      ['OANDA', 'IC Markets', 'Exness', 'Other'],
};

type Step = 'market' | 'broker';
const STEPS: Step[] = ['market', 'broker'];

// ─── Tag chip ─────────────────────────────────────────────────────

function TagChip({
  label, emoji, selected, onPress, colors,
}: {
  label:    string;
  emoji?:   string;
  selected: boolean;
  onPress:  () => void;
  colors:   AppColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.chip,
        {
          borderColor:     selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryDim : colors.surface,
        },
        selected && shadow.card,
      ]}
    >
      {emoji ? <Text style={s.chipEmoji}>{emoji}</Text> : null}
      <CText style={[s.chipLabel, { color: selected ? colors.primary : colors.text }, selected && font.semiBold]}>
        {label}
      </CText>
      {selected && (
        <View style={[s.check, { backgroundColor: colors.primary }]}>
          <Text style={s.checkMark}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Step 1 — Market ─────────────────────────────────────────────

function Step1Market({ value, onChange, colors }: {
  value:    MarketType | '';
  onChange: (v: MarketType) => void;
  colors:   AppColors;
}) {
  return (
    <View style={s.stepWrap}>
      <CText style={[s.stepLabel, { color: colors.primary }]}>Welcome to TradeLog</CText>
      <CText style={[s.headline, { color: colors.text }]}>What do you trade?</CText>
      <CText style={[s.subtext, { color: colors.textMuted }]}>Pick your primary market</CText>
      <View style={s.grid}>
        {MARKETS.map((m) => (
          <TagChip key={m} label={m} emoji={MARKET_EMOJI[m]}
            selected={value === m} onPress={() => onChange(m)} colors={colors} />
        ))}
      </View>
    </View>
  );
}

// ─── Step 2 — Broker ─────────────────────────────────────────────

function Step2Broker({ market, value, customBroker, onChange, onCustomChange, colors }: {
  market:         MarketType;
  value:          string;
  customBroker:   string;
  onChange:       (v: string) => void;
  onCustomChange: (v: string) => void;
  colors:         AppColors;
}) {
  const brokers = BROKERS[market] ?? BROKERS['Indian F&O'];
  const otherSelected = value === 'Other';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={s.stepWrap}>
        <CText style={[s.stepLabel, { color: colors.primary }]}>Step 2 of 2</CText>
        <CText style={[s.headline, { color: colors.text }]}>Your broker?</CText>
        <CText style={[s.subtext, { color: colors.textMuted }]}>
          For context only — no login needed
        </CText>
        <View style={s.grid}>
          {brokers.map((b) => (
            <TagChip key={b} label={b}
              selected={value === b} onPress={() => onChange(b)} colors={colors} />
          ))}
        </View>

        {/* "Other" text input — slides in when Other is selected */}
        {otherSelected && (
          <TextInput
            style={[s.otherInput, {
              borderColor:     colors.primary,
              backgroundColor: colors.surface,
              color:           colors.text,
            }]}
            placeholder="Type your broker name…"
            placeholderTextColor={colors.textMuted}
            value={customBroker}
            onChangeText={onCustomChange}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

export function TradeLogOnboardingScreen() {
  const { colors } = useTheme();
  const setOnboardingCompleted = useAuthStore((s) => s.setOnboardingCompleted);

  const [stepIndex,     setStepIndex]     = useState(0);
  const [market,        setMarket]        = useState<MarketType | ''>('');
  const [broker,        setBroker]        = useState('');
  const [customBroker,  setCustomBroker]  = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);

  const slideOpacity = useSharedValue(1);
  const slideStyle   = useAnimatedStyle(() => ({ opacity: slideOpacity.value }));

  const step = STEPS[stepIndex];

  const transition = useCallback((toIndex: number) => {
    slideOpacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(setStepIndex)(toIndex);
      slideOpacity.value = withTiming(1, { duration: 200 });
    });
  }, [slideOpacity]);

  const handleMarketChange = (v: MarketType) => {
    setMarket(v);
    setBroker('');
    setCustomBroker('');
    storage.set(ONBOARDING_KEYS.marketType, v);
  };

  const handleBrokerChange = (v: string) => {
    setBroker(v);
    if (v !== 'Other') setCustomBroker('');
    // save actual broker name — resolved on save
  };

  const handleCustomBrokerChange = (v: string) => {
    setCustomBroker(v);
  };

  // Resolved broker name: if "Other" use the custom text
  const resolvedBroker = broker === 'Other' ? customBroker.trim() : broker;

  const finishOnboarding = useCallback(async () => {
    const uid = auth.currentUser?.uid;

    storage.set(ONBOARDING_KEYS.brokerName, resolvedBroker);
    storage.set(ONBOARDING_KEYS.complete, 'true');

    if (uid) {
      updateDoc(doc(db, collections.users, uid), {
        onboardingCompleted:   true,
        onboardingCompletedAt: serverTimestamp(),
        onboarding: {
          marketType: market,
          brokerName: resolvedBroker,
        },
      }).catch(() => {});
    }

    setOnboardingCompleted(true);
  }, [setOnboardingCompleted, market, resolvedBroker]);

  const handleNext = useCallback(() => {
    if (step === 'market') {
      transition(1);
    } else if (step === 'broker') {
      Keyboard.dismiss();
      setShowPaywall(true);
    }
  }, [step, transition]);

  const canProceed =
    step === 'market' ? market !== ''
    : broker !== '' && (broker !== 'Other' || customBroker.trim() !== '');

  const TOTAL_DOTS = 2;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={s.safe}>

        {/* ── Dot indicator ── */}
        <View style={s.dots}>
          {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === stepIndex
                  ? { width: 18, backgroundColor: brandColors.purple }
                  : { width: 6,  backgroundColor: brandColors.purpleDim },
              ]}
            />
          ))}
        </View>

        {/* ── Animated step content ── */}
        <Reanimated.View style={[s.content, slideStyle]}>
          {step === 'market' && (
            <Step1Market value={market} onChange={handleMarketChange} colors={colors} />
          )}
          {step === 'broker' && (
            <Step2Broker
              market={market as MarketType}
              value={broker}
              customBroker={customBroker}
              onChange={handleBrokerChange}
              onCustomChange={handleCustomBrokerChange}
              colors={colors}
            />
          )}
        </Reanimated.View>

        {/* ── Bottom button ── */}
        <View style={s.bottom}>
          <CButton onPress={handleNext} size="lg" disabled={!canProceed} txt="Continue" />
        </View>

        {/* ── Existing paywall modal ── */}
        <SubscriptionModal
          visible={showPaywall}
          onClose={() => {
            setShowPaywall(false);
            finishOnboarding();
          }}
        />

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  dots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingTop: 16, paddingBottom: 8,
  },
  dot: { height: 6, borderRadius: 3 },

  content: { flex: 1, paddingHorizontal: 24 },

  stepWrap: { flex: 1, paddingTop: 36 },

  stepLabel: {
    fontSize: 12, ...font.bold, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 12,
  },
  headline: {
    fontSize: 30, ...font.bold, letterSpacing: -0.5,
    lineHeight: 38, marginBottom: 8,
  },
  subtext: {
    fontSize: 15, ...font.regular, lineHeight: 22, marginBottom: 32,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  chip: {
    width: '47%', borderWidth: 1.5, borderRadius: radius.lg,
    paddingVertical: 18, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 14, ...font.medium, flex: 1 },
  check: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '700' },

  otherInput: {
    marginTop: 16, borderWidth: 1.5, borderRadius: radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, ...font.medium,
  },

  bottom: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12 },
});
