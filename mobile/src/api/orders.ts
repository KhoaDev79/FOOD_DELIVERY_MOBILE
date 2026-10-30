import { apiClient } from './client';
import { DriverStats, OrderDetail, OrderQuoteResponse, OrderSummary, PaginatedResult } from '../types/api';

export interface OrderItemPayload {
  menuItemId: string;
  quantity: number;
  note?: string;
  /** Mã tuỳ chọn của món; backend tra giá theo các mã này. */
  sizeId?: string;
  toppingIds?: string[];
  level?: string;
}

export interface QuoteOrderPayload {
  restaurantId: string;
  items: OrderItemPayload[];
  addressId: string;
}

export interface CreateOrderPayload {
  restaurantId: string;
  items: OrderItemPayload[];
  addressId: string;
  quoteToken: string;
  note?: string;
}

export const ordersApi = {
  quote: (payload: QuoteOrderPayload) => apiClient.post<any, OrderQuoteResponse>('/orders/quote', payload),

  create: (payload: CreateOrderPayload, idempotencyKey?: string) =>
    apiClient.post<any, OrderDetail>(
      '/orders',
      payload,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),

  getMine: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderSummary>>('/orders/my', { params }),

  getDetail: (id: string) => apiClient.get<any, OrderDetail>(`/orders/${id}`),

  cancel: (id: string) => apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, { status: 'CANCELLED' }),

  updateStatus: (id: string, status: string) => apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, { status }),

  // ===================== DRIVER ENDPOINTS =====================
  getAvailable: (params?: { page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/available', { params }),

  getDeliveries: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/deliveries', { params }),

  acceptOrder: (id: string) => apiClient.post<any, OrderDetail>(`/orders/${id}/accept`),

  getDriverStats: (params?: { days?: number }) =>
    apiClient.get<any, DriverStats>('/orders/driver/stats', { params }),

  /** Khách chấm điểm quán (1–5 sao) cho đơn đã giao; điểm trung bình của quán được cập nhật. */
  review: (id: string, data: { rating: number; comment?: string }) =>
    apiClient.post<any, unknown>(`/orders/${id}/review`, data),
};
