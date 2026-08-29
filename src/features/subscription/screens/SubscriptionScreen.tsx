import React, { memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/core';
import { useSubscription } from '../hooks';

import { CButton } from '../../../core/component';
import CText from '../../../core/component/CText';
import { useTheme } from '../../../core/hook';
import { AppColors, radius, shadow } from '../../../core/utils';


interface SubscriptionScreenProps {
  onClose?:          () => void;
  isRetentionOffer?: boolean;
}

function parsePrice(s: string): number {
  // Both separators present — whichever comes last is the decimal
  if (s.includes('.') && s.includes(',')) {
    return s.lastIndexOf('.') > s.lastIndexOf(',')
      ? parseFloat(s.replace(/,/g, ''))
      : parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Only comma — decimal if exactly 2 digits follow, otherwise thousands
  if (s.includes(',')) {
    const after = s.split(',').pop() ?? '';
    return after.length === 2
      ? parseFloat(s.replace(',', '.'))
      : parseFloat(s.replace(/,/g, ''));
  }
  return parseFloat(s);
}

function applyDiscount(price: string): string {
  const match = price.match(/([^\d]*)(\d[\d,.]*)(\D*)/);
  if (!match) return price;
  const [, prefix, num, suffix] = match;
  const discounted = (parsePrice(num) * 0.7).toFixed(2);
  return `${prefix}${discounted}${suffix}`;
}

const SubscriptionScreen = ({ onClose, isRetentionOffer: isRetentionOfferProp = false }: SubscriptionScreenProps = {}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = React.useContext(NavigationContext);
  const route      = React.useContext(NavigationRouteContext) as any;
  const styles     = makeStyles(colors);

  // isRetentionOffer can come from route params (stack nav) or prop (modal/onboarding)
  const isRetentionOffer: boolean = route?.params?.isRetentionOffer ?? isRetentionOfferProp;
  const routePlanType: string | undefined = route?.params?.planType;

  // Resolve initial tier from planType param so the correct price shows from the first render
  const initialTier = routePlanType === 'annual' ? 1 : 0;

  const dismiss = () => { onClose ? onClose() : navigation?.goBack(); };

  const {
    loading,
    handlePurchase,
    handleAcceptDiscount,
    handleRestore,
    FEATURES,
    purchasing,
    cancellingSubscription,
    PLANS,
    COMPARISON_PLANS,
    purchaseMode,
    selectedTier,
    selectTier,
    offerings,
    trialEligible,
    FALLBACK_PRICE,
  } = useSubscription(dismiss, isRetentionOffer ? initialTier : 0);

  const onPurchase   = isRetentionOffer ? handleAcceptDiscount : handlePurchase;
  const isPurchasing = isRetentionOffer ? cancellingSubscription : purchasing;

  // Resolve RC package for a plan
  const getRcPackage = (planId: string) =>
    offerings?.availablePackages?.find(
      (p: any) =>
        p.identifier.toLowerCase().includes(planId) ||
        p.product?.identifier?.toLowerCase().includes(planId)
    ) ?? null;

  // Live store price, falling back to the bundled price when offerings fail to load
  const priceFor = (planId: string): string =>
    getRcPackage(planId)?.product?.priceString ?? FALLBACK_PRICE?.[planId] ?? '—';

  // Show discounted prices only in retention offer mode — use real RC price as base
  const displayPlans = isRetentionOffer
    ? PLANS.map((p) => {
        const rcPrice: string | null = getRcPackage(p.id)?.product?.priceString ?? null;
        return { ...p, price: rcPrice ? applyDiscount(rcPrice) : p.price };
      })
    : PLANS;

  const selectedPlan = displayPlans[selectedTier];
  const selectedRcPrice: string | null = getRcPackage(PLANS[selectedTier]?.id)?.product?.priceString ?? null;

  const bottomLabel = isRetentionOffer
    ? `Get 30% off — ${selectedPlan?.price ?? ''}`
    : purchaseMode === 'subscription'
      ? t('subscription.btn_subscribe', { price: selectedRcPrice ?? selectedPlan?.price ?? '' })
      : t('subscription.btn_buy', { name: selectedPlan?.name ?? '', price: selectedRcPrice ?? selectedPlan?.price ?? '' });

  const termsText =
    purchaseMode === 'subscription'
      ? t('subscription.terms_recurring')
      : t('subscription.terms_one_time');

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const ListHeader = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <View style={styles.micIcon}>
            <View style={styles.micBody} />
            <View style={styles.micBase} />
            <View style={styles.micStand} />
          </View>
        </View>
        <CText size="xxl" weight="bold" color={colors.text} style={styles.title} tx="subscription.title" />
        <CText size="sm" color={colors.textMuted} style={styles.subtitle} tx="subscription.subtitle" />
      </View>

      {/* Retention offer price block — only shown when isRetentionOffer is true */}
      {isRetentionOffer && PLANS[selectedTier] ? (() => {
        const originalPlan    = PLANS[selectedTier];
        const isYearly        = originalPlan.id === 'yearly';
        const period          = isYearly ? 'year' : 'month';
        const rcPrice: string = priceFor(originalPlan.id);
        const discountedPrice = rcPrice !== '—' ? applyDiscount(rcPrice) : null;
        return (
          <View style={[styles.discountPriceBlock, { backgroundColor: colors.primaryDim, borderColor: colors.primary }]}>
            <View style={[styles.discountBadge, { backgroundColor: colors.primary }]}>
              <CText style={styles.discountBadgeTxt}>30% OFF · LIMITED OFFER</CText>
            </View>
            <View style={styles.discountPriceRow}>
              <CText style={[styles.discountPriceNew, { color: colors.primary }]}>
                {discountedPrice ?? '—'}
              </CText>
              <CText style={styles.discountPriceOld}>
                {rcPrice ?? '—'}
              </CText>
            </View>
            <CText style={[styles.discountPriceSub, { color: colors.textMuted }]}>
              per {period} · First 3 months, then {rcPrice ?? ''}/{period}
            </CText>
          </View>
        );
      })() : null}

      {/* Plan cards — hidden in retention offer mode */}
      {!isRetentionOffer && <View style={styles.planRow}>
        {displayPlans.map((plan, idx) => {
          const isSelected = selectedTier === idx;
          const realPrice: string = priceFor(plan.id);
          const period = plan.id === 'yearly' ? '/yr' : '/mo';
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, isSelected && styles.planCardSelected]}
              onPress={() => selectTier(idx)}
              activeOpacity={0.8}
            >
              {plan.badge && (
                <View style={styles.badge}>
                  <CText size="xs" weight="bold" color={colors.black}>
                    {plan.badge}
                  </CText>
                </View>
              )}
              <CText
                size="sm"
                weight="semiBold"
                color={isSelected ? colors.primary : colors.textMuted}
                numberOfLines={1}
              >
                {plan.name}
              </CText>
              <CText
                size="xl"
                weight="bold"
                color={isSelected ? colors.primary : colors.text}
                style={styles.planPrice}
              >
                {realPrice}{period}
              </CText>
              {trialEligible && (
                <CText
                  size="xs"
                  color={isSelected ? colors.primary : colors.textMuted}
                  style={{ textAlign: 'center', marginTop: 2 }}
                >
                  3-day free trial
                </CText>
              )}
            </TouchableOpacity>
          );
        })}
      </View>}

      {/* Table column header */}
      <View style={[styles.tableRow, styles.tableHeader]}>
        <CText size="xs" weight="bold" color={colors.text} style={styles.featureCell} tx="subscription.whats_included" />
        {COMPARISON_PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[styles.tierCell, plan.isHighlighted && styles.tierCellSelected]}
          >
            <CText
              size="xs"
              weight={plan.isHighlighted ? 'bold' : 'semiBold'}
              color={plan.isHighlighted ? colors.primary : colors.textMuted}
              numberOfLines={1}
            >
              {plan.name}
            </CText>
          </View>
        ))}
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* Fixed back button — outside FlatList so touches are never intercepted */}
      <Pressable onPress={dismiss} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <FlatList
        data={FEATURES}
        keyExtractor={(item) => item.label}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: feature, index }) => (
          <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
            <CText
              size="sm"
              color={colors.text}
              style={styles.featureCell}
              numberOfLines={2}
            >
              {feature.label}
            </CText>
            {feature.tiers.map((included, tIdx) => (
              <View
                key={tIdx}
                style={[
                  styles.tierCell,
                  COMPARISON_PLANS[tIdx]?.isHighlighted && styles.tierCellSelected,
                ]}
              >
                {included ? (
                  <Ionicons name="checkmark" size={20} color={colors.success} />
                ) : (
                  <Ionicons name="close" size={20} color={colors.border} />
                )}
              </View>
            ))}
          </View>
        )}
      />

      {/* Fixed bottom bar */}
      <View style={styles.bottomBar}>
        <CButton
          txt={bottomLabel}
          onPress={onPurchase}
          loading={isPurchasing}
          disabled={isPurchasing || PLANS.length === 0}
          size="lg"
          variant="solid"
          color="primary"
          fullWidth
        />
        {/* <CButton
          txt={t('subscription.restore')}
          onPress={handleRestore}
          disabled={purchasing}
          variant="link"
          color="primary"
          fullWidth
          containerStyle={styles.restoreBtn}
        /> */}
        <CText size="xs" color={colors.textMuted} style={styles.terms}>
          {termsText}
        </CText>
      </View>
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 24 },

  discountPriceBlock: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  discountBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 4,
  },
  discountBadgeTxt:  { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.2 },
  discountPriceRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  discountPriceNew:  { fontSize: 36, fontWeight: '900' },
  discountPriceOld:  { fontSize: 18, color: '#9CA3AF', textDecorationLine: 'line-through' },
  discountPriceSub:  { fontSize: 12, textAlign: 'center' },

  header: { alignItems: 'center', marginVertical: 20 },
  backBtn: { position: 'absolute', top: 52, left: 16, zIndex: 10, padding: 4 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow.button,
  },
  micIcon: { alignItems: 'center' },
  micBody: { width: 18, height: 26, borderRadius: 9, backgroundColor: colors.white, marginBottom: 4 },
  micBase: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.white },
  micStand: { width: 3, height: 6, borderRadius: 2, backgroundColor: colors.white, marginTop: 1 },
  title: { marginTop: 10 },
  subtitle: { marginTop: 4, textAlign: 'center' },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 16,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
  },

  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    gap: 8,
  },
  planCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    position: 'relative',
  },
  planCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  planPrice: { marginTop: 4 },
  badge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#facc15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: colors.surface,
  },
  tableRowAlt: { backgroundColor: colors.background },
  tableHeader: { backgroundColor: colors.border },
  featureCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tierCell: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tierCellSelected: { backgroundColor: colors.primaryDim },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  restoreBtn: { marginTop: 4 },
  terms: { textAlign: 'center', marginTop: 8 },
});

export default memo(SubscriptionScreen);
