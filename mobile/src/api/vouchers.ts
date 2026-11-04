import { apiClient } from './client';
import { VoucherAdmin, VoucherInput, VoucherView } from '../types/api';

export type VoucherManageStatus = 'active' | 'inactive' | 'expired' | 'all';

export const vouchersApi = {
  featured: () => apiClient.get<any, VoucherView[]>('/vouchers/featured'),

  available: (params: { restaurantId: string; subtotal: number; deliveryFee?: number }) =>
    apiClient.get<any, VoucherView[]>('/vouchers/available', { params }),

  wallet: (tab: 'available' | 'history') =>
    apiClient.get<any, VoucherView[]>('/vouchers/wallet', { params: { tab } }),

  // Quản lý: admin (toàn sàn) hoặc chủ quán (truyền restaurantId)
  list: (restaurantId: string | undefined, params: { status?: VoucherManageStatus; kind?: string; q?: string }) =>
    apiClient.get<any, VoucherAdmin[]>(restaurantId ? `/restaurants/${restaurantId}/vouchers` : '/admin/vouchers', {
      params,
    }),

  create: (restaurantId: string | undefined, data: VoucherInput) =>
    apiClient.post<any, VoucherAdmin>(restaurantId ? `/restaurants/${restaurantId}/vouchers` : '/admin/vouchers', data),

  update: (restaurantId: string | undefined, id: string, data: Partial<VoucherInput>) =>
    apiClient.patch<any, VoucherAdmin>(
      restaurantId ? `/restaurants/${restaurantId}/vouchers/${id}` : `/admin/vouchers/${id}`,
      data,
    ),
};
