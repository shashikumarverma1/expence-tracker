import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { navigate } from '../../../navigation/navigationRef';

export function useNotificationObserver() {
  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse) {
      navigate('NotificationListScreen');
    }

    // Handle tap on a notification that opened/foregrounded the app
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);
}
