import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ordersApi } from '../../../api/orders';
import { queryKeys } from '../../../constants/queryKeys';
import { useSocket } from '../../../hooks/useSocket';
import {
  isNavigationReady,
  isViewingChat,
  openChat,
  subscribeNavigationReady,
} from '../../../navigation/navigationRef';
import { useAuthStore } from '../../../store/useAuthStore';
import { orderCode as baseOrderCode } from '../../../utils/format';
import { ChatChannel, OrderMessage, UnreadMessagesSummary } from '../../../types/api';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { Text } from '../../ui/Text';

/** Nhãn hiển thị trên màn Chat theo vai trò người gửi (giống các nút mở chat trong app). */
const ROLE_LABEL: Record<OrderMessage['senderRole'], string> = {
  CUSTOMER: 'Khách hàng',
  DRIVER: 'Tài xế giao hàng',
  RESTAURANT_OWNER: 'Quán ăn',
  ADMIN: 'Quản trị viên',
};

const LIVE_HIDE_MS = 6000;
const SUMMARY_HIDE_MS = 8000;

interface Banner {
  key: number;
  orderId: string;
  channel: ChatChannel;
  title: string;
  body: string;
  footnote?: string;
  /** Số tin dồn lại khi cùng một đơn nhắn liên tiếp. */
  count: number;
  recipientName: string;
  recipientRole: string;
}

const orderCode = (orderId: string) => `#${baseOrderCode(orderId)}`;

function bannerFromMessage(msg: OrderMessage, restaurantName?: string | null): Omit<Banner, 'key' | 'count'> {
  const senderName =
    msg.senderRole === 'RESTAURANT_OWNER' && restaurantName ? restaurantName : msg.sender?.fullName || ROLE_LABEL[msg.senderRole];
  return {
    orderId: msg.orderId,
    channel: msg.channel,
    title: `Tin nhắn mới từ ${senderName}`,
    body: msg.content,
    footnote: `Đơn ${orderCode(msg.orderId)}`,
    recipientName: senderName,
    recipientRole: ROLE_LABEL[msg.senderRole],
  };
}

function bannerFromSummary(summary: UnreadMessagesSummary): Omit<Banner, 'key'> | null {
  const latest = summary.conversations[0];
  if (!latest || summary.totalUnread <= 0) return null;
  const msg = latest.lastMessage;
  const senderName =
    msg.senderRole === 'RESTAURANT_OWNER' && latest.restaurantName ? latest.restaurantName : msg.sender.fullName;
  const others = summary.conversations.length - 1;
  return {
    orderId: latest.orderId,
    channel: latest.channel,
    title:
      summary.conversations.length === 1
        ? `${latest.unreadCount} tin nhắn chưa đọc từ ${senderName}`
        : `Bạn có ${summary.totalUnread} tin nhắn chưa đọc`,
    body: summary.conversations.length === 1 ? msg.content : `${senderName}: ${msg.content}`,
    footnote:
      others > 0
        ? `Đơn ${orderCode(latest.orderId)} và ${others} cuộc trò chuyện khác`
        : `Đơn ${orderCode(latest.orderId)}`,
    count: 1,
    recipientName: senderName,
    recipientRole: ROLE_LABEL[msg.senderRole],
  };
}

/**
 * Thông báo nổi cho tin nhắn chat theo đơn:
 * - Ngay sau khi đăng nhập (hoặc mở lại app khi vẫn đăng nhập): nếu có tin chưa đọc thì báo tóm tắt.
 * - Khi đang dùng app: tin mới (socket `chat:new`) hiện ngay, trừ khi đang mở đúng cuộc trò chuyện đó.
 * Chạm vào thông báo để mở màn Chat của đơn. Đặt bên trong NavigationContainer (App.tsx).
 */
export const ChatNotifier: React.FC = () => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<Banner | null>(null);
  const [navReady, setNavReady] = useState(isNavigationReady());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryShownFor = useRef<string | null>(null);

  useEffect(() => subscribeNavigationReady(() => setNavReady(true)), []);

  const dismiss = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setBanner(null);
  }, []);

  const show = useCallback((next: Omit<Banner, 'key'>, hideAfterMs: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setBanner((prev) => {
      // Cùng một đơn nhắn liên tiếp: gộp thành một thông báo, đếm số tin
      const count = prev && prev.orderId === next.orderId && prev.channel === next.channel ? prev.count + next.count : next.count;
      return { ...next, count, key: Date.now() };
    });
    hideTimer.current = setTimeout(() => setBanner(null), hideAfterMs);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Đăng xuất hoặc đổi tài khoản: bỏ thông báo của tài khoản trước
  useEffect(() => {
    if (!userId) summaryShownFor.current = null;
    const timer = setTimeout(() => {
      dismiss();
    }, 0);
    return () => clearTimeout(timer);
  }, [userId, dismiss]);

  // 1. Tóm tắt tin chưa đọc ngay sau khi đăng nhập (chờ qua màn splash)
  useEffect(() => {
    if (!userId || !navReady || summaryShownFor.current === userId) return;
    summaryShownFor.current = userId;
    let cancelled = false;
    ordersApi
      .getUnreadMessages()
      .then((summary) => {
        if (cancelled) return;
        const next = bannerFromSummary(summary);
        if (next && !isViewingChat(next.orderId, next.channel)) show(next, SUMMARY_HIDE_MS);
      })
      .catch(() => {
        // Không lấy được tóm tắt thì thôi: tin mới vẫn được báo qua socket và push
      });
    return () => {
      cancelled = true;
    };
  }, [userId, navReady, show]);

  // 2. Tin nhắn mới trong lúc đang dùng app
  useEffect(() => {
    if (!socket || !userId) return;
    // Có tin gửi/nhận ở bất kỳ cuộc trò chuyện nào: làm mới hộp thư và số chưa đọc
    const refreshInbox = () => queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    const onNew = (msg: OrderMessage) => {
      if (msg.senderId === userId || isViewingChat(msg.orderId, msg.channel)) return;
      show({ ...bannerFromMessage(msg), count: 1 }, LIVE_HIDE_MS);
    };
    socket.on('chat:new', onNew);
    socket.on('order:message', refreshInbox);
    return () => {
      socket.off('chat:new', onNew);
      socket.off('order:message', refreshInbox);
    };
  }, [socket, userId, show, queryClient]);

  if (!banner) return null;

  const handleOpen = () => {
    const { orderId, channel, recipientName, recipientRole } = banner;
    dismiss();
    openChat({ orderId, channel, recipientName, recipientRole });
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 px-3"
      style={{ top: insets.top + 8 }}
    >
      <Animated.View
        key={banner.key}
        entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
        exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
        accessibilityLiveRegion="polite"
        className="flex-row items-center rounded-xl border border-line-subtle bg-surface shadow-float"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${banner.title}. ${banner.body}. Chạm để mở cuộc trò chuyện`}
          onPress={handleOpen}
          className="min-h-touch flex-1 flex-row items-center gap-3 py-3 pl-3 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
            <Icon name="chatbubble-ellipses" size="md" tone="brand" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight="bold" numberOfLines={1}>
              {banner.count > 1 ? `${banner.title} (${banner.count})` : banner.title}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {banner.body}
            </Text>
            {!!banner.footnote && (
              <Text variant="micro" tone="muted" numberOfLines={1}>
                {banner.footnote}
              </Text>
            )}
          </View>
        </Pressable>
        <IconButton
          icon="close"
          accessibilityLabel="Đóng thông báo"
          variant="ghost"
          size="md"
          onPress={dismiss}
          className="mx-1"
        />
      </Animated.View>
    </View>
  );
};
