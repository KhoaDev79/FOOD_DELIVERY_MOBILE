import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usersApi } from '../api/users';
import { useAuthStore } from '../store/useAuthStore';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
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
            lightColor: '#EE4D2D',
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
}
