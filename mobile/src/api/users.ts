import { apiClient } from './client';
import type { FavoriteRestaurant } from '../store/useFavoritesStore';
import { Address, CreateRoleRequestPayload, RoleUpgradeRequest, User } from '../types/api';

export interface CreateAddressPayload {
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export const usersApi = {
  getMe: () => apiClient.get<any, User>('/users/me'),

  updateProfile: (data: { fullName?: string; phone?: string; email?: string; avatarUrl?: string }) =>
    apiClient.patch<any, User>('/users/me', data),

  uploadAvatar: (fileUri: string) => {
    const formData = new FormData();
    const cleanUri = fileUri.split('?')[0];
    const filename = cleanUri.split('/').pop() || `avatar-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    return apiClient.post<any, User>('/users/me/avatar', formData, {
      transformRequest: (data) => data,
    });
  },

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.patch<any, { ok: boolean; message: string }>('/users/me/password', data),

  updatePushToken: (expoPushToken: string) =>
    apiClient.put<any, { ok: boolean }>('/users/me/push-token', { expoPushToken }),

  getAddresses: () => apiClient.get<any, Address[]>('/users/me/addresses'),

  createAddress: (data: CreateAddressPayload & { isManual?: boolean }) =>
    apiClient.post<any, Address>('/users/me/addresses', data),

  updateAddress: (
    id: string,
    data: Partial<CreateAddressPayload> & { isManual?: boolean; needsConfirmation?: boolean },
  ) => apiClient.patch<any, Address>(`/users/me/addresses/${id}`, data),

  setDefaultAddress: (id: string) =>
    apiClient.patch<any, Address>(`/users/me/addresses/${id}/default`),

  deleteAddress: (id: string) => apiClient.delete(`/users/me/addresses/${id}`),

  /** Gửi yêu cầu trở thành Chủ quán / Tài xế (admin duyệt). */
  requestUpgrade: (data: CreateRoleRequestPayload) =>
    apiClient.post<any, RoleUpgradeRequest>('/users/request-upgrade', data),

  myUpgradeRequests: () => apiClient.get<any, RoleUpgradeRequest[]>('/users/request-upgrade'),

  /** Quán yêu thích của tài khoản đang đăng nhập (mới thêm trước). */
  getFavorites: () => apiClient.get<any, FavoriteRestaurant[]>('/users/me/favorites'),

  addFavorite: (restaurantId: string) => apiClient.put(`/users/me/favorites/${restaurantId}`),

  removeFavorite: (restaurantId: string) => apiClient.delete(`/users/me/favorites/${restaurantId}`),

  /** Xoá tài khoản cá nhân theo quy định kho ứng dụng */
  deleteAccount: () => apiClient.delete<any, { ok: boolean; message: string }>('/users/me'),
};

