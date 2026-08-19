import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { db, REGION } from './config';
import { sendExpoNotifications } from './notification/expo.service';

function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your reflection streak today 🌱';
  if (streak === 1) return 'Day 1 complete! Keep it going 🔥';
  if (streak <= 6)  return `Don't break your ${streak} day streak! 🔥`;
  return `Incredible! ${streak} days strong! 🔥 Don't stop now`;
}

// Runs every hour — sends to users whose reminderTime hour matches current IST hour.
export const sendDailyStreakReminders = functions
  .region(REGION)
  .pubsub
  .schedule('every 60 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const now         = new Date();
    const istOffset   = 5.5 * 60 * 60 * 1000;
    const ist         = new Date(now.getTime() + istOffset);
    const currentHour = ist.getUTCHours();

    console.log(`[dailyStreak] Running for IST hour=${currentHour}`);

    const usersSnap = await db.collection('users').get();
    const targets: Array<{ token: string; streak: number }> = [];

    usersSnap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
      const data         = doc.data();
      const reminderTime = data.onboarding?.reminderTime as string | undefined;
      const token        = data.expoPushToken as string | undefined;
      if (!reminderTime || !token) return;

      const hour = parseInt(reminderTime.split(':')[0], 10);
      if (hour !== currentHour) return;

      targets.push({ token, streak: (data.streakDays as number | undefined) ?? 0 });
    });

    if (targets.length === 0) {
      console.log('[dailyStreak] No users to notify this hour');
      return;
    }

    const messages = targets.map(({ token, streak }) => ({
      to:        token,
      title:     'ReflectAI',
      body:      getStreakMessage(streak),
      sound:     'default' as const,
      channelId: 'myNotificationChannel',
      data:      { screen: 'HomeScreen' },
    }));

    await sendExpoNotifications(messages);
    console.log(`[dailyStreak] Sent to ${targets.length} users`);
  });

// Callable — sends the streak notification immediately to the calling user (for testing).
export const testDailyStreakNotification = functions
  .region(REGION)
  .https.onCall(async (_data: unknown, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    const snap  = await db.collection('users').doc(uid).get();
    const data  = snap.data() ?? {};
    const token  = data.expoPushToken as string | undefined;
    const streak = (data.streakDays as number | undefined) ?? 0;

    if (!token) throw new functions.https.HttpsError('failed-precondition', 'No push token saved for this user');

    const tickets = await sendExpoNotifications([{
      to:        token,
      title:     'ReflectAI',
      body:      getStreakMessage(streak),
      sound:     'default',
      channelId: 'myNotificationChannel',
      data:      { screen: 'HomeScreen' },
    }]);

    return { success: true, streak, message: getStreakMessage(streak), tickets };
  });
