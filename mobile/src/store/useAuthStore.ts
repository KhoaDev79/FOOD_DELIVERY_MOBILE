import axios from 'axios';
import { create } from 'zustand';
import { API_BASE_URL } from '../constants/config';
import { User } from '../types/api';
import { appStorage } from '../utils/storage';
import { useCartStore } from './useCartStore';
import { useDeliveryAddressStore } from './useDeliveryAddressStore';

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
    // Báo server thu hồi phiên của thiết bị này (thiết bị khác vẫn đăng nhập). Gửi ngầm, lỗi mạng thì bỏ qua.
    // Dùng axios thường (không qua apiClient) để tránh vòng lặp: 401 -> làm mới phiên thất bại -> logout -> 401...
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken }, { timeout: 5000 }).catch(() => undefined);
    }
    await appStorage.deleteItem(ACCESS_TOKEN_KEY);
    await appStorage.deleteItem(REFRESH_TOKEN_KEY);
    await appStorage.deleteItem(USER_DATA_KEY);
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
    // Giỏ hàng và địa chỉ giao đang chọn lưu trên máy, thuộc về tài khoản vừa đăng xuất: xoá đi để
    // người dùng sau (máy dùng chung, tài khoản khác) không thấy giỏ / địa chỉ của người trước.
    // Giỏ thêm khi CHƯA đăng nhập vẫn giữ khi đăng nhập (để thanh toán tiếp), chỉ xoá lúc đăng xuất.
    useCartStore.getState().clearCart();
    await useDeliveryAddressStore.getState().resetSelection();
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
