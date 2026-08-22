import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, updateDoc } from 'firebase/firestore';
import CText from '../../../core/component/CText';
import { auth, db } from '../../../core/config';
import { collections } from '../../../core/enum/eCollections';
import { useAuthStore } from '../../../core/store';

// ─── Branding (fixed — this intro is its own dark brand surface,
//     independent of the app's light/dark theme) ────────────────
const BG           = '#0F172A';
const ACCENT       = '#2DD4BF';
const ICON_BG      = '#134E4A';
const TEXT_PRIMARY = '#F1F5F9';
const TEXT_SECOND  = '#94A3B8';
const DOT_ACTIVE   = '#2DD4BF';
const DOT_INACTIVE = '#334155';

const SCREEN_W = Dimensions.get('window').width;

type Slide = {
  icon: React.ComponentProps<typeof Ionicons>['name'] | null;
  headline: string;
  subtext: string;
  cta?: true;
};

const SLIDES: Slide[] = [
  {
    icon: 'swap-vertical-outline',
    headline: 'Welcome to Money Flow',
    subtext: 'Track every expense in and out — no spreadsheets, no typing.',
  },
  {
    icon: 'mic-outline',
    headline: 'Just say it, we log it',
    subtext: 'Speak a purchase and Money Flow categorizes it for you.',
  },
  {
    icon: 'water-outline',
    headline: 'Find the leaks in your money pipeline',
    subtext: 'Spot silent drains — subscriptions, impulse buys, small habits that add up.',
  },
  {
    icon: null,
    headline: 'Ready to stop the leaks?',
    subtext: 'Set your first budget and start tracking today.',
    cta: true,
  },
];

const LAST_INDEX = SLIDES.length - 1;

function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

// ─── Dots ────────────────────────────────────────────────────────

function Dots({ index }: { index: number }) {
  return (
    <View style={s.dotsRow}>
      {SLIDES.map((_, i) => (
        <View
          key={i}
          style={[
            s.dot,
            i === index ? s.dotActive : s.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

// ─── Slide ───────────────────────────────────────────────────────

function SlideView({ slide, onGetStarted }: { slide: Slide; onGetStarted: () => void }) {
  return (
    <View style={s.slide}>
      {slide.icon && (
        <View style={s.iconWrap}>
          <Ionicons name={slide.icon} size={26} color={ACCENT} />
        </View>
      )}
      <CText style={s.headline}>{slide.headline}</CText>
      <CText style={s.subtext}>{slide.subtext}</CText>

      {slide.cta && (
        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onGetStarted}>
          <CText style={s.ctaTxt}>Get started</CText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────

export function MoneyFlowIntroScreen({ onDone }: { onDone: () => void }) {
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const reduceMotionRef = useRef(false);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { reduceMotionRef.current = !!v; })
      .catch(() => {});
  }, []);

  const finish = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      updateDoc(doc(db, collections.users, uid), { onboardingCompleted: true }).catch(() => {});
    }
    // Flip the store immediately so the overlay hides right away, instead of
    // waiting on the Firestore onSnapshot round-trip.
    useAuthStore.getState().setOnboardingCompleted(true);
    onDone();
  }, [onDone]);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(LAST_INDEX, i));
    listRef.current?.scrollToOffset({
      offset: clamped * SCREEN_W,
      animated: !reduceMotionRef.current,
    });
  }, []);

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== index) {
      setIndex(next);
      tap();
    }
  }, [index]);

  const handleTapAdvance = useCallback(() => {
    if (index < LAST_INDEX) goTo(index + 1);
  }, [index, goTo]);

  const handleSkip = useCallback(() => {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    goTo(LAST_INDEX);
  }, [goTo]);

  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe}>
        {index < LAST_INDEX && (
          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} hitSlop={12}>
            <CText style={s.skipTxt}>Skip</CText>
          </TouchableOpacity>
        )}

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item, index: i }) => (
            <Pressable
              style={{ width: SCREEN_W }}
              onPress={i < LAST_INDEX ? handleTapAdvance : undefined}
            >
              <SlideView slide={item} onGetStarted={finish} />
            </Pressable>
          )}
        />

        <Dots index={index} />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },

  skipBtn: {
    position: 'absolute', top: 8, right: 20, zIndex: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  skipTxt: { fontSize: 14, fontWeight: '600', color: TEXT_SECOND },

  slide: {
    width: SCREEN_W, flex: 1,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: ICON_BG,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  headline: {
    fontSize: 17, fontWeight: '500', color: TEXT_PRIMARY,
    textAlign: 'center', marginBottom: 10,
  },
  subtext: {
    fontSize: 13, lineHeight: 13 * 1.6, color: TEXT_SECOND,
    textAlign: 'center', maxWidth: 280,
  },

  ctaBtn: {
    marginTop: 32, backgroundColor: ACCENT,
    paddingHorizontal: 36, paddingVertical: 16,
    borderRadius: 999,
  },
  ctaTxt: { fontSize: 16, fontWeight: '700', color: BG },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingBottom: 28,
  },
  dot: { height: 4, borderRadius: 2 },
  dotActive:   { width: 18, backgroundColor: DOT_ACTIVE },
  dotInactive: { width: 6,  backgroundColor: DOT_INACTIVE },
});
