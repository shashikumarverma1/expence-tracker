import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

interface SendNotificationParams {
  uid: string;
  title: string;
  body: string;
  notifData?: Record<string, unknown>;
}

interface NotificationResult {
  success: boolean;
  tickets: Array<{ status: string; id?: string; message?: string }>;
}

const getFunctionsInstance = () => getFunctions(getApp(), 'asia-south1');

export const sendWelcomeNotification = async (
  expoPushToken: string,
  displayName: string | null
): Promise<NotificationResult> => {
  const callable = httpsCallable<
    { expoPushToken: string; displayName: string | null },
    NotificationResult
  >(getFunctionsInstance(), 'sendWelcomeNotification');
  const result = await callable({ expoPushToken, displayName });
  console.log("resulit from sendWelcomeNotification", result.data);
  return result.data;
};

export const sendNotificationToUser = async (
  uid: string,
  title: string,
  body: string,
  notifData?: Record<string, unknown>
): Promise<NotificationResult> => {
  const callable = httpsCallable<SendNotificationParams, NotificationResult>(
    getFunctionsInstance(),
    'sendNotificationToUser'
  );
  const result = await callable({ uid, title, body, notifData });
  console.log(result.data , "result from sendNotificationToUser");
  return result.data;
};

export const testDailyStreakNotificationCloud = async (): Promise<void> => {
  const callable = httpsCallable(getFunctionsInstance(), 'testDailyStreakNotification');
  await callable({});
};

export const testWeeklyReportNotificationCloud = async (): Promise<void> => {
  const callable = httpsCallable(getFunctionsInstance(), 'testWeeklyReportNotification');
  await callable({});
};
