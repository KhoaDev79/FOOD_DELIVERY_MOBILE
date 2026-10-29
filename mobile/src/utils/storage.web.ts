import AsyncStorage from '@react-native-async-storage/async-storage';

export const appStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // fallback
    }
    await AsyncStorage.setItem(key, value);
  },
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // fallback
    }
    return AsyncStorage.getItem(key);
  },
  deleteItem: async (key: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // fallback
    }
    await AsyncStorage.removeItem(key);
  },
};
