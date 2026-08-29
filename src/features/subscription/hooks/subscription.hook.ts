import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { showAlert } from "../../../core/store/alert/useAlertStore";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import Purchases, { STORE_REPLACEMENT_MODE } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../core/config/firebase";
import { collections } from "../../../core/enum/eCollections";
import { useSubscriptionStore } from "../../../core/store/subscription/useSubscriptionStore";

export type PurchaseMode = 'subscription' | 'one_time';

export type DynamicPlan = {
    id: string;
    name: string;
    price: string;
    badge?: string;
    _pkg: any;
};

export const useSubscription = (onSuccess?: () => void, initialTier?: number) => {
    const { t } = useTranslation();
    const { setIsPro, setPlanType, setPlanPrice, setPlanExpiryDate, planType: currentPlanType } = useSubscriptionStore();
    const [offerings, setOfferings] = useState<any>(null);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [purchasing, setPurchasing] = useState<boolean>(false);
    const [purchaseMode, setPurchaseModeState] = useState<PurchaseMode>('subscription');
    const [selectedTier, setSelectedTier] = useState(initialTier ?? 0);
    const [trialEligible, setTrialEligible] = useState(false);
    const [annualSavingsPercent, setAnnualSavingsPercent] = useState<number | null>(null);

    async function presentPaywall(): Promise<boolean> {
        const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
        switch (paywallResult) {
            case PAYWALL_RESULT.NOT_PRESENTED:
            case PAYWALL_RESULT.ERROR:
            case PAYWALL_RESULT.CANCELLED:
                return false;
            case PAYWALL_RESULT.PURCHASED:
            case PAYWALL_RESULT.RESTORED:
                return true;
            default:
                return false;
        }
    }

    // A user is only shown the free-trial messaging if they've never purchased
    // any subscription before (RevenueCat only grants trials to first-time subscribers)
    // and, where the platform can tell us (iOS), the store confirms intro-price eligibility.
    const checkTrialEligibility = async (packages: any[]) => {
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            const everPurchased = (customerInfo.allPurchasedProductIdentifiers ?? []).length > 0;
            if (everPurchased) {
                setTrialEligible(false);
                return;
            }

            if (Platform.OS === 'ios') {
                const productIds: string[] = packages
                    .map((p: any) => p.product?.identifier)
                    .filter(Boolean);
                if (productIds.length > 0) {
                    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
                    const anyIneligible = Object.values(eligibility).some(
                        (e: any) => e.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE
                    );
                    setTrialEligible(!anyIneligible);
                    return;
                }
            }

            // Android's SDK can't compute this reliably — fall back to purchase history.
            setTrialEligible(true);
        } catch {
            setTrialEligible(false);
        }
    };

    const fetchOfferings = async () => {
        try {
            const result: any = await Purchases.getOfferings();
            if (result.current && result.current.availablePackages.length > 0) {
                setOfferings(result.current);

                if (__DEV__) {
                    console.log('[Subscription] Live packages from store:', result.current.availablePackages.map((p: any) => ({
                        packageId: p.identifier,
                        productId: p.product?.identifier,
                        price: p.product?.price,
                        priceString: p.product?.priceString,
                        currencyCode: p.product?.currencyCode,
                    })));
                }

                const PLAN_IDS = ['monthly', 'yearly'];
                const targetId = PLAN_IDS[initialTier ?? 0] ?? 'monthly';
                const first = result.current.availablePackages.find(
                    (p: any) =>
                        p.identifier.toLowerCase().includes(targetId) ||
                        p.product?.identifier?.toLowerCase().includes(targetId)
                ) ?? result.current.availablePackages.find(
                    (p: any) =>
                        p.identifier.toLowerCase().includes('monthly') ||
                        p.product?.identifier?.toLowerCase().includes('monthly')
                ) ?? result.current.availablePackages[0];
                setSelectedPackage(first);
                checkTrialEligibility(result.current.availablePackages);

                // Compute "Save X%" for the yearly plan straight from the live store prices
                // (yearly price vs. 12x monthly price) instead of a hardcoded percentage.
                const monthlyPkg = result.current.availablePackages.find((p: any) =>
                    p.identifier.toLowerCase().includes('monthly') || p.product?.identifier?.toLowerCase().includes('monthly')
                );
                const yearlyPkg = result.current.availablePackages.find((p: any) =>
                    p.identifier.toLowerCase().includes('yearly') || p.product?.identifier?.toLowerCase().includes('yearly')
                );
                const monthlyPrice = monthlyPkg?.product?.price;
                const yearlyPrice  = yearlyPkg?.product?.price;
                if (typeof monthlyPrice === 'number' && typeof yearlyPrice === 'number' && monthlyPrice > 0) {
                    const fullYearPrice = monthlyPrice * 12;
                    const savings = Math.round((1 - yearlyPrice / fullYearPrice) * 100);
                    setAnnualSavingsPercent(savings > 0 ? savings : null);
                } else {
                    setAnnualSavingsPercent(null);
                }
            } else {
                showAlert(t('subscription.no_offerings_title'), t('subscription.no_offerings_msg'));
            }
        } catch {
            // silent fail — RevenueCat not configured
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOfferings();
    }, []);

    // Fallback prices shown when the store/RevenueCat offerings can't be loaded.
    // Live store prices always override these once offerings resolve.
    const FALLBACK_PRICE: Record<string, string> = {
        monthly: t('subscription.price_monthly_fallback'),
        yearly: t('subscription.price_yearly_fallback'),
    };
    const FALLBACK_SAVINGS_PERCENT = 50; // $29.99/yr vs $4.99×12

    const SUBSCRIPTION_PLANS: DynamicPlan[] = [
        { id: 'monthly', name: t('subscription.plan_monthly'), price: FALLBACK_PRICE.monthly, _pkg: null },
        {
            id: 'yearly',
            name: t('subscription.plan_annual'),
            price: FALLBACK_PRICE.yearly,
            badge: t('subscription.badge_save_dynamic', { percent: annualSavingsPercent ?? FALLBACK_SAVINGS_PERCENT }),
            _pkg: null,
        },
    ];

    const PLANS = SUBSCRIPTION_PLANS;

    const COMPARISON_PLANS = [
        { id: 'free', name: t('subscription.plan_free'), isHighlighted: false },
        { id: 'pro', name: t('subscription.plan_pro'), isHighlighted: true },
    ];

    const findPackage = (planId: string) =>
        offerings?.availablePackages?.find((p: any) =>
            p.identifier.toLowerCase().includes(planId.toLowerCase()) ||
            p.product?.identifier?.toLowerCase().includes(planId.toLowerCase())
        ) ?? null;

    const setPurchaseMode = (_mode: PurchaseMode) => {
        setSelectedTier(0);
        const pkg = findPackage(SUBSCRIPTION_PLANS[0].id);
        if (pkg) setSelectedPackage(pkg);
    };

    const selectTier = (idx: number) => {
        setSelectedTier(idx);
        const pkg = findPackage(PLANS[idx].id);
        if (pkg) setSelectedPackage(pkg);
    };

    const resolvePlanType = (packageType: string): import('../../../core/store/subscription/useSubscriptionStore').PlanType => {
        const t = packageType.toUpperCase();
        if (t === 'ANNUAL' || t === 'YEARLY') return 'annual';
        if (t === 'MONTHLY') return 'monthly';
        return 'other';
    };

    const grantPro = (
        planType: import('../../../core/store/subscription/useSubscriptionStore').PlanType,
        planPrice: string | null,
        planExpiryDate: string | null = null,
    ) => {
        setIsPro(true);
        setPlanType(planType);
        setPlanPrice(planPrice);
        setPlanExpiryDate(planExpiryDate);
        const uid = auth.currentUser?.uid;
        if (uid) updateDoc(doc(db, collections.users, uid), { isPro: true, planType, planPrice, planExpiryDate }).catch(() => { });
    };

    // -----------------------------------------------------------------------
    // FIX: Normalise a Play Billing v5 product ID to its base product ID.
    // e.g. "reflect_monthly:monthly" → "reflect_monthly"
    // On some devices/SDK versions activeSubscriptions returns the full
    // "productId:basePlanId" string; on others just "productId".
    // We compare using base IDs but pass the ORIGINAL string to RevenueCat
    // because RC's purchasePackage wrapper expects whatever format the SDK gave us.
    // -----------------------------------------------------------------------
    const baseId = (id: string) => id.split(':')[0];

    const handlePurchase = async () => {
        setPurchasing(true);
        console.log('[Subscription] handlePurchase called with: aaaaaaaa',)
        try {
            if (selectedPackage) {
                const customerInfo = await Purchases.getCustomerInfo();
                const selectedProductId = selectedPackage.product?.identifier ?? '';
                const activeSubscriptions = customerInfo.activeSubscriptions ?? [];
                const allEntitlements = Object.values(customerInfo.entitlements.all) as any[];

                const selectedBase = baseId(selectedProductId);

                console.log('[Proration] selectedProductId:', selectedProductId);
                console.log('[Proration] selectedBase:', selectedBase);
                console.log('[Proration] raw activeSubscriptions:', activeSubscriptions);
                console.log('[Proration] allEntitlements:', allEntitlements.map((e: any) => ({
                    id: e.productIdentifier,
                    isActive: e.isActive,
                    willRenew: e.willRenew,
                })));

                // Only attempt proration for subscription packages (not lifetime/one-time)
                const isSubscriptionPackage = ['MONTHLY', 'ANNUAL'].includes(
                    (selectedPackage.packageType ?? '').toUpperCase()
                );

                let productChangeInfo: {
                    oldProductIdentifier: string;
                    replacementMode?: STORE_REPLACEMENT_MODE;
                } | null = null;

                if (Platform.OS === 'android' && isSubscriptionPackage) {
                    // ── Step 1: find an active subscription on a DIFFERENT base product ──
                    // We compare base IDs to handle both "productId" and "productId:basePlanId"
                    // formats, but keep the RAW string for the API call.
                    const oldActiveRaw = activeSubscriptions.find(
                        (id) => baseId(id) !== selectedBase
                    ) ?? null;

                    // ── Step 2: fall back to a cancelled-but-still-valid entitlement ──
                    // willRenew=false means the user cancelled but the period hasn't expired yet.
                    const oldCancelledRaw = !oldActiveRaw
                        ? (allEntitlements.find(
                            (e: any) =>
                                e.isActive &&
                                !e.willRenew &&
                                baseId(e.productIdentifier) !== selectedBase
                        )?.productIdentifier ?? null)
                        : null;

                    // ── Step 3: also catch active entitlements on a different product
                    //    (covers edge case where activeSubscriptions is empty but
                    //     entitlements.all still shows an active sub) ──
                    const oldActiveEntitlementRaw = (!oldActiveRaw && !oldCancelledRaw)
                        ? (allEntitlements.find(
                            (e: any) =>
                                e.isActive &&
                                baseId(e.productIdentifier) !== selectedBase
                        )?.productIdentifier ?? null)
                        : null;

                    // Use the raw ID as RevenueCat returned it — never strip the base plan suffix
                    const oldProductId = oldActiveRaw ?? oldCancelledRaw ?? oldActiveEntitlementRaw ?? null;

                    console.log('[Proration] oldActiveRaw:', oldActiveRaw);
                    console.log('[Proration] oldCancelledRaw:', oldCancelledRaw);
                    console.log('[Proration] oldActiveEntitlementRaw:', oldActiveEntitlementRaw);
                    console.log('[Proration] final oldProductId:', oldProductId);

                    if (oldProductId) {
                        productChangeInfo = {
                            oldProductIdentifier: oldProductId,
                            replacementMode: STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION,
                        };
                        console.log('[Proration] productChangeInfo set:', productChangeInfo);
                    } else {
                        console.log('[Proration] No old product — fresh purchase, skipping proration');
                    }
                }
                // purchasePackage with productChangeInfo is the correct API for plan switching
                // on both Android (proration) and iOS (StoreKit handles upgrade/downgrade automatically).
                // console.log(productChangeInfo , "productChangeInfo" , selectedPackage)
                // await Purchases.purchasePackage(selectedPackage, null, productChangeInfo);
                const options: any[] = selectedPackage.product.subscriptionOptions ?? [];
                const planKey = (selectedPackage.packageType ?? '').toUpperCase() === 'ANNUAL' ? 'annual' : 'monthly';

                // New customers with no prior purchase get the 3-day free-trial offer.
                // Skip it for plan switches (productChangeInfo set) — Play rejects intro
                // offers on an upgrade/downgrade path.
                const trialOffer = (Platform.OS === 'android' && trialEligible && !productChangeInfo && FREE_TRIAL_OFFER_ID[planKey])
                    ? options.find((o: any) => o.offerIdentifier === FREE_TRIAL_OFFER_ID[planKey])
                    : null;

                const baseOption = trialOffer ?? options.find((o: any) => o.isBasePlan);

                if (baseOption) {
                    await Purchases.purchaseSubscriptionOption(baseOption, productChangeInfo);
                } else {
                    // fallback — shouldn't happen, but don't silently swallow it
                    await Purchases.purchasePackage(selectedPackage, null, productChangeInfo);
                }
                const info = await Purchases.getCustomerInfo();
                const isActive = Object.keys(info.entitlements.active).length > 0;

                if (isActive) {
                    const planType = resolvePlanType(selectedPackage.packageType ?? '');
                    const planPrice: string = selectedPackage?.product?.priceString ?? null;
                    const entitlement = Object.values(info.entitlements.active)[0] as any;
                    console.log('[Subscription] Purchase successful:', {
                        planType,
                        price: planPrice,
                        billing: selectedPackage?.packageType,
                        expiryDate: entitlement?.expirationDate ?? 'lifetime / no expiry',
                        productId: entitlement?.productIdentifier,
                    });
                    grantPro(planType, planPrice, entitlement?.expirationDate ?? null);
                    onSuccess?.();
                    Toast.show({
                        type: 'success',
                        text1: t('subscription.success_title'),
                        text2: t('subscription.success_subscription'),
                        visibilityTime: 3000,
                    });
                }
            } else {
                // No package resolved — fall back to RevenueCat paywall UI
                const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
                if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
                    const info = await Purchases.getCustomerInfo();
                    const entitlements = Object.values(info.entitlements.active);
                    if (entitlements.length > 0) {
                        const productId = entitlements[0].productIdentifier.toLowerCase();
                        const planType: import('../../../core/store/subscription/useSubscriptionStore').PlanType =
                            productId.includes('annual') || productId.includes('year') || productId.includes('yearly') ? 'annual' :
                                productId.includes('month') ? 'monthly' :
                                    productId.includes('lifetime') ? 'lifetime' : 'other';
                        grantPro(planType, null, (entitlements[0] as any)?.expirationDate ?? null);
                        onSuccess?.();
                        Toast.show({
                            type: 'success',
                            text1: t('subscription.success_title'),
                            text2: t('subscription.success_subscription'),
                            visibilityTime: 3000,
                        });
                    }
                }
            }
        } catch (e: any) {
            if (!e.userCancelled) showAlert(t('subscription.purchase_failed'), e.message ?? String(e));
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setPurchasing(true);
        try {
            const customerInfo = await Purchases.restorePurchases();
            const entitlements = Object.values(customerInfo.entitlements.active);
            if (entitlements.length > 0) {
                const productId = entitlements[0].productIdentifier.toLowerCase();
                const planType: import('../../../core/store/subscription/useSubscriptionStore').PlanType =
                    productId.includes('annual') || productId.includes('year') || productId.includes('yearly') ? 'annual' :
                        productId.includes('month') ? 'monthly' :
                            productId.includes('lifetime') ? 'lifetime' : 'other';
                const offerings = await Purchases.getOfferings().catch(() => null);
                const restorePackages: any[] = offerings?.current?.availablePackages ?? [];
                const restoredEntitlementBaseId = baseId(entitlements[0].productIdentifier);
                const pkg =
                    restorePackages.find((p: any) => p.product.identifier === entitlements[0].productIdentifier) ??
                    restorePackages.find((p: any) => baseId(p.product?.identifier ?? '') === restoredEntitlementBaseId);
                const restoredPrice = pkg?.product?.priceString ?? null;
                console.log('[Subscription] Restore successful:', {
                    planType,
                    price: restoredPrice,
                    billing: pkg?.packageType ?? 'unknown',
                    expiryDate: (entitlements[0] as any)?.expirationDate ?? 'lifetime / no expiry',
                    productId: entitlements[0].productIdentifier,
                });
                grantPro(planType, restoredPrice, (entitlements[0] as any)?.expirationDate ?? null);
                showAlert(t('subscription.restore_title'), t('subscription.restore_success'), [
                    { text: 'OK', onPress: () => onSuccess?.() },
                ]);
            } else {
                showAlert(t('subscription.restore_nothing'), t('subscription.restore_nothing_msg'));
            }
        } catch (e: any) {
            showAlert(t('subscription.restore_failed'), e.message ?? String(e));
        } finally {
            setPurchasing(false);
        }
    };

    const FEATURES = [
        { label: t('subscription.features.trade_logging'), tiers: [true, true] },
        { label: t('subscription.features.basic_analytics'), tiers: [true, true] },
        { label: t('subscription.features.journal_history'), tiers: [true, true] },
        { label: t('subscription.features.ai_insights'), tiers: [false, true] },
        { label: t('subscription.features.ai_transcription'), tiers: [false, true] },
        { label: t('subscription.features.weekly_reports'), tiers: [false, true] },
        { label: t('subscription.features.unlimited_entries'), tiers: [false, true] },
        { label: t('subscription.features.priority_support'), tiers: [false, true] },
    ];

    const openStoreSubscriptions = () => {
        const url = Platform.OS === 'ios'
            ? 'https://apps.apple.com/account/subscriptions'
            : 'https://play.google.com/store/account/subscriptions';
        Linking.openURL(url).catch(() => { });
    };

    // Play Console offer IDs (base plan: com-cashleak-app-monthly / com-cashleak-app-yearly).
    // Retention: 30% off, shown when a subscriber tries to cancel.
    const PLAY_OFFER_ID: Record<string, string> = {
        monthly: 'monthly-retention',
        annual: 'yearly-retention',
    };

    // Acquisition: 3-day free trial, eligible for new customers only.
    const FREE_TRIAL_OFFER_ID: Record<string, string> = {
        monthly: 'cashleak-3day-free-trial',
        annual: 'cashleak-3day-free-trial',
    };

    const findPlayOffer = (pkg: any, planType: string) => {
        const targetId = PLAY_OFFER_ID[planType];
        if (!targetId) return null;
        const options: any[] = pkg?.product?.subscriptionOptions ?? [];
        return options.find((o: any) => o.offerIdentifier === targetId) ?? null;
    };

    const [cancellingSubscription, setCancellingSubscription] = useState(false);
    const [discountClaimed, setDiscountClaimed] = useState(false);

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        getDoc(doc(db, collections.users, uid))
            .then((snap) => {
                if (snap.exists()) setDiscountClaimed(snap.data().discountClaimed === true);
            })
            .catch(() => { });
    }, []);

    const [refreshingStatus, setRefreshingStatus] = useState(false);

    const refreshSubscriptionStatus = async () => {
        setRefreshingStatus(true);
        try {
            // getCustomerInfo() can serve a stale cached snapshot (e.g. after a renewal
            // extended the expiration date) — invalidate the cache first so this always
            // reflects the latest state from the store.
            await Purchases.invalidateCustomerInfoCache();
            const info = await Purchases.getCustomerInfo();
            const entitlements = Object.values(info.entitlements.active);

            if (entitlements.length > 0) {
                const entitlement = entitlements[0] as any;
                const productId: string = entitlement.productIdentifier?.toLowerCase() ?? '';
                const planType: import('../../../core/store/subscription/useSubscriptionStore').PlanType =
                    productId.includes('annual') || productId.includes('year') || productId.includes('yearly') ? 'annual' :
                        productId.includes('month') ? 'monthly' :
                            productId.includes('lifetime') ? 'lifetime' : 'other';

                const offeringsResult = await Purchases.getOfferings().catch(() => null);
                const availablePackages: any[] = offeringsResult?.current?.availablePackages ?? [];
                // Product identifiers can come back as either "productId" or
                // "productId:basePlanId" depending on platform/SDK version — match on the
                // base id so a format mismatch doesn't fall through to a stale cached price.
                const entitlementBaseId = baseId(entitlement.productIdentifier ?? '');
                const pkg =
                    availablePackages.find((p: any) => p.product?.identifier === entitlement.productIdentifier) ??
                    availablePackages.find((p: any) => baseId(p.product?.identifier ?? '') === entitlementBaseId);

                // Keep the previously known price if the offering lookup doesn't find a match
                // (e.g. transient network issue) instead of wiping it out.
                const price = pkg?.product?.priceString ?? useSubscriptionStore.getState().planPrice ?? null;

                grantPro(planType, price, entitlement.expirationDate ?? null);
            } else {
                setIsPro(false);
                setPlanExpiryDate(null);
                const uid = auth.currentUser?.uid;
                if (uid) updateDoc(doc(db, collections.users, uid), { isPro: false, planExpiryDate: null }).catch(() => { });
            }
        } catch {
            // silent fail — keep whatever state we already had (e.g. offline)
        } finally {
            setRefreshingStatus(false);
        }
    };

    const markDiscountClaimed = () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setDiscountClaimed(true);
        updateDoc(doc(db, collections.users, uid), { discountClaimed: true }).catch(() => { });
    };

    const handleAcceptDiscount = async () => {
        if (discountClaimed) {
            Toast.show({
                type: 'info',
                text1: 'Discount already used',
                text2: 'You have already claimed your one-time 30% discount.',
                visibilityTime: 3000,
            });
            return;
        }
        setCancellingSubscription(true);
        try {
            const pkgKeyword = currentPlanType === 'annual' ? 'yearly' : 'monthly';
            const pkg = selectedPackage
                ?? offerings?.availablePackages?.find((p: any) =>
                    p.identifier.toLowerCase().includes(pkgKeyword)
                )
                ?? offerings?.availablePackages?.[0]
                ?? null;

            if (!pkg) {
                Toast.show({ type: 'error', text1: 'No plan available', text2: 'Please try again later.' });
                return;
            }

            const playOffer = findPlayOffer(pkg, currentPlanType ?? 'monthly');
            if (playOffer) {
                await (Purchases as any).purchaseSubscriptionOption(playOffer);
            } else {
                await Purchases.purchasePackage(pkg);
            }

            const info = await Purchases.getCustomerInfo();
            const isActive = Object.keys(info.entitlements.active).length > 0;
            if (isActive) {
                const resolvedType = resolvePlanType(pkg.packageType ?? '');
                const resolvedPrice = pkg?.product?.priceString ?? null;
                const resolvedEntitlement = Object.values(info.entitlements.active)[0] as any;
                grantPro(resolvedType, resolvedPrice, resolvedEntitlement?.expirationDate ?? null);
                markDiscountClaimed();
                Toast.show({
                    type: 'success',
                    text1: '30% discount applied! 🎉',
                    text2: 'Your subscription has been updated.',
                    visibilityTime: 3000,
                });
                onSuccess?.();
            }
        } catch (e: any) {
            if (!e.userCancelled) Toast.show({ type: 'error', text1: 'Something went wrong', text2: e.message ?? '' });
        } finally {
            setCancellingSubscription(false);
        }
    };

    return {
        presentPaywall,
        handleRestore,
        handlePurchase,
        handleAcceptDiscount,
        openStoreSubscriptions,
        cancellingSubscription,
        discountClaimed,
        refreshSubscriptionStatus,
        refreshingStatus,
        offerings,
        selectedPackage,
        setSelectedPackage,
        loading,
        purchasing,
        purchaseMode,
        setPurchaseMode,
        selectedTier,
        selectTier,
        PLANS,
        FALLBACK_PRICE,
        FEATURES,
        COMPARISON_PLANS,
        FREE_TRIAL_OFFER_ID,
        trialEligible,
        annualSavingsPercent,
    };
};