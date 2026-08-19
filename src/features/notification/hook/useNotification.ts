import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { getExpoPushToken, saveExpoPushToken } from './expoPushToken';
import { auth } from '../../../core/config';
import { useNotificationListStore } from './useNotificationListStore';
import { navigate } from '../../../navigation/navigationRef';

export const useNotification = () => {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);

  async function schedulePushNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "You've got mail! 📬",
        body: 'Here is the notification body',
        data: { data: 'goes here', test: { test1: 'more data' } },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
  }

  useEffect(() => {
    getExpoPushToken().then(async (token) => {
      if (!token) return;
      setExpoPushToken(token);
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await saveExpoPushToken(currentUser.uid, token);
        } catch (e) {
          console.warn('[useNotification] Failed to save push token:', e);
        }
      }
    });

    if (Platform.OS === 'android') {
      Notifications.getNotificationChannelsAsync().then(value => setChannels(value ?? []));
    }

    const notificationListener = Notifications.addNotificationReceivedListener(n => {
      setNotification(n);
      const { title, body, data } = n.request.content;
      useNotificationListStore.getState().saveNotification(
        title ?? '',
        body ?? '',
        (data as Record<string, unknown>) ?? {},
      );
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen === 'HomeScreen') {
        navigate('Tabs', { screen: 'Home', params: { screen: 'HomeScreen' } });
      } else if (screen === 'InsightsScreen') {
        navigate('Tabs', { screen: 'Home', params: { screen: 'InsightsScreen' } });
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return { expoPushToken, channels, notification, schedulePushNotification };
};
