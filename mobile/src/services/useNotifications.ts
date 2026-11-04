import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

/** Lấy số thông báo chưa đọc (đồng bộ realtime qua socket `notification:new`) */
export function useUnreadNotificationsCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: async () => {
      const res = await notificationsApi.getUnreadCount();
      return res.unreadCount;
    },
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Lấy danh sách thông báo phân trang */
export function useNotificationsList(page = 1, limit = 20) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.notifications.list(page),
    queryFn: () => notificationsApi.list(page, limit),
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
}

/** Đánh dấu một thông báo là đã đọc */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Đánh dấu tất cả thông báo là đã đọc */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Xoá một thông báo */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

