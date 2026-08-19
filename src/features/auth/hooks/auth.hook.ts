import { useState } from "react";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { t } from "i18next";
import Toast from "react-native-toast-message";
import { SigninFormData, UserFormData } from "../types";
import { auth } from "../../../core/config";
import { useGoogleAuth } from "./useGoogleSignin";

import { ensureUserProfile } from "./userService";
import { getAuthErrorMessage } from "../../../core/utils/authErrorMaper";

export const useAuthHook = () => {
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const signIn = async (data: SigninFormData) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      Toast.show({ type: "success", text1: t("auth.welcome_back") });
    } catch (error: any) {
      Toast.show({ type: "error", text1: t("auth.sign_in_failed"), text2: getAuthErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: UserFormData) => {
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
      await ensureUserProfile(credential.user.uid, userData.email, userData.name ?? null);
      Toast.show({ type: "success", text1: t("auth.account_created"), text2: t("auth.welcome_aboard") });
    } catch (error: any) {
      Toast.show({ type: "error", text1: t("auth.registration_failed"), text2: getAuthErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      Toast.show({ type: "success", text1: t("auth.reset_email_sent_title"), text2: t("auth.reset_email_sent_msg") });
      return true;
    } catch (error: any) {
      Toast.show({ type: "error", text1: t("auth.reset_failed"), text2: getAuthErrorMessage(error) });
      return false;
    } finally {
      setResetLoading(false);
    }
  };

  return {
    register,
    signIn,
    loading,
    signInWithGoogle,
    googleLoading,
    googleError,
    resetPassword,
    resetLoading,
  };
};
