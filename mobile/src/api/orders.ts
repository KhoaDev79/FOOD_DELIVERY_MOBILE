import { apiClient } from './client';
import {
  CancelReason,
  ChatChannel,
  ChatConversation,
  DeliveryContactAttempt,
  DriverStats,
  FailedDeliveryReason,
  OrderDetail,
  OrderMessage,
  UnreadMessagesSummary,
  OrderQuoteResponse,
  OrderSummary,
  PaginatedResult,
  CancelInfo,
  RefundOrder,
} from '../types/api';

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
  /** Tối đa 1 mã giảm giá + 1 mã freeship */
  voucherCodes?: string[];
}

export interface CreateOrderPayload {
  restaurantId: string;
  items: OrderItemPayload[];
  addressId: string;
  quoteToken: string;
  note?: string;
  voucherCodes?: string[];
}

export interface UpdateOrderStatusOptions {
  cancelReason?: CancelReason;
  failedReason?: FailedDeliveryReason;
  cancelNote?: string;
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

  /** Khách huỷ đơn (chỉ khi quán chưa nhận), bắt buộc lý do */
  cancel: (id: string, cancelReason: CancelReason = 'CUSTOMER_CHANGED_MIND', cancelNote?: string) =>
    apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, {
      status: 'CANCELLED',
      cancelReason,
      cancelNote,
    }),

  getCancelInfo: (id: string) => apiClient.get<any, CancelInfo>(`/orders/${id}/cancel-info`),

  // ===================== ADMIN: HOÀN TIỀN =====================
  listRefunds: (status: 'pending' | 'done') =>
    apiClient.get<any, RefundOrder[]>('/admin/refunds', { params: { status } }),

  confirmRefund: (orderId: string, note: string) =>
    apiClient.post<any, unknown>(`/admin/refunds/${orderId}/confirm`, { note }),

  updateStatus: (id: string, status: string, opts?: UpdateOrderStatusOptions) =>
    apiClient.patch<any, OrderDetail>(`/orders/${id}/status`, { status, ...opts }),

  // ===================== DRIVER ENDPOINTS =====================
  getAvailable: (params?: { page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/available', { params }),

  getDeliveries: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>('/orders/deliveries', { params }),

  acceptOrder: (id: string) => apiClient.post<any, OrderDetail>(`/orders/${id}/accept`),

  releaseOrder: (id: string, reason: string) =>
    apiClient.post<any, OrderDetail>(`/orders/${id}/release`, { reason }),

  markArrived: (id: string, lat: number, lng: number) =>
    apiClient.post<any, OrderDetail>(`/orders/${id}/arrived`, { lat, lng }),

  recordContactAttempt: (id: string) =>
    apiClient.post<any, { attempt: DeliveryContactAttempt; totalCallsAfterArrived: number }>(
      `/orders/${id}/contact-attempts`,
    ),

  getDriverStats: (params?: { days?: number }) =>
    apiClient.get<any, DriverStats>('/orders/driver/stats', { params }),

  /** Khách chấm điểm quán (1–5 sao) cho đơn đã giao; điểm trung bình của quán được cập nhật. */
  review: (
    id: string,
    data: {
      rating: number;
      comment?: string;
      driverRating?: number;
      driverComment?: string;
      /** Tối đa 3 ảnh (data URI) */
      images?: string[];
    },
  ) => apiClient.post<any, unknown>(`/orders/${id}/review`, data),

  /** Tin nhắn chat theo đơn hàng (Khách - Tài xế - Quán) */
  getMessages: (orderId: string, channel: ChatChannel) =>
    apiClient.get<any, OrderMessage[]>(`/orders/${orderId}/messages`, { params: { channel } }),

  sendMessage: (orderId: string, channel: ChatChannel, content: string) =>
    apiClient.post<any, OrderMessage>(`/orders/${orderId}/messages`, { channel, content }),

  /** Hộp thư: các cuộc trò chuyện kèm thông tin đơn, mới nhất trước. */
  getConversations: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<any, PaginatedResult<ChatConversation>>('/orders/messages/conversations', { params }),

  /** Tin nhắn chưa đọc theo từng đơn của người đang đăng nhập. */
  getUnreadMessages: () => apiClient.get<any, UnreadMessagesSummary>('/orders/messages/unread'),

  markMessagesRead: (orderId: string, channel: ChatChannel) =>
    apiClient.post<any, { orderId: string; channel: ChatChannel; lastReadAt: string }>(
      `/orders/${orderId}/messages/read`,
      { channel },
    ),
};
