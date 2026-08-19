import { useState, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../../../core/config';
import { useFirebaseStorage } from '../../../core/hook';
import { useAuthStore } from '../../../core/store';

export const useProfile = () => {
  const { pickAndUpload, takeAndUpload, uploading, progress, error: uploadError, clearError } = useFirebaseStorage();

  const user = auth.currentUser;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL ?? null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const uploadOptions = { allowsEditing: true, aspect: [1, 1], quality: 0.7 };

  const applyNewAvatar = useCallback(async (url: string) => {
    const userId = user?.uid;
    if (!userId || !user) return;
    // Update Firebase Auth profile so photoURL persists across sessions
    await updateProfile(user, { photoURL: url });
    await updateDoc(doc(db, 'users', userId), { photoURL: url });
    setAvatarUrl(url);
  }, [user]);

  const handlePickFromLibrary = useCallback(async () => {
    setShowSourceModal(false);
    const userId = user?.uid;
    if (!userId) return;
    const url = await pickAndUpload(`avatars/${userId}/profile.jpg`, uploadOptions);
    if (url) await applyNewAvatar(url as string);
  }, [user, pickAndUpload, applyNewAvatar]);

  const handleTakePhoto = useCallback(async () => {
    setShowSourceModal(false);
    const userId = user?.uid;
    if (!userId) return;
    const url = await takeAndUpload(`avatars/${userId}/profile.jpg`, uploadOptions);
    if (url) await applyNewAvatar(url as string);
  }, [user, takeAndUpload, applyNewAvatar]);

  const handleSave = useCallback(async () => {
    const userId = user?.uid;
    if (!userId || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile(user, { displayName });
      await updateDoc(doc(db, 'users', userId), { displayName });
      // Push the new name into the auth store so the home screen updates immediately
      const storeUser = useAuthStore.getState().user;
      if (storeUser) useAuthStore.getState().setUser({ ...storeUser, displayName });
    } catch (e: any) {
      setSaveError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [user, displayName]);

  return {
    avatarUrl,
    displayName,
    setDisplayName,
    email: user?.email ?? '',
    uploading,
    progress,
    uploadError,
    clearUploadError: clearError,
    saving,
    saveError,
    showSourceModal,
    setShowSourceModal,
    handlePickFromLibrary,
    handleTakePhoto,
    handleSave,
  };
};
