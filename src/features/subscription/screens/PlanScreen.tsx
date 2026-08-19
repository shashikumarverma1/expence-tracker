import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import CText from '../../../core/component/CText';
import { CButton } from '../../../core/component/Button';
import { useTheme } from '../../../core/hook';
import { AppColors, radius, shadow } from '../../../core/utils';
import { useIsPro } from '../hooks/useIsPro';
import { useSubscriptionStore } from '../../../core/store/subscription/useSubscriptionStore';
import { useSubscription } from '../hooks';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';

// ── Feature comparison data ───────────────────────────────────
const FEATURES = [
  { key: 'subscription.features.recording',         free: true,  pro: true  },
  { key: 'subscription.features.mood_tracking',     free: true,  pro: true  },
  { key: 'subscription.features.daily_streaks',     free: true,  pro: true  },
  { key: 'subscription.features.journal_history',   free: true, pro: true  }, // limit free
  { key: 'subscription.features.ai_transcription',  free: false, pro: true  },
  { key: 'subscription.features.ai_insights',       free: false, pro: true  },
  { key: 'subscription.features.weekly_reports',    free: false, pro: true  },
  // { key: 'subscription.features.export_journal',    free: false, pro: true  },
  { key: 'subscription.features.unlimited_entries', free: false, pro: true  },
  { key: 'subscription.features.priority_support',  free: false, pro: true  },
];

// ── Feature row ───────────────────────────────────────────────
function FeatureRow({
  label, freeIncluded, proIncluded, isPro, colors, alt,
}: {
  label: string; freeIncluded: boolean; proIncluded: boolean;
  isPro: boolean; colors: AppColors; alt: boolean;
}) {
  const s = makeStyles(colors);
  return (
    <View style={[s.featureRow, alt && { backgroundColor: colors.background }]}>
      <CText txt={label} style={s.featureLabel} numberOfLines={1} />
      <View style={s.featureCell}>
        {freeIncluded
          ? <Ionicons name="checkmark" size={18} color={isPro ? colors.textMuted : colors.success} />
          : <Ionicons name="remove"    size={18} color={colors.border} />}
      </View>
      <View style={[s.featureCell, s.proCell]}>
        {proIncluded
          ? <Ionicons name="checkmark" size={18} color={colors.success} />
          : <Ionicons name="remove"    size={18} color={colors.border} />}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────
export function PlanScreen() {
  const nav       = useNavigation<any>();
  const { colors } = useTheme();
  const { t }     = useTranslation();
  const isPro     = useIsPro();
  const planType  = useSubscriptionStore((s) => s.planType);
  const planPrice = useSubscriptionStore((s) => s.planPrice);
  const planExpiryDate = useSubscriptionStore((s) => s.planExpiryDate);
  const s         = makeStyles(colors);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const { openStoreSubscriptions, discountClaimed, refreshSubscriptionStatus, refreshingStatus } = useSubscription();

  useFocusEffect(
    useCallback(() => {
      refreshSubscriptionStatus();
    }, [])
  );

  const billingCycle =
    planType === 'monthly'  ? t('plan_screen.renews_monthly') :
    planType === 'annual'   ? t('plan_screen.renews_annual')  :
    planType === 'lifetime' ? t('plan_screen.one_time')       : '—';

  const priceLabel =
    planPrice
      ? planType === 'monthly' ? `${planPrice} / ${t('plan_screen.per_month')}`
      : planType === 'annual'  ? `${planPrice} / ${t('plan_screen.per_year')}`
      : planPrice
      : '—';

  const expiryLabel = planExpiryDate
    ? new Date(planExpiryDate).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => nav.goBack()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <CText tx="plan_screen.title" size="xl" weight="bold" />
        <View style={{ width: 32, alignItems: 'flex-end' }}>
          {refreshingStatus && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Current Plan card ── */}
        <View style={[s.planCard, isPro ? s.planCardPro : s.planCardFree]}>
          <View style={s.planCardLeft}>
            <CText
              tx="plan_screen.current_plan"
              size="xs" weight="semiBold"
              color={isPro ? '#B45309' : colors.textMuted}
              style={s.currentLabel}
            />
            <View style={s.badgeRow}>
              <View style={[s.badge, isPro ? s.badgePro : s.badgeFree]}>
                <CText
                  tx={isPro ? 'plan_screen.pro_badge' : 'plan_screen.free_badge'}
                  size="sm" weight="bold" color="#fff"
                />
              </View>
            </View>
            {isPro ? (
              <>
                {planPrice && (
                  <CText
                    txt={priceLabel}
                    size="xl" weight="bold"
                    color="#B45309"
                    style={{ marginTop: 6 }}
                  />
                )}
                {planPrice && (
                  <CText
                    txt={billingCycle}
                    size="xs"
                    color="#92400E"
                    style={{ marginTop: 2 }}
                  />
                )}
                {expiryLabel && planType !== 'lifetime' && (
                  <CText
                    txt={`${t('plan_screen.expires_on')}: ${expiryLabel}`}
                    size="xs"
                    color="#92400E"
                    style={{ marginTop: planPrice ? 2 : 6 }}
                  />
                )}
                {!planPrice && !expiryLabel && (
                  <CText
                    tx="plan_screen.pro_tagline"
                    size="sm"
                    color="#92400E"
                    style={{ marginTop: 6 }}
                  />
                )}
              </>
            ) : (
              <CText
                tx={isPro ? 'plan_screen.pro_tagline' : 'plan_screen.free_tagline'}
                size="sm"
                color={isPro ? '#92400E' : colors.textMuted}
                style={{ marginTop: 6 }}
              />
            )}
          </View>
          <Ionicons
            name={isPro ? 'star' : 'star-outline'}
            size={40}
            color={isPro ? '#F59E0B' : colors.border}
          />
        </View>

       

        {/* ── Feature comparison table ── */}
        <CText
          tx="plan_screen.features_title"
          weight="semiBold" size="xs"
          color={colors.textMuted}
          style={s.sectionLabel}
        />

        <View style={s.table}>
          <View style={[s.featureRow, s.tableHeader]}>
            <CText tx="subscription.whats_included" size="xs" weight="bold"
              color={colors.textMuted} style={s.featureLabel}
            />
            <View style={s.featureCell}>
              <CText tx="plan_screen.col_free" size="xs" weight="bold"
                color={isPro ? colors.textMuted : colors.primary}
              />
            </View>
            <View style={[s.featureCell, s.proCell]}>
              <CText tx="plan_screen.col_pro" size="xs" weight="bold" color={colors.primary} />
            </View>
          </View>

          {FEATURES.map((f, i) => (
            <FeatureRow
              key={f.key}
              label={t(f.key)}
              freeIncluded={f.free}
              proIncluded={f.pro}
              isPro={isPro}
              colors={colors}
              alt={i % 2 === 1}
            />
          ))}
        </View>

        {/* ── CTA ── */}
        <View style={s.cta}>
          {isPro ? (
            <>
              <CButton
                tx="plan_screen.manage_btn"
                variant="outline" color="primary"
                onPress={() => nav.navigate('SubscriptionScreen')}
              />
              {planType !== 'lifetime' && (
                <Pressable
                  style={s.cancelLink}
                  onPress={() => discountClaimed ? openStoreSubscriptions() : setShowCancelModal(true)}
                >
                  <CText style={[s.cancelLinkTxt, { color: colors.error }]}>
                    Cancel Subscription
                  </CText>
                </Pressable>
              )}
            </>
          ) : (
            <CButton
              tx="plan_screen.upgrade_btn"
              color="primary"
              onPress={() => nav.navigate('SubscriptionScreen')}
            />
          )}
        </View>

      </ScrollView>

      <CancelSubscriptionModal
        visible={showCancelModal}
        planPrice={planPrice}
        accepting={false}
        onAcceptDiscount={() => {
          setShowCancelModal(false);
          nav.navigate('SubscriptionScreen', { isRetentionOffer: true, planType });
        }}
        onCancelAnyway={() => {
          setShowCancelModal(false);
          openStoreSubscriptions();
        }}
        onDismiss={() => setShowCancelModal(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    gap: 8,
  },
  backBtn: { padding: 4 },
  scroll:  { padding: 20, paddingBottom: 40 },

  // Current plan card
  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: radius.lg, padding: 20, marginBottom: 24,
    borderWidth: 1.5, ...shadow.card,
  },
  planCardFree: { backgroundColor: colors.surface,  borderColor: colors.border  },
  planCardPro:  { backgroundColor: '#FFFBEB',        borderColor: '#FCD34D'      },
  planCardLeft: { flex: 1, gap: 4 },
  currentLabel: { textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  badgeRow:     { flexDirection: 'row' },
  badge:        { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  badgeFree:    { backgroundColor: colors.primary },
  badgePro:     { backgroundColor: '#F59E0B' },

  // Active plan detail card
  activePlanCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
    ...shadow.card,
  },
  activePlanRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 },

  // Section label
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  // Feature table
  table: {
    borderRadius: radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  tableHeader:  { backgroundColor: colors.border, paddingVertical: 10 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', minHeight: 44, backgroundColor: colors.surface },
  featureLabel: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.text },
  featureCell:  { width: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  proCell:      { backgroundColor: colors.primaryDim },

  cta:           { marginTop: 28, gap: 12 },
  cancelLink:    { alignItems: 'center', paddingVertical: 8 },
  cancelLinkTxt: { fontSize: 14, textDecorationLine: 'underline' },
});
