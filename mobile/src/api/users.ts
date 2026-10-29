import { apiClient } from './client';
import { Address, User } from '../types/api';

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
};

