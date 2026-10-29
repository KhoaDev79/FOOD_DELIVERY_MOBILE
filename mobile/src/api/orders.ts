import { apiClient } from './client';
import { OrderDetail, OrderSummary, PaginatedResult, PaymentMethod } from '../types/api';

export interface CreateOrderPayload {
  restaurantId: string;
  items: {
    menuItemId: string;
    quantity: number;
    note?: string;
  }[];
  addressId?: string;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  paymentMethod: PaymentMethod;
  note?: string;
}

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    apiClient.post<any, OrderDetail>('/orders', payload),

  getMine: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderSummary>>('/orders/my', { params }),

  getDetail: (id: string) =>
    apiClient.get<any, OrderDetail>(`/orders/${id}`),

  cancel: (id: string) =>
    apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, { status: 'CANCELLED' }),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, { status }),

  // ===================== DRIVER ENDPOINTS =====================
  getAvailable: (params?: { page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/available', { params }),

  getDeliveries: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/deliveries', { params }),

  acceptOrder: (id: string) =>
    apiClient.post<any, OrderDetail>(`/orders/${id}/accept`),
};
