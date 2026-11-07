import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usersApi } from '../api/users';
import { openChat } from '../navigation/navigationRef';
import { useAuthStore } from '../store/useAuthStore';
import type { ChatChannel } from '../types/api';
import { isSocketConnected } from './useSocket';

const handledResponseIds = new Set<string>();

const CHAT_CHANNELS: readonly ChatChannel[] = ['CUSTOMER_DRIVER', 'CUSTOMER_RESTAURANT', 'RESTAURANT_DRIVER'];

/** Push tin nhắn chat hợp lệ phải có đơn và cuộc trò chuyện; push cũ không có kênh thì bỏ qua. */
const isChatPush = (
  data: unknown,
): data is {
  type: 'order_chat';
  orderId: string;
  channel: ChatChannel;
  recipientName?: string;
  recipientRole?: string;
} =>
  !!data &&
  typeof data === 'object' &&
  (data as { type?: unknown }).type === 'order_chat' &&
  typeof (data as { orderId?: unknown }).orderId === 'string' &&
  CHAT_CHANNELS.includes((data as { channel?: ChatChannel }).channel as ChatChannel);

try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // App đang mở và socket đang nối: tin nhắn đã hiện bằng thông báo nổi trong app (ChatNotifier),
      // không hiện thêm banner hệ thống để tránh báo trùng.
      const inAppHandled = isChatPush(notification.request.content.data) && isSocketConnected();
      return {
        shouldShowAlert: !inAppHandled,
        shouldPlaySound: !inAppHandled,
        shouldSetBadge: false,
        shouldShowBanner: !inAppHandled,
        shouldShowList: true,
      };
    },
  });
} catch {
  // Bỏ qua lỗi cấu hình notification handler nếu chạy trên môi trường không hỗ trợ
}

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function registerForPushNotificationsAsync() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('orders', {
            name: 'Thông báo đơn hàng',
            importance: AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF7A30',
          });
          await Notifications.setNotificationChannelAsync('order_alerts', {
            name: 'Chuông báo đơn mới (Chủ quán)',
            importance: AndroidImportance.MAX,
            vibrationPattern: [0, 500, 300, 500],
            lightColor: '#FF5722',
            lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
          });
        }

        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted') {
            return;
          }

          const token = (await Notifications.getExpoPushTokenAsync()).data;
          await usersApi.updatePushToken(token);
        }
      } catch {
        // Xử lý an toàn: Expo Go trên Android không hỗ trợ push token từ SDK 53,
        // hoặc khi không có Google Services / quyền thông báo bị từ chối
      }
    }

    registerForPushNotificationsAsync();
  }, [isAuthenticated]);

  // Chạm vào push tin nhắn (app đang chạy nền hoặc vừa được mở từ push) -> mở đúng cuộc trò chuyện
  useEffect(() => {
    if (!isAuthenticated) return;
    const openFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      // Mỗi lần chạm chỉ xử lý một lần; bỏ qua lần chạm cũ (getLastNotificationResponseAsync có thể trả lại nó)
      const tooOld = Date.now() - response.notification.date > 2 * 60 * 1000;
      if (handledResponseIds.has(id) || tooOld) return;
      handledResponseIds.add(id);
      const data = response.notification.request.content.data;
      if (isChatPush(data)) {
        openChat({
          orderId: data.orderId,
          channel: data.channel,
          recipientName: typeof data.recipientName === 'string' ? data.recipientName : undefined,
          recipientRole: typeof data.recipientRole === 'string' ? data.recipientRole : undefined,
        });
      }
    };
    Notifications.getLastNotificationResponseAsync()
      .then(openFromResponse)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => sub.remove();
  }, [isAuthenticated]);
}
