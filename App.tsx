import { NavigationContainer } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/core/i18n';
import { useInitielize, useTheme } from './src/core/hook';
import { DrawerNavigation, navigationRef } from './src/navigation';
import React, { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthStore } from './src/core/store';
import { CustomAlert, PasswordPromptModal } from './src/core/component';
import { MoneyFlowIntroScreen } from './src/features/onboarding';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppColors } from './src/core/utils';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function AppContent() {

  const isAuthLoading       = useAuthStore((s) => s.isAuthLoading);
  const isAuthenticated     = useAuthStore((s) => s.isAuthenticated);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const { colors }          = useTheme();

  useEffect(() => {
    if (!isAuthLoading) {
      SplashScreen.hideAsync();
    }
  }, [isAuthLoading]);

  // Feature-tour intro — tracked in Firestore (users/{uid}.onboardingCompleted),
  // not on-device, so it follows the account rather than the install. That
  // means it can only show once we know who's logged in.
  const showAppIntro = !isAuthLoading && isAuthenticated && onboardingCompleted === false;

  const styles = makeStyles(colors);
  return (
    <View style={styles.root}>
      {/*
        DrawerNavigation MUST always be mounted — it owns the onAuthStateChanged
        and onSnapshot listeners that resolve isAuthLoading and onboardingCompleted.
        Unmounting it (e.g. returning null above) creates a deadlock.
      */}
      <DrawerNavigation />

      {/* Covers the drawer while auth is still resolving */}
      {isAuthLoading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Full-screen feature tour for accounts that haven't completed it */}
      {showAppIntro && (
        <View style={StyleSheet.absoluteFill}>
          <MoneyFlowIntroScreen onDone={() => {}} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  useInitielize();

  return (
    <I18nextProvider i18n={i18n}>
      <NavigationContainer ref={navigationRef}>
        <AppContent />
      </NavigationContainer>
      <Toast />
      <CustomAlert />
      <PasswordPromptModal />
    </I18nextProvider>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  root: { flex: 1 , backgroundColor: colors.background},
});
