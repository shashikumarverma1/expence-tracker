// hooks/useFirebaseStorage.js
import { useState, useCallback } from 'react';
import { ref, getDownloadURL, deleteObject, listAll, getMetadata } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { uploadAsync, downloadAsync, documentDirectory } from 'expo-file-system/legacy';
import { fbStorage as storage, auth } from '../config/firebase';

export const useFirebaseStorage = () => {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);


  // ─── Helper: Request permissions ─────────────────────────────────
  const requestPermissions = async (type = 'library') => {
    if (type === 'library') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Media library permission denied');
    } else {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') throw new Error('Camera permission denied');
    }
  };

  // ─── 1. Pick image from library ──────────────────────────────────
  const pickImage = useCallback(async (options:any = {}) => {
    try {
      await requestPermissions('library');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing ?? false,
        aspect: options.aspect ?? [1, 1],
        quality: options.quality ?? 0.8,
        allowsMultipleSelection: options.multiple ?? false,
      });

      if (result.canceled) return null;
      return options.multiple ? result.assets : result.assets[0];
    } catch (err:any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── 2. Take photo with camera ───────────────────────────────────
  const takePhoto = useCallback(async (options:any = {}) => {
    try {
      await requestPermissions('camera');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: options.allowsEditing ?? false,
        aspect: options.aspect ?? [1, 1],
        quality: options.quality ?? 0.8,
      });

      if (result.canceled) return null;
      return result.assets[0];
    } catch (err:any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── 3. Upload image ─────────────────────────────────────────────
  // Firebase JS SDK creates Blob/ArrayBuffer internally — unsupported in RN.
  // expo-file-system uploadAsync uses the native HTTP stack and avoids this.
  // Bucket is read from the configured storage ref, not process.env, so it's
  // never undefined even if the env var isn't inlined at module-init time.
  const uploadImage = useCallback(async (uri: string, path: string, onProgress?: (progress: number) => void, contentType: string = 'image/jpeg') => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const storageRef = ref(storage, path);
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageRef.bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`;

      setProgress(20);
      onProgress?.(20);

      const result = await uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
        },
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Upload failed (${result.status}): ${result.body}`);
      }

      setProgress(90);
      onProgress?.(90);

      const downloadUrl = await getDownloadURL(storageRef);

      setProgress(100);
      onProgress?.(100);

      return downloadUrl;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, []);

  // ─── 4. Pick & upload in one step ────────────────────────────────
  const pickAndUpload = useCallback(async (path: string, options:any = {}) => {
    const image:any = await pickImage(options);
    if (!image) return null;

    const storagePath = path ?? `images/${Date.now()}.jpg`;
    return await uploadImage(image.uri, storagePath, options.onProgress);
  }, [pickImage, uploadImage]);

  // ─── 5. Take photo & upload in one step ──────────────────────────
  const takeAndUpload = useCallback(async (path: string, options:any = {}) => {
    const image = await takePhoto(options);
    if (!image) return null;

    const storagePath = path ?? `images/${Date.now()}.jpg`;
    return await uploadImage(image.uri, storagePath, options.onProgress);
  }, [takePhoto, uploadImage]);

  // ─── 6. Upload multiple images ───────────────────────────────────
  const uploadMultipleImages = useCallback(async (folderPath: string, options = {}) => {
    try {
      const images:any = await pickImage({ ...options, multiple: true });
      if (!images || images.length === 0) return [];

      setUploading(true);
      const urls = await Promise.all(
        images?.map(async (image: { uri: string; }, index: any) => {
          const path = `${folderPath}/${Date.now()}_${index}.jpg`;
          return await uploadImage(image.uri, path);
        })
      );

      return urls.filter(Boolean);
    } catch (err:any) {
      setError(err.message);
      return [];
    } finally {
      setUploading(false);
    }
  }, [pickImage, uploadImage]);

  // ─── 7. Get download URL ─────────────────────────────────────────
  const getImageURL = useCallback(async (path: string) => {
    try {
      return await getDownloadURL(ref(storage, path));
    } catch (err:any) {
      console.error('Error getting download URL:', err);
      setError(err.message);
      return null;
    }
  }, []);

  // ─── 8. Delete image ─────────────────────────────────────────────
  const deleteImage = useCallback(async (path: string) => {
    try {
      await deleteObject(ref(storage, path));
      return true;
    } catch (err:any) {
      setError(err.message);
      return false;
    }
  }, []);

  // ─── 9. List all images in a folder ──────────────────────────────
  const listImages = useCallback(async (folderPath: string) => {
    try {
      const result = await listAll(ref(storage, folderPath));
      const urls = await Promise.all(
        result.items.map(async (item) => ({
          path: item.fullPath,
          name: item.name,
          url: await getDownloadURL(item),
        }))
      );
      return urls;
    } catch (err:any) {
      setError(err.message);
      return [];
    }
  }, []);

  // ─── 10. Get image metadata ──────────────────────────────────────
  const getImageMetadata = useCallback(async (path: string) => {
    try {
      return await getMetadata(ref(storage, path));
    } catch (err:any) {
      setError(err.message);
      return null;
    }
  }, []);

  // ─── 11. Download image to device ───────────────────────────────
  const downloadImage = useCallback(async (path: string, localFilename: string) => {
    try {
      setDownloading(true);
      const url = await getDownloadURL(ref(storage, path));
      const localPath = `${documentDirectory}${localFilename}`;

      const { uri } = await downloadAsync(url, localPath);
      return uri;
    } catch (err:any) {
      setError(err.message);
      return null;
    } finally {
      setDownloading(false);
    }
  }, []);

  // ─── 12. Replace image (delete old, upload new) ──────────────────
  const replaceImage = useCallback(async (oldPath: string, newUri: string, newPath: string) => {
    try {
      await deleteImage(oldPath);
      return await uploadImage(newUri, newPath);
    } catch (err:any) {
      setError(err.message);
      return null;
    }
  }, [deleteImage, uploadImage]);

  const clearError = useCallback(() => setError(null), []);

  return {
    // State
    uploading,
    downloading,
    progress,
    error,
    clearError,

    // Functions
    pickImage,
    takePhoto,
    uploadImage,
    pickAndUpload,
    takeAndUpload,
    uploadMultipleImages,
    getImageURL,
    deleteImage,
    listImages,
    getImageMetadata,
    downloadImage,
    replaceImage,
  };
};

