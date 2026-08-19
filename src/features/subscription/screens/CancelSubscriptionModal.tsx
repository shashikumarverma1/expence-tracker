import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../../core/hook';
import CText from '../../../core/component/CText';
import { AppColors } from '../../../core/utils';

interface Props {
  visible:          boolean;
  planPrice:        string | null;
  accepting:        boolean;
  onAcceptDiscount: () => void;
  onCancelAnyway:   () => void;
  onDismiss:        () => void;
}

export function CancelSubscriptionModal({
  visible,
  planPrice,
  accepting,
  onAcceptDiscount,
  onCancelAnyway,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const discountedPrice = planPrice ? computeDiscount(planPrice) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={s.overlay} onPress={onDismiss}>
        <Pressable style={s.sheet} onPress={() => {}}>

          {/* Drag handle */}
          <View style={s.handle} />

          {/* Hero block */}
          <View style={[s.hero, { backgroundColor: colors.primaryDim, borderColor: colors.primary }]}>
            {/* Badge */}
            <View style={[s.badge, { backgroundColor: colors.primary }]}>
              <CText style={s.badgeTxt}>LIMITED OFFER</CText>
            </View>

            <CText style={s.heroEmoji}>🎁</CText>

            <CText style={[s.headline, { color: colors.text }]}>
              Wait! Before you go...
            </CText>

            <CText style={[s.offerLine, { color: colors.primary }]}>
              Get 30% off for 3 months
            </CText>

            {/* Price row inside hero */}
            <View style={s.priceRow}>
              {discountedPrice && (
                <CText style={[s.priceNew, { color: colors.primary }]}>
                  {discountedPrice}
                </CText>
              )}
              {planPrice && (
                <CText style={s.priceOld}>
                  {planPrice}
                </CText>
              )}
              <CText style={[s.pricePer, { color: colors.textMuted }]}>/month</CText>
            </View>

            <CText style={[s.priceSub, { color: colors.textMuted }]}>
              Then {planPrice ?? 'regular price'}/month after 3 months
            </CText>
          </View>

          {/* Perks */}
          <View style={s.perks}>
            {[
              'Keep all your journal entries & streaks',
              'Continue AI insights & weekly reports',
              'Cancel anytime after the discount period',
            ].map((perk) => (
              <View key={perk} style={s.perkRow}>
                <CText style={[s.perkCheck, { color: colors.primary }]}>✓</CText>
                <CText style={[s.perkTxt, { color: colors.textMuted }]}>{perk}</CText>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            style={[s.acceptBtn, { backgroundColor: colors.primary }, accepting && s.disabled]}
            onPress={onAcceptDiscount}
            disabled={accepting}
          >
            {accepting
              ? <ActivityIndicator color="#fff" size="small" />
              : <CText style={s.acceptTxt}>Get 30% off 🎉</CText>
            }
          </Pressable>

          {/* Cancel anyway */}
          <Pressable style={s.cancelBtn} onPress={onCancelAnyway} disabled={accepting}>
            <CText style={[s.cancelTxt, { color: colors.textMuted }]}>
              Cancel anyway → Manage subscription
            </CText>
          </Pressable>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

function parsePrice(s: string): number {
  if (s.includes('.') && s.includes(',')) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))
      : parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) {
    const after = s.split(',').pop() ?? '';
    return after.length === 2
      ? parseFloat(s.replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

function computeDiscount(price: string): string | null {
  const match = price.match(/([^\d]*)(\d[\d,.]*)(\D*)/);
  if (!match) return null;
  const [, prefix, num, suffix] = match;
  const discounted = (parsePrice(num) * 0.7).toFixed(2);
  return `${prefix}${discounted}${suffix}`;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },

  hero: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 4,
  },
  badgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },
  heroEmoji: { fontSize: 40, lineHeight: 48 },

  headline: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  offerLine: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },

  priceRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  priceNew:  { fontSize: 32, fontWeight: '900' },
  priceOld:  { fontSize: 16, color: '#9CA3AF', textDecorationLine: 'line-through' },
  pricePer:  { fontSize: 14 },
  priceSub:  { fontSize: 12, textAlign: 'center' },

  perks:    { width: '100%', gap: 10, paddingHorizontal: 4 },
  perkRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  perkCheck:{ fontSize: 15, fontWeight: '700', lineHeight: 20 },
  perkTxt:  { fontSize: 14, flex: 1, lineHeight: 20 },

  acceptBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  acceptTxt: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },
  disabled:  { opacity: 0.6 },

  cancelBtn: { paddingVertical: 8, alignItems: 'center', width: '100%' },
  cancelTxt: { fontSize: 13, textDecorationLine: 'underline', textAlign: 'center' },
});
