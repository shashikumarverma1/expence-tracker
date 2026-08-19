import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getExpoPushToken, useNotification } from '../hook';
import { useTheme } from '../../../core/hook';
import { useAuthStore } from '../../../core/store/auth/useAuthStore';
import {
  sendWelcomeNotification,
  testDailyStreakNotificationCloud,
  testWeeklyReportNotificationCloud,
} from '../hook/notificationService';
import { AppColors } from '../../../core/utils';
import CText from '../../../core/component/CText';
import Toast from 'react-native-toast-message';
import { CButton } from '../../../core/component';
import { scheduleStreakNotification, getStreakMessage } from '../../notifications/useStreakNotification';
import * as Notifications from 'expo-notifications';

export function NotificationScreen() {
  const { expoPushToken, channels, notification, schedulePushNotification } = useNotification();
  const { colors } = useTheme();
  const { t }      = useTranslation();
  const user       = useAuthStore((s) => s.user);
  const navigation = useNavigation();
  const [sending, setSending]                         = useState(false);
  const [testingStreak, setTestingStreak]             = useState(false);
  const [testingWeekly, setTestingWeekly]             = useState(false);
  const [testingStreakCloud, setTestingStreakCloud]   = useState(false);
  const [testingWeeklyCloud, setTestingWeeklyCloud]  = useState(false);
  const s = makeStyles(colors);

  const handleTestStreakNotif = async () => {
    setTestingStreak(true);
    try {
      // Fire in 5 seconds so you can background the app and see it
      const { status } = await Notifications.getPermissionsAsync();
      let granted = status === 'granted';
      if (!granted) {
        const { status: asked } = await Notifications.requestPermissionsAsync();
        granted = asked === 'granted';
      }
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Enable notifications in device settings.' });
        return;
      }

      const streak = 3; // sample streak for preview
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'ReflectAI',
          body:  getStreakMessage(streak),
          sound: true,
          data:  { screen: 'HomeScreen' },
        },
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });
      Toast.show({ type: 'success', text1: 'Test notification scheduled', text2: 'Background the app — it fires in 5 seconds.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message ?? '' });
    } finally {
      setTestingStreak(false);
    }
  };

  const handleTestWeeklyReport = async () => {
    setTestingWeekly(true);
    try {
      const { status } = await Notifications.getPermissionsAsync();
      let granted = status === 'granted';
      if (!granted) {
        const { status: asked } = await Notifications.requestPermissionsAsync();
        granted = asked === 'granted';
      }
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Enable notifications in device settings.' });
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'ReflectAI Weekly Report 📊',
          body:  'Your weekly insights are ready! See your mood trends, top themes & AI reflection.',
          sound: true,
          data:  { screen: 'InsightsScreen' },
        },
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });
      Toast.show({ type: 'success', text1: 'Weekly report notification scheduled', text2: 'Background the app — it fires in 5 seconds.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message ?? '' });
    } finally {
      setTestingWeekly(false);
    }
  };

  const handleTestStreakCloud = async () => {
    setTestingStreakCloud(true);
    try {
      await testDailyStreakNotificationCloud();
      Toast.show({ type: 'success', text1: 'Streak notification sent via Firebase', text2: 'Check your device notifications.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message ?? '' });
    } finally {
      setTestingStreakCloud(false);
    }
  };

  const handleTestWeeklyCloud = async () => {
    setTestingWeeklyCloud(true);
    try {
      await testWeeklyReportNotificationCloud();
      Toast.show({ type: 'success', text1: 'Weekly report sent via Firebase', text2: 'Check your device notifications.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: e?.message ?? '' });
    } finally {
      setTestingWeeklyCloud(false);
    }
  };

  const handleSendWelcome = async () => {
    setSending(true);
    try {
      const token = await getExpoPushToken();
      if (!token) {
        Toast.show({ type: 'error', text1: t('notifications_screen.no_token_err'), text2: t('notifications_screen.no_token_sub') });
        return;
      }
      await sendWelcomeNotification(token, user?.displayName ?? null);
      Toast.show({ type: 'success', text1: t('notifications_screen.send_success'), text2: t('notifications_screen.send_success_sub') });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('notifications_screen.send_failed'), text2: e?.message ?? '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <CText tx="notifications_screen.title" size="lg" weight="semiBold" color={colors.text} />
      </View>

      <View style={s.body}>
        <View style={s.card}>
          <CText tx="notifications_screen.push_token" size="xs" weight="semiBold" color={colors.textMuted} />
          <CText txt={expoPushToken ?? '—'} size="xs" color={colors.text} style={s.monoValue} />
        </View>

        <View style={s.card}>
          <CText tx="notifications_screen.channels" size="xs" weight="semiBold" color={colors.textMuted} />
          <CText
            txt={JSON.stringify(channels.map((c) => c.id), null, 2)}
            size="xs"
            color={colors.text}
            style={s.monoValue}
          />
        </View>

        {notification && (
          <View style={s.card}>
            <CText
              txt={`${t('notifications_screen.notif_title')} ${notification.request.content.title}`}
              size="xs"
              color={colors.text}
            />
            <CText
              txt={`${t('notifications_screen.notif_body')} ${notification.request.content.body}`}
              size="xs"
              color={colors.text}
            />
            <CText
              txt={`${t('notifications_screen.notif_data')} ${JSON.stringify(notification.request.content.data)}`}
              size="xs"
              color={colors.text}
            />
          </View>
        )}

        <CButton
          tx="notifications_screen.schedule_local"
          onPress={schedulePushNotification}
          variant="outline"
          fullWidth
        />

        <View style={s.card}>
          <CText txt="Streak Notification Test" size="xs" weight="semiBold" color={colors.textMuted} style={s.sectionLabel} />
          <CText txt={`Preview message: "${getStreakMessage(3)}"`} size="xs" color={colors.text} style={{ marginBottom: 8 }} />
          {testingStreak ? (
            <ActivityIndicator style={s.spinner} color={colors.primary} />
          ) : (
            <CButton
              txt="Test Streak Notification (5s)"
              onPress={handleTestStreakNotif}
              variant="solid"
              fullWidth
            />
          )}
          <CText txt="Background the app after tapping — notification fires in 5 seconds." size="xs" color={colors.textMuted} style={s.hint} />
          <View style={s.divider} />
          <CText txt="☁️  Firebase (real push)" size="xs" weight="semiBold" color={colors.textMuted} style={s.sectionLabel} />
          {testingStreakCloud ? (
            <ActivityIndicator style={s.spinner} color={colors.primary} />
          ) : (
            <CButton
              txt="Send Streak via Firebase"
              onPress={handleTestStreakCloud}
              variant="outline"
              fullWidth
            />
          )}
          <CText txt="Uses your saved streak count. No need to background the app." size="xs" color={colors.textMuted} style={s.hint} />
        </View>

        <View style={s.card}>
          <CText txt="Weekly Report Test" size="xs" weight="semiBold" color={colors.textMuted} style={s.sectionLabel} />
          <CText txt={`Preview: "Your weekly insights are ready! See your mood trends, top themes & AI reflection."`} size="xs" color={colors.text} style={{ marginBottom: 8 }} />
          {testingWeekly ? (
            <ActivityIndicator style={s.spinner} color={colors.primary} />
          ) : (
            <CButton
              txt="Test Weekly Report Notification (5s)"
              onPress={handleTestWeeklyReport}
              variant="solid"
              fullWidth
            />
          )}
          <CText txt="Tapping the notification will open the Insights screen." size="xs" color={colors.textMuted} style={s.hint} />
          <View style={s.divider} />
          <CText txt="☁️  Firebase (real push)" size="xs" weight="semiBold" color={colors.textMuted} style={s.sectionLabel} />
          {testingWeeklyCloud ? (
            <ActivityIndicator style={s.spinner} color={colors.primary} />
          ) : (
            <CButton
              txt="Send Weekly Report via Firebase"
              onPress={handleTestWeeklyCloud}
              variant="outline"
              fullWidth
            />
          )}
          <CText txt="Sends through Firebase → Expo Push → your device." size="xs" color={colors.textMuted} style={s.hint} />
        </View>

        <View style={s.card}>
          <CText tx="notifications_screen.cloud_test_label" size="xs" weight="semiBold" color={colors.textMuted} style={s.sectionLabel} />
          {sending ? (
            <ActivityIndicator style={s.spinner} color={colors.primary} />
          ) : (
            <CButton
              tx="notifications_screen.send_test"
              onPress={handleSendWelcome}
              variant="solid"
              fullWidth
            />
          )}
          <CText tx="notifications_screen.firebase_hint" size="xs" color={colors.textMuted} style={s.hint} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.background },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  backBtn:    { padding: 4 },
  body:       { flex: 1, padding: 16, gap: 12 },
  card:       { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  monoValue:  { fontFamily: 'monospace', flexWrap: 'wrap' },
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.5 },
  spinner:    { marginVertical: 12 },
  hint:       { textAlign: 'center', marginTop: 4 },
  divider:    { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 10 },
});
