import { create } from 'zustand';
import { User } from '../types/api';
import { appStorage } from '../utils/storage';

const ACCESS_TOKEN_KEY = 'food_delivery_access_token';
const REFRESH_TOKEN_KEY = 'food_delivery_refresh_token';
const USER_DATA_KEY = 'food_delivery_user_data';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  updateTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    await appStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await appStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    await appStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
  },

  updateTokens: async (accessToken, refreshToken) => {
    await appStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await appStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  updateUser: (partial) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...partial };
      appStorage.setItem(USER_DATA_KEY, JSON.stringify(updated));
      set({ user: updated });
    }
  },

  logout: async () => {
    await appStorage.deleteItem(ACCESS_TOKEN_KEY);
    await appStorage.deleteItem(REFRESH_TOKEN_KEY);
    await appStorage.deleteItem(USER_DATA_KEY);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  },

  loadStoredAuth: async () => {
    try {
      const accessToken = await appStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = await appStorage.getItem(REFRESH_TOKEN_KEY);
      const userJson = await appStorage.getItem(USER_DATA_KEY);
      const user = userJson ? (JSON.parse(userJson) as User) : null;

      if (accessToken && refreshToken) {
        set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
