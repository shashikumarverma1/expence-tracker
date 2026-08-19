import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
// fetchUserProfile is kept for direct one-off reads if needed elsewhere
import { db } from '../../../core/config';
import { collections } from '../../../core/enum/eCollections';

export interface FirestoreUserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    isAdmin: boolean;
    isPro: boolean;
    onboardingCompleted: boolean;
    createdAt?: any;
}

/**
 * Creates a user document in Firestore only if it does not already exist.
 * This preserves any isAdmin value set manually in the Firestore console.
 */
export const ensureUserProfile = async (
    uid: string,
    email: string | null,
    displayName: string | null
): Promise<void> => {
    const ref = doc(db, collections.users, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            uid,
            email,
            displayName,
            isAdmin: false,
            isPro: false,
            onboardingCompleted: false,
            createdAt: serverTimestamp(),
        });
    }
};

/**
 * Fetches a user's Firestore profile and returns it, or null if not found.
 */
export const fetchUserProfile = async (
    uid: string
): Promise<FirestoreUserProfile | null> => {
    const ref = doc(db, collections.users, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { uid, ...(snap.data() as Omit<FirestoreUserProfile, 'uid'>) };
};
