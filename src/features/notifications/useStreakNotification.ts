import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../core/config';
import { collections } from '../../core/enum/eCollections';

const NOTIF_ID_KEY = 'streak_notif_id';

export function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your reflection streak today 🌱';
  if (streak === 1) return 'Day 1 complete! Keep it going 🔥';
  if (streak <= 6)  return `Don't break your ${streak} day streak! 🔥`;
  return `Incredible! ${streak} days strong! 🔥 Don't stop now`;
}

export async function cancelStreakNotification(): Promise<void> {
  const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
}

export async function scheduleStreakNotification(
  streak: number,
  reminderTime: string,
): Promise<void> {
  const parts  = reminderTime.split(':');
  const hour   = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return;

  await cancelStreakNotification();

  const { status } = await Notifications.getPermissionsAsync();
  let granted = status === 'granted';
  if (!granted) {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    granted = asked === 'granted';
  }
  if (!granted) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'ReflectAI',
      body:  getStreakMessage(streak),
      sound: true,
      data:  { screen: 'HomeScreen' },
    },
    trigger: {
      type:   Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
}

// Reads streak + reminderTime from Firestore and reschedules the notification.
export async function rescheduleStreakNotificationForUser(uid: string): Promise<void> {
  try {
    const snap = await getDoc(doc(db, collections.users, uid));
    if (!snap.exists()) return;
    const data        = snap.data();
    const streak      = (data.streakDays as number | undefined) ?? 0;
    const reminderTime = (data.onboarding?.reminderTime as string | undefined);
    if (!reminderTime) return;
    await scheduleStreakNotification(streak, reminderTime);
  } catch (e) {
    console.warn('[StreakNotif] reschedule failed:', e);
  }
}
