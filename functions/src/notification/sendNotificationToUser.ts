import * as functions from 'firebase-functions/v1';
import { db, REGION } from '../config';
import { sendExpoNotifications } from './expo.service';

export const sendNotificationToUser = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    console.log('[sendNotificationToUser] Called with data:', JSON.stringify(data));
    console.log('[sendNotificationToUser] Caller uid:', context.auth?.uid ?? 'unauthenticated');

    if (!context.auth) {
      console.warn('[sendNotificationToUser] Unauthenticated call rejected.');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to call this function.'
      );
    }

    const callerDoc = await db.collection('users').doc(context.auth.uid).get();
    const isAdmin = callerDoc.data()?.isAdmin ?? false;
    console.log(`[sendNotificationToUser] Caller isAdmin=${isAdmin}`);

    if (!callerDoc.exists || !isAdmin) {
      console.warn(`[sendNotificationToUser] Permission denied for uid=${context.auth.uid}`);
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can send notifications.'
      );
    }

    const { uid, title, body, notifData } = data as {
      uid: string;
      title: string;
      body: string;
      notifData?: Record<string, unknown>;
    };

    if (!uid || !title || !body) {
      console.warn('[sendNotificationToUser] Missing required fields:', { uid, title, body });
      throw new functions.https.HttpsError(
        'invalid-argument',
        'uid, title, and body are required.'
      );
    }

    console.log(`[sendNotificationToUser] Looking up target user uid=${uid}`);
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.warn(`[sendNotificationToUser] Target user uid=${uid} not found.`);
      throw new functions.https.HttpsError('not-found', `User ${uid} not found.`);
    }

    const expoPushToken: string | null = userDoc.data()?.expoPushToken ?? null;
    console.log(`[sendNotificationToUser] Target expoPushToken=${expoPushToken ?? 'null'}`);

    if (!expoPushToken) {
      console.warn(`[sendNotificationToUser] No token for uid=${uid}`);
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User has no push notification token saved.'
      );
    }

    try {
      const tickets = await sendExpoNotifications([
        {
          to: expoPushToken,
          title,
          body,
          data: notifData,
          sound: 'default',
          channelId: 'myNotificationChannel',
        },
      ]);
      console.log(`[sendNotificationToUser] Success. Tickets:`, JSON.stringify(tickets));
      return { success: true, tickets, expoPushToken };
    } catch (e) {
      console.error('[sendNotificationToUser] Failed to send notification:', e);
      throw new functions.https.HttpsError('internal', 'Failed to send notification.');
    }
  });
