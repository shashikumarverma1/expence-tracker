import "react-native-gesture-handler";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Purchases from "react-native-purchases";
import * as React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { RootStack } from "../stack";
import { AuthScreen, SettingsScreen, NotificationScreen, PrivacyPolicyScreen, TermsOfUseScreen } from "../../features";
import { useAuthStore } from "../../core/store";
import { useSubscriptionStore } from "../../core/store/subscription/useSubscriptionStore";
import { useTheme } from "../../core/hook";
import { auth, db } from "../../core/config/firebase";
// import SubscriptionScreen from "../../features/subscription/screens/SubscriptionScreen";
import { collections } from "../../core/enum/eCollections";
import { ensureUserProfile } from "../../features/auth/hooks/userService";

const Drawer = createDrawerNavigator();

export function DrawerNavigation() {
  const isAuthenticated      = useAuthStore((state) => state.isAuthenticated);
  const { colors } = useTheme();

  React.useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    // Safety net: if Firebase hangs for any reason, don't stay stuck loading
    const safetyTimer = setTimeout(() => {
      useAuthStore.getState().setAuthLoading(false);
    }, 8000);

    const authUnsubscribe = onAuthStateChanged(auth, async (userData: User | null) => {
      const store = useAuthStore.getState();

      profileUnsubscribe?.();
      profileUnsubscribe = null;

      store.setUser(userData);

      if (!userData) {
        store.setAdmin(false);
        store.setOnboardingCompleted(null as any);
        store.setAuthLoading(false);
        useSubscriptionStore.getState().setIsPro(false);
        Purchases.logOut().catch(() => {});
        clearTimeout(safetyTimer);
        return;
      }

      // Link RevenueCat to the Firebase Auth user so purchases are tied to the account
      Purchases.logIn(userData.uid).catch(() => {});

      // ensure the Firestore doc exists for new users — don't let a failure block loading
      ensureUserProfile(userData.uid, userData.email, userData.displayName).catch(() => {});

      let firstSnap = true;
      profileUnsubscribe = onSnapshot(
        doc(db, collections.users, userData.uid),
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const s = useAuthStore.getState();
          s.setAdmin(data.isAdmin ?? false);
          // For existing users who don't have the field yet, default to true (already onboarded)
          s.setOnboardingCompleted(data.onboardingCompleted ?? true);
          const subStore = useSubscriptionStore.getState();
          subStore.setIsPro(data.isPro ?? false);
          if (data.planType)  subStore.setPlanType(data.planType);
          if (data.planPrice) subStore.setPlanPrice(data.planPrice);
          if (data.planExpiryDate) subStore.setPlanExpiryDate(data.planExpiryDate);
          if (firstSnap) {
            firstSnap = false;
            clearTimeout(safetyTimer);
            s.setAuthLoading(false);
          }
        },
        () => {
          // Firestore error (offline, permission denied, etc.) — unblock the UI
          clearTimeout(safetyTimer);
          useAuthStore.getState().setAuthLoading(false);
        },
      );
    });

    return () => {
      clearTimeout(safetyTimer);
      authUnsubscribe();
      profileUnsubscribe?.();
    };
  }, []);

  return (
    <Drawer.Navigator
      screenOptions={{
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.textMuted,
        drawerStyle: { backgroundColor: colors.surface },
        drawerItemStyle: { marginVertical: 5 },
        headerShown: false,
      }}
      drawerContent={() => <SettingsScreen />}
    >
      {isAuthenticated ? (
        <Drawer.Screen name="Root" component={RootStack} />
      ) : (
        <Drawer.Screen name="Login">
          {() => <AuthScreen />}
        </Drawer.Screen>
      )}
      {/* <Drawer.Screen name="Subscription" component={SubscriptionScreen} /> */}
      <Drawer.Screen name="Notification" component={NotificationScreen} />
      <Drawer.Screen name="PrivacyPolicyScreen" component={PrivacyPolicyScreen} />
      <Drawer.Screen name="TermsOfUseScreen" component={TermsOfUseScreen} />
    </Drawer.Navigator>
  );
}
