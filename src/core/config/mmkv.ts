import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  getString: (key: string): string | undefined => undefined, // sync read not possible
  set: (key: string, value: string) => AsyncStorage.setItem(key, value),
  delete: (key: string) => AsyncStorage.removeItem(key),
  getAsync: (key: string) => AsyncStorage.getItem(key),
};