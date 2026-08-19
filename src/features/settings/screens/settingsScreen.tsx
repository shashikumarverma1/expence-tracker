import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  InteractionManager,
} from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import CText from '../../../core/component/CText';
import { SettingRow } from '../../../core/component/SettingRow';
import { useSettings } from '../hooks/settings.hook';
import { auth } from '../../../core/config';
import { useIsPro } from '../../subscription/hooks/useIsPro';

export function SettingsScreen() {
  const {
    navigation,
    colors,
    isDark,
    toggleTheme,
    t,
    i18n,
    handleLogout,
    navigateToProfile,
    navigateToNotification,
    navigateToSubscription,
    rateApp,
    shareApp,
  } = useSettings();

  const s     = makeStyles(colors);
  const user  = auth.currentUser;
  const isPro = useIsPro();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        {navigation.canGoBack() && (
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
        <CText tx="settings" size="xl" weight="bold" />
      </View>

      {/* Profile section */}
      <Pressable style={[s.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={navigateToProfile}>
        <View style={[s.profileAvatar, { backgroundColor: colors.primaryDim }]}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={s.profileAvatarImg} />
          ) : (
            <Ionicons name="person" size={28} color={colors.primary} />
          )}
        </View>
        <View style={s.profileInfo}>
          <CText txt={user?.displayName || t('profile')} size="md" weight="semiBold" numberOfLines={1} />
          <CText txt={user?.email ?? ''} size="sm" color={colors.textMuted} numberOfLines={1} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Current plan banner */}
        <Pressable
          style={[s.planBanner, isPro ? s.planBannerPro : s.planBannerFree]}
          onPress={() => {
            navigation.dispatch(DrawerActions.closeDrawer());
            InteractionManager.runAfterInteractions(() =>
              (navigation as any).navigate('Root', {
                screen: 'MainTabs',
                params: { screen: 'Home', params: { screen: 'PlanScreen' } },
              })
            );
          }}
        >
          <Ionicons
            name={isPro ? 'star' : 'star-outline'}
            size={18}
            color={isPro ? '#F59E0B' : colors.textMuted}
          />
          <View style={s.planInfo}>
            <CText
              tx={isPro ? 'settings_screen.plan_pro' : 'settings_screen.plan_free'}
              style={[s.planName, isPro ? s.planNamePro : s.planNameFree]}
            />
            <CText
              tx={isPro ? 'settings_screen.plan_pro_sub' : 'settings_screen.plan_free_sub'}
              style={s.planSub}
            />
          </View>
          {!isPro && (
            <Pressable
              style={s.upgradeBtn}
              onPress={(e) => { e.stopPropagation(); navigateToSubscription(); }}
            >
              <CText tx="settings_screen.upgrade" style={s.upgradeBtnTxt} />
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={16} color={isPro ? '#B45309' : colors.textMuted} />
        </Pressable>

        {/* Appearance */}
        <CText tx="appearance" weight="semiBold" size="xs" color={colors.textMuted} style={s.sectionLabel} />
        <View style={s.card}>
          <SettingRow
            tx={isDark ? 'dark_mode' : 'light_mode'}
            icon={isDark ? 'moon' : 'sunny-outline'}
            toggle
            toggleValue={isDark}
            onToggle={toggleTheme}
          />
        </View>

        {/* Language */}
        <CText tx="language" weight="semiBold" size="xs" color={colors.textMuted} style={s.sectionLabel} />
        <View style={s.card}>
          <SettingRow
            tx="change_language"
            icon="language-outline"
            badge={i18n.language.toUpperCase()}
            onPress={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : 'en')}
          />
        </View>

        {/* Navigation */}
        {/* <View style={s.card}>
          <SettingRow
            tx="subscription.title"
            icon="star-outline"
            showChevron
            onPress={navigateToSubscription}
          />
          <SettingRow
            tx="notifications"
            icon="notifications-outline"
            showChevron
            onPress={navigateToNotification}
          />
        </View> */}

        {/* Support */}
        <CText tx="support" weight="semiBold" size="xs" color={colors.textMuted} style={s.sectionLabel} />
        <View style={s.card}>
          <SettingRow
            tx="rate_us"
            icon="star-outline"
            showChevron
            onPress={rateApp}
          />
          <SettingRow
            tx="share_app"
            icon="share-social-outline"
            showChevron
            onPress={shareApp}
          />
        </View>

        {/* Account */}
        <CText tx="account" weight="semiBold" size="xs" color={colors.textMuted} style={s.sectionLabel} />
        <View style={s.card}>
          <SettingRow
            tx="logout"
            icon="log-out-outline"
            color="danger"
            onPress={handleLogout}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    backBtn: { padding: 4 },
    scroll: { padding: 20, paddingBottom: 40 },
    sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },

    planBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      marginTop: 4,
    },
    planBannerFree: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    planBannerPro: {
      backgroundColor: '#FFFBEB',
      borderColor: '#FCD34D',
    },
    planInfo:    { flex: 1 },
    planName:    { fontSize: 14, fontWeight: '700' },
    planNameFree:{ color: colors.text },
    planNamePro: { color: '#B45309' },
    planSub:     { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    upgradeBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    upgradeBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modal: { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center' },
    modalIcon: { marginBottom: 12 },
    modalTitle: { marginBottom: 8, textAlign: 'center' },
    modalWarning: { textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    passwordWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4, width: '100%', marginBottom: 8 },
    passwordInput: { flex: 1, fontSize: 15, paddingVertical: 10, backgroundColor: 'transparent' },
    errorText: { marginBottom: 12, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
    modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { borderWidth: 1 },
    disabledBtn: { opacity: 0.5 },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    profileAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    profileAvatarImg: { width: 52, height: 52, borderRadius: 26 },
    profileInfo: { flex: 1 },
  });
}
