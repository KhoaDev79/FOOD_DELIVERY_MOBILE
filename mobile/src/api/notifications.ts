import { apiClient } from './client';
import { AppNotification, NotificationListResponse } from '../types/api';

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<any, NotificationListResponse>('/notifications', {
      params: { page, limit },
    }),

  getUnreadCount: () =>
    apiClient.get<any, { unreadCount: number }>('/notifications/unread-count'),

  markAsRead: (id: string) =>
    apiClient.patch<any, AppNotification>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    apiClient.post<any, { count: number }>('/notifications/read-all'),

  delete: (id: string) =>
    apiClient.delete<any, { success: boolean }>(`/notifications/${id}`),
};
