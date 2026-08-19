import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { auth } from "../../../core/config";

export function useGoogleAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ["profile", "email"],
    });
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const response = await GoogleSignin.signIn();
      if (response.type !== "success") return;

      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("No idToken returned");

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = (err as { message?: string })?.message ?? "Something went wrong";

      if (code === statusCodes.SIGN_IN_CANCELLED) {
        setError("Sign-in cancelled");
      } else if (code === statusCodes.IN_PROGRESS) {
        setError("Sign-in already in progress");
      } else if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError("Play Services not available");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return { signInWithGoogle, loading, error };
}
