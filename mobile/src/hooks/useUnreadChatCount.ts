import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Tổng số tin nhắn chưa đọc của người đang đăng nhập (dùng cho chấm đỏ ở tab Tin nhắn / mục Tin nhắn).
 * Tự làm mới khi có tin mới hoặc vừa đọc: ChatNotifier và ChatScreen invalidate queryKeys.chat.all.
 */
export function useUnreadChatCount(): number {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data } = useQuery({
    queryKey: queryKeys.chat.unread,
    queryFn: () => ordersApi.getUnreadMessages(),
    enabled: !!userId,
    staleTime: 30_000,
    select: (summary) => summary.totalUnread,
  });
  return userId ? data ?? 0 : 0;
}
