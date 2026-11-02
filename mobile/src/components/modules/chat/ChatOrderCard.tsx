import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ordersApi } from '../../../api/orders';
import { queryKeys } from '../../../constants/queryKeys';
import { useAuthStore } from '../../../store/useAuthStore';
import { formatDateTime, formatVND } from '../../../utils/format';
import { formatOrderEndReason } from '../../../utils/orderStatus';
import { OrderStatusBadge } from '../../ui/Badge';
import { Icon, IconName } from '../../ui/Icon';
import { Text } from '../../ui/Text';

const MAX_ITEMS = 4;

const InfoLine: React.FC<{ icon: IconName; children: React.ReactNode }> = ({ icon, children }) => (
  <View className="flex-row items-start gap-2">
    <View className="pt-0.5">
      <Icon name={icon} size="sm" tone="muted" />
    </View>
    <Text variant="caption" tone="secondary" className="flex-1">
      {children}
    </Text>
  </View>
);

/**
 * Thẻ thông tin đơn trên đầu màn Chat: luôn biết đang nói chuyện về đơn nào, khách nào, mua gì.
 * Thu gọn: mã đơn + trạng thái + tổng tiền. Chạm để xem món, khách, địa chỉ, ghi chú.
 */
export const ChatOrderCard: React.FC<{ orderId: string }> = ({ orderId }) => {
  const navigation = useNavigation<any>();
  const role = useAuthStore((s) => s.user?.role);
  const [expanded, setExpanded] = useState(false);

  const { data: order, isError } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => ordersApi.getDetail(orderId),
    staleTime: 30_000,
  });

  if (isError) return null;
  if (!order) {
    return (
      <View className="border-b border-line-subtle bg-surface px-4 py-3">
        <Text variant="caption" tone="muted">
          Đang tải thông tin đơn...
        </Text>
      </View>
    );
  }

  const code = order.id.slice(0, 8).toUpperCase();
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const endReason = formatOrderEndReason(order);
  // Màn chi tiết đơn theo vai trò; chủ quán xem đơn ở tab Đơn hàng nên không có nút này
  const detailRoute = role === 'CUSTOMER' ? 'OrderTracking' : role === 'DRIVER' ? 'DriverDeliveryDetail' : null;

  return (
    <View className="border-b border-line-subtle bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Đơn ${code}, ${formatVND(order.total)}. ${expanded ? 'Thu gọn' : 'Xem chi tiết'} thông tin đơn`}
        onPress={() => setExpanded((v) => !v)}
        className="min-h-touch flex-row items-center gap-3 px-4 py-2.5 active:bg-canvas-subtle"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
          <Icon name="receipt-outline" size="md" tone="brand" />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="body" weight="bold">
              Đơn #{code}
            </Text>
            <OrderStatusBadge status={order.status} />
          </View>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {itemCount} món · {formatVND(order.total)} · {order.paymentMethod === 'COD' ? 'Tiền mặt' : 'Đã trả online'}
          </Text>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size="md" tone="muted" />
      </Pressable>

      {expanded && (
        <View className="gap-2 px-4 pb-3">
          {role !== 'CUSTOMER' && <InfoLine icon="person-outline">Khách: {order.customer.fullName}</InfoLine>}
          {role !== 'RESTAURANT_OWNER' && <InfoLine icon="storefront-outline">Quán: {order.restaurant.name}</InfoLine>}
          {!!order.driver && role !== 'DRIVER' && (
            <InfoLine icon="bicycle-outline">Tài xế: {order.driver.fullName}</InfoLine>
          )}
          <InfoLine icon="time-outline">Đặt lúc {formatDateTime(order.createdAt)}</InfoLine>
          <InfoLine icon="location-outline">{order.deliveryAddress}</InfoLine>

          <View className="gap-1 rounded-md bg-canvas-subtle p-3">
            {order.items.slice(0, MAX_ITEMS).map((item) => (
              <View key={item.id} className="flex-row items-start justify-between gap-3">
                <Text variant="caption" className="flex-1">
                  {item.quantity} x {item.name}
                  {item.note ? ` (${item.note})` : ''}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatVND(item.lineTotal)}
                </Text>
              </View>
            ))}
            {order.items.length > MAX_ITEMS && (
              <Text variant="caption" tone="muted">
                và {order.items.length - MAX_ITEMS} món khác
              </Text>
            )}
            <View className="mt-1 flex-row justify-between border-t border-line pt-1.5">
              <Text variant="caption" weight="bold">
                Tổng thu
              </Text>
              <Text variant="caption" weight="bold">
                {formatVND(order.total)}
              </Text>
            </View>
          </View>

          {!!order.note && <InfoLine icon="chatbox-ellipses-outline">Ghi chú của khách: {order.note}</InfoLine>}
          {!!endReason && <InfoLine icon="alert-circle-outline">{endReason}</InfoLine>}

          {detailRoute && (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate(detailRoute, { orderId: order.id })}
              className="min-h-touch flex-row items-center justify-center gap-1.5 rounded-full border border-line active:bg-canvas-subtle"
            >
              <Text variant="caption" weight="semibold" tone="brand">
                Xem chi tiết đơn
              </Text>
              <Icon name="chevron-forward" size="sm" tone="brand" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};
