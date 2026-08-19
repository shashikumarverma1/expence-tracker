import { InteractionManager, Linking, Platform, Share } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../core/hook';
import { useAuthStore } from '../../../core/store';
import { showAlert } from '../../../core/store/alert/useAlertStore';

// TODO: replace with the numeric Apple App Store id once the app is published on iOS
const APPLE_APP_ID = 'YOUR_APPLE_APP_ID';
const ANDROID_PACKAGE_NAME = 'com.tradelog.journal';

const IOS_STORE_URL = `itms-apps://itunes.apple.com/app/id${APPLE_APP_ID}?action=write-review`;
const ANDROID_STORE_URL = `market://details?id=${ANDROID_PACKAGE_NAME}`;
const APP_SHARE_URL = Platform.select({
  ios: `https://apps.apple.com/app/id${APPLE_APP_ID}`,
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}&pcampaignid=web_share`,
  default: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}&pcampaignid=web_share`,
});

export const useSettings = () => {
  const navigation = useNavigation();
  const { colors, mode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { logout, isAdmin } = useAuthStore();

  const isDark = mode === 'dark';

  const handleLogout = () => {
    showAlert(t('logout'), `${t('logout')}?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'), style: 'destructive', onPress: () => {
          logout();
          navigation.dispatch(DrawerActions.closeDrawer());
        }
      },
    ]);
  };

  // Close the drawer and wait for its animation to finish before navigating.
  // Firing navigate() while the close animation runs causes a freeze.
  const closeAndNavigate = (action: () => void) => {
    navigation.dispatch(DrawerActions.closeDrawer());
    InteractionManager.runAfterInteractions(action);
  };

  const navigateToProfile = () =>
    closeAndNavigate(() =>
      (navigation as any).navigate('Root', {
        screen: 'MainTabs',
        params: { screen: 'Home', params: { screen: 'ProfileScreen' } },
      })
    );

  const navigateToNotification = () =>
    closeAndNavigate(() => (navigation as any).navigate('Notification'));

  const navigateToSubscription = () =>
    closeAndNavigate(() =>
      (navigation as any).navigate('Root', {
        screen: 'MainTabs',
        params: { screen: 'Home', params: { screen: 'SubscriptionScreen' } },
      })
    );

  const rateApp = () => {
    const storeUrl = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    Linking.openURL(storeUrl).catch(() => {
      Linking.openURL(APP_SHARE_URL!).catch(() => {});
    });
  };

  const shareApp = () => {
    Share.share({
      message: `Check out TradeLog! ${APP_SHARE_URL}`,
      url: APP_SHARE_URL, // used by iOS share sheet
    }).catch(() => {});
  };

  return {
    navigation,
    colors,
    isDark,
    toggleTheme,
    isAdmin,
    t,
    i18n,
    handleLogout,
    navigateToProfile,
    navigateToNotification,
    navigateToSubscription,
    rateApp,
    shareApp,
  };
};
