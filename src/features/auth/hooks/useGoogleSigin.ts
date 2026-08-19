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
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // ← add this 
            offlineAccess: true,
            scopes: ["profile", "email"],
        });
    }, []);

    const signInWithGoogle = async () => {
        setLoading(true);
        setError(null);
        // return
        try {
            if (Platform.OS === "android") {
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            }

            const response = await GoogleSignin.signIn();

            if (response.type !== "success") {
                console.log("Sign-in not successful:", response.type);
                return;
            }

            const idToken = response.data?.idToken;
            //   console.log("idToken:", idToken);

            if (!idToken) {
                throw new Error("No idToken returned — check iosClientId and webClientId config");
            }

            const credential = GoogleAuthProvider.credential(idToken);
            const userCredential = await signInWithCredential(auth, credential);

            console.log("Firebase user:", userCredential.user.email);
            return userCredential.user;

        } catch (err: any) {
            // ✅ Log real error instead of hiding it
            console.error("Google Sign-In error code:", err.code);
            console.error("Google Sign-In error message:", err.message);

            if (err.code === statusCodes.SIGN_IN_CANCELLED) {
                setError("Sign-in cancelled");
            } else if (err.code === statusCodes.IN_PROGRESS) {
                setError("Sign-in already in progress");
            } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                setError("Play Services not available");
            } else {
                setError(err.message ?? "Something went wrong");
            }
        } finally {
            setLoading(false);
        }
    };

    return { signInWithGoogle, loading, error };
}