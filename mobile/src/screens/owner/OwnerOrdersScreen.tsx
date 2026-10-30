import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ordersApi } from '../../api/orders';
import { restaurantsApi } from '../../api/restaurants';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FilterChip,
  Icon,
  LoadingSpinner,
  OrderStatusBadge,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useSocket, useSocketConnected } from '../../hooks/useSocket';
import { palette } from '../../theme';
import { CancelReason, OrderDetail, OrderStatus } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';
import { CANCEL_REASON_LABELS, formatOrderEndReason } from '../../utils/orderStatus';

/** Bộ lọc theo đủ các trạng thái của đơn (kể cả Giao thất bại và Đã huỷ). */
const STATUS_TABS: { label: string; value?: OrderStatus }[] = [
  { label: 'Tất cả' },
  { label: 'Chờ nhận', value: 'PENDING' },
  { label: 'Đã nhận', value: 'CONFIRMED' },
  { label: 'Đang chuẩn bị', value: 'PREPARING' },
  { label: 'Chờ tài xế', value: 'READY_FOR_PICKUP' },
  { label: 'Đang giao', value: 'PICKED_UP' },
  { label: 'Hoàn thành', value: 'DELIVERED' },
  { label: 'Giao thất bại', value: 'DELIVERY_FAILED' },
  { label: 'Đã huỷ', value: 'CANCELLED' },
];

const OWNER_CANCEL_REASONS: CancelReason[] = [
  'RESTAURANT_OUT_OF_STOCK',
  'RESTAURANT_CLOSED',
  'RESTAURANT_OTHER',
];

/** Hành động chủ quán được phép làm, khớp với quy tắc chuyển trạng thái ở backend (order-state-machine). */
interface OrderAction {
  to: OrderStatus;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  destructive?: boolean;
}

const NEXT_ACTION: Partial<Record<OrderStatus, OrderAction>> = {
  PENDING: {
    to: 'CONFIRMED',
    label: 'Nhận đơn',
    confirmTitle: 'Nhận đơn này?',
    confirmMessage: 'Khách hàng sẽ được báo là quán đã nhận đơn.',
  },
  CONFIRMED: {
    to: 'PREPARING',
    label: 'Bắt đầu chuẩn bị',
    confirmTitle: 'Bắt đầu chuẩn bị món?',
    confirmMessage: 'Đơn sẽ chuyển sang trạng thái "Đang chuẩn bị món".',
  },
  PREPARING: {
    to: 'READY_FOR_PICKUP',
    label: 'Món đã sẵn sàng',
    confirmTitle: 'Món đã sẵn sàng?',
    confirmMessage: 'Tài xế sẽ được báo đến quán lấy món.',
  },
};

/** Chủ quán huỷ khi đơn ở PENDING, CONFIRMED, hoặc PREPARING (PREPARING chỉ cho phép hết món). */
const CANCEL_ACTION: Partial<Record<OrderStatus, OrderAction>> = {
  PENDING: {
    to: 'CANCELLED',
    label: 'Từ chối',
    confirmTitle: 'Từ chối đơn này?',
    confirmMessage: 'Chọn lý do từ chối đơn để thông báo cho khách hàng.',
    destructive: true,
  },
  CONFIRMED: {
    to: 'CANCELLED',
    label: 'Huỷ đơn',
    confirmTitle: 'Huỷ đơn này?',
    confirmMessage: 'Chọn lý do huỷ đơn để thông báo cho khách hàng và tài xế.',
    destructive: true,
  },
  PREPARING: {
    to: 'CANCELLED',
    label: 'Báo hết món',
    confirmTitle: 'Huỷ đơn do hết nguyên liệu?',
    confirmMessage: 'Khi đang chuẩn bị món, chỉ có thể huỷ đơn với lý do hết món / nguyên liệu.',
    destructive: true,
  },
};

/** Dòng chữ cho trạng thái chủ quán không cần thao tác. */
const WAITING_NOTE: Partial<Record<OrderStatus, { icon: 'time-outline' | 'bicycle-outline'; text: string }>> = {
  READY_FOR_PICKUP: { icon: 'time-outline', text: 'Đang chờ tài xế đến lấy món' },
  PICKED_UP: { icon: 'bicycle-outline', text: 'Tài xế đang giao cho khách' },
};

const EMPTY_PAGE = { items: [] as OrderDetail[], total: 0, page: 1, limit: 50, hasMore: false };

export const OwnerOrdersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const toast = useToast();
  const { socket } = useSocket();
  const socketConnected = useSocketConnected();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<{ order: OrderDetail; action: OrderAction } | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>('RESTAURANT_OUT_OF_STOCK');

  // 1. Quán của chủ quán
  const { data: restaurants, isLoading: loadingRest } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });
  const restaurant = restaurants?.[0];

  // 2. Tất cả đơn (dùng để đếm số đơn mỗi trạng thái; trùng khoá với bộ lọc "Tất cả" nên không gọi thêm API)
  const allOrders = useQuery({
    queryKey: ['owner', 'orders', restaurant?.id, undefined],
    queryFn: () =>
      restaurant ? restaurantsApi.getRestaurantOrders(restaurant.id, { limit: 50 }) : Promise.resolve(EMPTY_PAGE),
    enabled: Boolean(restaurant?.id),
    refetchInterval: socketConnected ? false : 10000,
  });

  // 3. Đơn theo bộ lọc đang chọn
  const filtered = useQuery({
    queryKey: ['owner', 'orders', restaurant?.id, selectedStatus],
    queryFn: () =>
      restaurant
        ? restaurantsApi.getRestaurantOrders(restaurant.id, { status: selectedStatus, limit: 50 })
        : Promise.resolve(EMPTY_PAGE),
    enabled: Boolean(restaurant?.id),
    refetchInterval: socketConnected ? false : 10000,
  });

  // Socket: có đơn mới / đổi trạng thái thì tải lại mọi danh sách đơn của quán
  useEffect(() => {
    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
    };
    socket?.on('order:created', handleOrderUpdate);
    socket?.on('order:status', handleOrderUpdate);
    socket?.on('order:driver_assigned', handleOrderUpdate);
    // Đơn VNPay chỉ hiện với quán khi khách thanh toán xong
    socket?.on('order:payment', handleOrderUpdate);
    return () => {
      socket?.off('order:created', handleOrderUpdate);
      socket?.off('order:status', handleOrderUpdate);
      socket?.off('order:driver_assigned', handleOrderUpdate);
      socket?.off('order:payment', handleOrderUpdate);
    };
  }, [socket, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: OrderStatus;
      reason?: CancelReason;
    }) => ordersApi.updateStatus(id, status, reason ? { cancelReason: reason } : undefined),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
      toast(vars.status === 'CANCELLED' ? 'Đã huỷ đơn hàng.' : 'Đã cập nhật trạng thái đơn.', 'success');
    },
    onError: (err: any) => {
      toast(err.response?.data?.message || 'Không thể chuyển trạng thái đơn', 'error');
    },
    onSettled: () => setPending(null),
  });

  const counts = useMemo(() => {
    const map: Partial<Record<OrderStatus, number>> = {};
    for (const o of allOrders.data?.items ?? []) map[o.status] = (map[o.status] ?? 0) + 1;
    return map;
  }, [allOrders.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
    setRefreshing(false);
  };

  if (loadingRest) {
    return <LoadingSpinner message="Đang tải dữ liệu nhà hàng..." />;
  }

  if (!restaurant) {
    return (
      <View className="flex-1 bg-canvas-subtle">
        {isFocused && <StatusBar style="light" />}
        <TabHeader title="Đơn hàng" />
        <EmptyState
          icon="storefront-outline"
          title="Bạn chưa có nhà hàng nào"
          description="Vui lòng liên hệ Quản trị viên để đăng ký mở quán trên hệ thống."
        />
      </View>
    );
  }

  const orders = filtered.data?.items ?? [];

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <TabHeader
        title="Đơn hàng"
        subtitle={restaurant.name}
        trailing={
          <View className="flex-row items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5">
            <View
              className={`h-2 w-2 rounded-full ${
                restaurant.acceptingOrders ? 'bg-success' : restaurant.isOpen ? 'bg-warning' : 'bg-danger'
              }`}
            />
            <Text variant="caption" weight="semibold" tone="inverse">
              {restaurant.acceptingOrders ? 'Đang nhận đơn' : restaurant.isOpen ? 'Ngoài giờ mở cửa' : 'Đã đóng cửa'}
            </Text>
          </View>
        }
      >
        {/* Tóm tắt nhanh: bấm để lọc */}
        <View className="flex-row gap-2">
          <Stat label="Đơn mới" value={counts.PENDING ?? 0} highlight onPress={() => setSelectedStatus('PENDING')} />
          <Stat label="Đã nhận" value={counts.CONFIRMED ?? 0} onPress={() => setSelectedStatus('CONFIRMED')} />
          <Stat
            label="Đang chuẩn bị"
            value={counts.PREPARING ?? 0}
            onPress={() => setSelectedStatus('PREPARING')}
          />
        </View>
      </TabHeader>

      {/* Bộ lọc trạng thái */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-3">
          {STATUS_TABS.map((tab) => {
            const n = tab.value ? counts[tab.value] : allOrders.data?.items.length;
            return (
              <FilterChip
                key={tab.label}
                label={n ? `${tab.label} (${n})` : tab.label}
                selected={selectedStatus === tab.value}
                onPress={() => setSelectedStatus(tab.value)}
              />
            );
          })}
        </ScrollView>
      </View>

      {filtered.isLoading ? (
        <LoadingSpinner message="Đang tải danh sách đơn..." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerClassName={`gap-3 px-4 pt-1 ${TAB_BAR_CLEARANCE}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              busy={updateStatusMutation.isPending && pending?.order.id === item.id}
              onAction={(action) => {
                setCancelReason('RESTAURANT_OUT_OF_STOCK');
                setPending({ order: item, action });
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Chưa có đơn hàng"
              description={
                selectedStatus
                  ? 'Không có đơn nào ở trạng thái này.'
                  : 'Đơn mới sẽ hiện ở đây ngay khi khách đặt món.'
              }
            />
          }
        />
      )}

      {/* Hộp xác nhận chạy được cả trên web (Alert.alert có nút không hiện trên web) */}
      <ConfirmDialog
        visible={!!pending}
        title={pending?.action.confirmTitle ?? ''}
        message={pending ? `Đơn #${pending.order.id.slice(0, 8).toUpperCase()}. ${pending.action.confirmMessage}` : ''}
        confirmLabel={pending?.action.label}
        cancelLabel="Quay lại"
        destructive={pending?.action.destructive}
        loading={updateStatusMutation.isPending}
        onCancel={() => !updateStatusMutation.isPending && setPending(null)}
        onConfirm={() =>
          pending &&
          updateStatusMutation.mutate({
            id: pending.order.id,
            status: pending.action.to,
            reason:
              pending.action.to === 'CANCELLED'
                ? pending.order.status === 'PREPARING'
                  ? 'RESTAURANT_OUT_OF_STOCK'
                  : cancelReason
                : undefined,
          })
        }
      >
        {pending?.action.to === 'CANCELLED' && (
          <View className="mt-2 gap-1.5">
            {(pending.order.status === 'PREPARING'
              ? (['RESTAURANT_OUT_OF_STOCK'] as CancelReason[])
              : OWNER_CANCEL_REASONS
            ).map((r) => {
              const selected =
                (pending.order.status === 'PREPARING' ? 'RESTAURANT_OUT_OF_STOCK' : cancelReason) === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setCancelReason(r)}
                  className={`flex-row items-center gap-2.5 rounded-lg border p-2.5 ${
                    selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'
                  }`}
                >
                  <Icon
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size="sm"
                    tone={selected ? 'brand' : 'muted'}
                  />
                  <Text variant="caption" weight={selected ? 'semibold' : 'regular'} className="flex-1">
                    {CANCEL_REASON_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ConfirmDialog>
    </View>
  );
};

/** Ô số liệu trên đầu trang. */
const Stat: React.FC<{ label: string; value: number; highlight?: boolean; onPress: () => void }> = ({
  label,
  value,
  highlight,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value}, bấm để lọc`}
    onPress={onPress}
    className="min-h-touch flex-1 rounded-lg bg-surface/15 px-3 py-2.5 active:bg-surface/25"
  >
    <View className="flex-row items-center gap-1.5">
      <Text variant="title" weight="bold" tone="inverse">
        {value}
      </Text>
      {highlight && value > 0 && <View className="h-2 w-2 rounded-full bg-accent-500" />}
    </View>
    <Text variant="caption" tone="inverse" className="opacity-85">
      {label}
    </Text>
  </Pressable>
);

const OrderCard: React.FC<{
  order: OrderDetail;
  busy: boolean;
  onAction: (action: OrderAction) => void;
}> = ({ order, busy, onAction }) => {
  const next = NEXT_ACTION[order.status];
  const cancel = CANCEL_ACTION[order.status];
  const waiting = WAITING_NOTE[order.status];
  const isNew = order.status === 'PENDING';
  const itemCount = order.items?.reduce((sum, m) => sum + m.quantity, 0) ?? 0;

  return (
    <View
      className={`gap-3 rounded-xl border bg-surface p-4 shadow-card ${isNew ? 'border-accent-500' : 'border-line'}`}
    >
      {/* Mã đơn, thời gian, trạng thái */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text variant="body-lg" weight="bold">
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            {isNew && (
              <View className="rounded-full bg-accent-500 px-2 py-0.5">
                <Text variant="micro" tone="inverse">
                  Mới
                </Text>
              </View>
            )}
          </View>
          <Text variant="caption" tone="muted">
            {formatDateTime(order.createdAt)}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      {/* Khách hàng và địa chỉ giao */}
      <View className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <Icon name="person-outline" size="sm" tone="secondary" />
          <Text variant="body" weight="medium" className="flex-1" numberOfLines={1}>
            {order.customer?.fullName || 'Khách hàng'}
            {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
          </Text>
        </View>
        <View className="flex-row items-start gap-2">
          <Icon name="location-outline" size="sm" tone="secondary" />
          <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={2}>
            {order.deliveryAddress}
          </Text>
        </View>
      </View>

      {/* Món đã đặt */}
      <View className="gap-1.5 rounded-lg bg-canvas-subtle p-3">
        {order.items?.map((m) => (
          <View key={m.id} className="flex-row items-start justify-between gap-2">
            <View className="flex-1 flex-row gap-2">
              <Text variant="body" weight="bold" tone="brand">
                {m.quantity}×
              </Text>
              <View className="flex-1">
                <Text variant="body">{m.name}</Text>
                {!!m.note && (
                  <Text variant="caption" tone="muted">
                    Ghi chú: {m.note}
                  </Text>
                )}
              </View>
            </View>
            <Text variant="body" weight="medium">
              {formatVND(m.lineTotal)}
            </Text>
          </View>
        ))}
      </View>

      {!!order.note && (
        <View className="flex-row items-start gap-2 rounded-lg bg-warning-soft px-3 py-2">
          <Icon name="chatbox-ellipses-outline" size="sm" tone="accent" />
          <Text variant="caption" className="flex-1 text-warning-strong">
            {order.note}
          </Text>
        </View>
      )}

      {/* Tài xế đã nhận đơn */}
      {order.driver && (
        <View className="flex-row items-center gap-2 rounded-lg bg-brand-50 px-3 py-2">
          <Icon name="bicycle-outline" size="sm" tone="brand" />
          <Text variant="caption" weight="medium" tone="brand" className="flex-1" numberOfLines={1}>
            Tài xế: {order.driver.fullName}
            {order.driver.phone ? ` · ${order.driver.phone}` : ''}
          </Text>
        </View>
      )}

      {/* Lý do huỷ / giao thất bại */}
      {(order.status === 'CANCELLED' || order.status === 'DELIVERY_FAILED') && !!formatOrderEndReason(order) && (
        <View className="flex-row items-center gap-2 rounded-lg bg-danger-soft/40 px-3 py-2">
          <Icon name="alert-circle-outline" size="sm" tone="danger" />
          <Text variant="caption" tone="danger" className="flex-1">
            {formatOrderEndReason(order)}
          </Text>
        </View>
      )}

      {/* Tổng tiền */}
      <View className="flex-row items-end justify-between border-t border-line-subtle pt-3">
        <View>
          <Text variant="caption" tone="muted">
            {itemCount} món · {order.paymentMethod === 'VNPAY' ? 'VNPay' : 'Tiền mặt'}
            {order.paymentStatus === 'PAID' ? ' (đã thanh toán)' : ''}
          </Text>
          <Text variant="headline" weight="bold" tone="brand">
            {formatVND(order.total)}
          </Text>
        </View>
        {waiting && (
          <View className="flex-row items-center gap-1.5">
            <Icon name={waiting.icon} size="sm" tone="secondary" />
            <Text variant="caption" tone="secondary">
              {waiting.text}
            </Text>
          </View>
        )}
      </View>

      {/* Thao tác */}
      {(next || cancel) && (
        <View className="flex-row gap-2">
          {cancel && (
            <Button
              label={cancel.label}
              variant="outline"
              size="md"
              disabled={busy}
              onPress={() => onAction(cancel)}
              className="min-h-touch flex-1"
            />
          )}
          {next && (
            <Button
              label={next.label}
              variant="primary"
              size="md"
              loading={busy}
              onPress={() => onAction(next)}
              className="min-h-touch flex-[2]"
            />
          )}
        </View>
      )}
    </View>
  );
};
