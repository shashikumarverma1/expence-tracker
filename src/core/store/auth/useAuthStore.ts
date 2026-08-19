import {
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
} from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { create } from 'zustand';
import { auth } from '../../config/firebase';

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAuthLoading: boolean;
  isDeleting: boolean;
  deleteError: string | null;
  // null = not yet loaded from Firestore; true/false = loaded value
  onboardingCompleted: boolean | null;
  setUser: (user: UserProfile | null) => void;
  setAdmin: (isAdmin: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  setOnboardingCompleted: (val: boolean) => void;
  logout: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  clearDeleteError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isAuthLoading: true,
  isDeleting: false,
  deleteError: null,
  onboardingCompleted: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setAdmin: (isAdmin) => set({ isAdmin }),

  setOnboardingCompleted: (val) => set({ onboardingCompleted: val }),

  setAuthLoading: (loading) => set({ isAuthLoading: loading }),

  logout: () => signOut(auth),

  clearDeleteError: () => set({ deleteError: null }),

  deleteAccount: async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    set({ isDeleting: true, deleteError: null });

    try {
      const providers = currentUser.providerData.map((p) => p.providerId);
      const isEmailProvider = providers.includes('password');
      const isGoogleProvider = providers.includes('google.com');

      if (isEmailProvider && password) {
        const credential = EmailAuthProvider.credential(currentUser.email!, password);
        await reauthenticateWithCredential(currentUser, credential);
      } else if (isGoogleProvider) {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        if (response.type !== 'success' || !response.data?.idToken) {
          throw { code: 'sign-in-cancelled' };
        }
        const credential = GoogleAuthProvider.credential(response.data.idToken);
        await reauthenticateWithCredential(currentUser, credential);
      }

      await deleteUser(currentUser);
      set({ user: null, isAuthenticated: false, isAdmin: false, isDeleting: false });
    } catch (error: any) {
      set({ isDeleting: false, deleteError: error.code ?? 'unknown-error' });
      throw error;
    }
  },
}));
