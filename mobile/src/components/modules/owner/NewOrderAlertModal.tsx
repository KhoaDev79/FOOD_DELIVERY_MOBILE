import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSocket } from '../../../hooks/useSocket';
import { navigationRef } from '../../../navigation/navigationRef';
import { useAuthStore } from '../../../store/useAuthStore';
import { useOwnerSettingsStore } from '../../../store/useOwnerSettingsStore';
import { formatVND, orderCode } from '../../../utils/format';
import {
  isOrderAlertPlaying,
  startOrderAlert,
  stopOrderAlert,
} from '../../../utils/orderAlertSound';
import { Button, Icon, Text } from '../../ui';

interface AlertOrder {
  id: string;
  total?: number;
  restaurantName?: string;
  itemCount?: number;
}

export const NewOrderAlertModal: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'RESTAURANT_OWNER';

  const { socket } = useSocket();
  const { soundEnabled, vibrationEnabled, autoStopSeconds, loadSettings, isLoaded } =
    useOwnerSettingsStore();

  const [activeOrder, setActiveOrder] = useState<AlertOrder | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  // Nạp cấu hình âm thanh khi khởi động
  useEffect(() => {
    if (!isLoaded) {
      void loadSettings();
    }
  }, [isLoaded, loadSettings]);

  // Lắng nghe sự kiện socket đơn mới
  useEffect(() => {
    if (!socket || !isOwner) return;

    const handleNewOrder = (data: any) => {
      // Chỉ kích hoạt khi đơn mới ở trạng thái PENDING
      if (!data || data.status !== 'PENDING') return;

      const orderData: AlertOrder = {
        id: data.id,
        total: data.total,
        restaurantName: data.restaurantName,
        itemCount: data.itemCount,
      };

      setActiveOrder(orderData);
      setSecondsRemaining(autoStopSeconds || 120);

      // Kích hoạt chuông và rung
      void startOrderAlert({
        soundEnabled,
        vibrationEnabled,
        autoStopSeconds: autoStopSeconds || 120,
        onAutoStop: () => {
          // Khi hết 2 phút, chuông tắt nhưng modal vẫn giữ cho đến khi quán bấm xử lý
        },
      });
    };

    socket.on('order:created', handleNewOrder);
    socket.on('order:payment', handleNewOrder);

    return () => {
      socket.off('order:created', handleNewOrder);
      socket.off('order:payment', handleNewOrder);
    };
  }, [socket, isOwner, soundEnabled, vibrationEnabled, autoStopSeconds]);

  // Bộ đếm lùi thời gian
  useEffect(() => {
    if (!activeOrder) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeOrder]);

  const handleDismissSound = () => {
    stopOrderAlert();
  };

  const handleViewOrder = () => {
    stopOrderAlert();
    setActiveOrder(null);

    // Chuyển tới màn hình đơn hàng của quán
    try {
      if (navigationRef.isReady()) {
        // React Navigation 7: tab nằm trong khung "OwnerTabs", phải ghi rõ khung cha khi điều hướng từ ngoài vào
        (navigationRef.navigate as (name: string, params?: object) => void)('OwnerTabs', { screen: 'OwnerOrdersTab' });
      }
    } catch {
      // Bỏ qua nếu navigator chưa sẵn sàng
    }
  };

  if (!isOwner || !activeOrder) {
    return null;
  }

  const isRinging = isOrderAlertPlaying();
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <Modal
      visible={Boolean(activeOrder)}
      transparent
      animationType="fade"
      onRequestClose={handleDismissSound}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl border-2 border-brand-500">
          {/* Header chuông nhấp nháy */}
          <View className="items-center mb-4">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50 border-2 border-brand-200">
              <Icon name="notifications" size="xl" tone="brand" />
            </View>
            <Text variant="title" weight="bold" tone="brand" className="mt-3 text-center uppercase tracking-wide">
              CÓ ĐƠN HÀNG MỚI!
            </Text>
            {activeOrder.restaurantName && (
              <Text variant="caption" tone="secondary" className="mt-0.5 text-center">
                {activeOrder.restaurantName}
              </Text>
            )}
          </View>

          {/* Chi tiết đơn */}
          <View className="rounded-2xl bg-canvas-subtle p-4 border border-line mb-4 items-center">
            <Text variant="caption" tone="secondary">
              Mã đơn hàng
            </Text>
            <Text variant="title" weight="bold" className="mt-0.5 tracking-wider font-mono">
              #{orderCode(activeOrder.id)}
            </Text>

            {typeof activeOrder.total === 'number' && (
              <View className="mt-2 items-center">
                <Text variant="caption" tone="secondary">
                  Giá trị đơn
                </Text>
                <Text variant="headline" weight="bold" tone="brand" className="mt-0.5">
                  {formatVND(activeOrder.total)}
                </Text>
              </View>
            )}

            {/* Đếm lùi tự động tắt chuông */}
            <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-1 border border-line">
              <Icon name="time-outline" size="xs" tone={secondsRemaining < 30 ? 'danger' : 'muted'} />
              <Text
                variant="micro"
                weight="medium"
                tone={secondsRemaining < 30 ? 'danger' : 'secondary'}
              >
                {isRinging ? `Chuông tự tắt sau: ${timeString}` : 'Đã tắt chuông báo'}
              </Text>
            </View>
          </View>

          {/* Các nút hành động */}
          <View className="gap-2.5">
            <Button
              label="Xem & Nhận đơn ngay"
              variant="primary"
              size="lg"
              leftIcon="receipt-outline"
              onPress={handleViewOrder}
            />

            {isRinging && (
              <Button
                label="Tắt chuông báo"
                variant="outline"
                size="md"
                leftIcon="volume-mute-outline"
                onPress={handleDismissSound}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
