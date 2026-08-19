import * as functions from 'firebase-functions/v1';
import { db, REGION } from '../config';
import { sendExpoNotifications } from './expo.service';

export const sendWelcomeNotification = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    console.log('[sendWelcomeNotification] Called by uid:', context.auth?.uid ?? 'unauthenticated');
    console.log('[sendWelcomeNotification] Received data:', JSON.stringify(data));

    if (!context.auth) {
      console.warn('[sendWelcomeNotification] Unauthenticated call rejected.');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be logged in to call this function.'
      );
    }

    const uid = context.auth.uid;
    let expoPushToken: string | null = (data as any)?.expoPushToken ?? null;
    let displayName: string = (data as any)?.displayName ?? null;

    if (!expoPushToken || !displayName) {
      console.log(`[sendWelcomeNotification] Fetching Firestore doc for uid=${uid}`);
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        if (!expoPushToken) expoPushToken = userData['expoPushToken'] ?? null;
        if (!displayName)   displayName   = userData['displayName']   ?? 'there';
        console.log(`[sendWelcomeNotification] Firestore: displayName=${displayName}, token=${expoPushToken ?? 'null'}`);
      } else {
        console.warn(`[sendWelcomeNotification] No Firestore doc for uid=${uid}`);
        displayName = displayName ?? 'there';
      }
    }

    if (!expoPushToken) {
      console.warn(`[sendWelcomeNotification] No expoPushToken available for uid=${uid}`);
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No push token available. Make sure notification permission is granted.'
      );
    }

    try {
      const tickets = await sendExpoNotifications([
        {
          to: expoPushToken,
          title: '🎉 Welcome!',
          body: `Hi ${displayName}! Your account is ready. We're glad to have you!`,
          sound: 'default',
          channelId: 'myNotificationChannel',
        },
      ]);
      console.log(`[sendWelcomeNotification] Done. Tickets:`, JSON.stringify(tickets));
      return { success: true, tickets };
    } catch (e) {
      console.error('[sendWelcomeNotification] Failed to send:', e);
      throw new functions.https.HttpsError('internal', 'Failed to send welcome notification.');
    }
  });
