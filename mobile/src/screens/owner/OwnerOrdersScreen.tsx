import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import { ordersApi } from '../../api/orders';
import { restaurantsApi } from '../../api/restaurants';
import {
  clockTime,
  dayLabel,
  Money,
  orderCode,
  RoundAction,
  SegmentedTabs,
  timeAgo,
} from '../../components/modules/partner/PartnerKit';
import { OwnerRestaurantSelector } from '../../components/modules/owner/OwnerRestaurantSelector';
import { StoreStatusPill } from '../../components/modules/owner/OwnerKit';
import {
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconName,
  LoadingSpinner,
  OrderStatusBadge,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { useOwnerRestaurants } from '../../hooks/useOwnerRestaurants';
import { useSocket, useSocketConnected } from '../../hooks/useSocket';
import { palette } from '../../theme';
import { CancelReason, OrderDetail, OrderItem, OrderStatus } from '../../types/api';
import { OwnerStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';
import { CANCEL_REASON_LABELS, formatOrderEndReason } from '../../utils/orderStatus';

/** Tab theo luồng làm việc của quán (kiểu GrabMerchant / ShopeeFood Partner). */
type Tab = 'NEW' | 'DOING' | 'PICKUP' | 'HISTORY';

const TAB_STATUSES: Record<Tab, OrderStatus[]> = {
  NEW: ['PENDING'],
  DOING: ['CONFIRMED', 'PREPARING'],
  PICKUP: ['READY_FOR_PICKUP', 'PICKED_UP'],
  HISTORY: ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'],
};

const EMPTY_TEXT: Record<Tab, { icon: IconName; title: string; description: string }> = {
  NEW: { icon: 'notifications-outline', title: 'Chưa có đơn mới', description: 'Đơn mới sẽ hiện ở đây ngay khi khách đặt món.' },
  DOING: { icon: 'restaurant-outline', title: 'Không có đơn đang làm', description: 'Đơn bạn đã nhận và đang chuẩn bị sẽ nằm ở đây.' },
  PICKUP: { icon: 'bicycle-outline', title: 'Không có đơn chờ giao', description: 'Đơn đã làm xong, chờ tài xế lấy hoặc đang giao sẽ nằm ở đây.' },
  HISTORY: { icon: 'time-outline', title: 'Chưa có lịch sử', description: 'Đơn đã giao, đã huỷ hoặc giao thất bại sẽ nằm ở đây.' },
};

const OWNER_CANCEL_REASONS: CancelReason[] = ['RESTAURANT_OUT_OF_STOCK', 'RESTAURANT_CLOSED', 'RESTAURANT_OTHER'];

/** Hành động chủ quán được phép làm, khớp với quy tắc chuyển trạng thái ở backend (order-state-machine). */
interface OrderAction {
  to: OrderStatus;
  label: string;
  icon?: IconName;
  confirmTitle: string;
  confirmMessage: string;
  destructive?: boolean;
}

const NEXT_ACTION: Partial<Record<OrderStatus, OrderAction>> = {
  PENDING: {
    to: 'CONFIRMED',
    label: 'Nhận đơn',
    icon: 'checkmark-circle',
    confirmTitle: 'Nhận đơn này?',
    confirmMessage: 'Khách hàng sẽ được báo là quán đã nhận đơn.',
  },
  CONFIRMED: {
    to: 'PREPARING',
    label: 'Bắt đầu làm món',
    icon: 'flame',
    confirmTitle: 'Bắt đầu chuẩn bị món?',
    confirmMessage: 'Đơn sẽ chuyển sang trạng thái "Đang chuẩn bị món".',
  },
  PREPARING: {
    to: 'READY_FOR_PICKUP',
    label: 'Món đã xong',
    icon: 'bag-check',
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

/** Dòng trạng thái cho đơn quán không cần thao tác. */
const WAITING_NOTE: Partial<Record<OrderStatus, { icon: IconName; text: string }>> = {
  READY_FOR_PICKUP: { icon: 'time-outline', text: 'Món đã xong, đang chờ tài xế đến lấy' },
  PICKED_UP: { icon: 'bicycle-outline', text: 'Tài xế đã lấy món, đang giao cho khách' },
};

const PAGE_SIZE = 50;

type HistoryRow =
  | { kind: 'day'; key: string; label: string; count: number; revenue: number }
  | { kind: 'order'; key: string; order: OrderDetail };

export const OwnerOrdersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const toast = useToast();
  const { socket } = useSocket();
  const socketConnected = useSocketConnected();
  useNow(); // vẽ lại mỗi phút để "x phút trước" luôn đúng
  const [tab, setTab] = useState<Tab | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<{ order: OrderDetail; action: OrderAction } | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>('RESTAURANT_OUT_OF_STOCK');

  const { restaurants, restaurant, isLoading: loadingRest } = useOwnerRestaurants();

  // Đơn mới nhất trước; tải thêm trang cũ hơn khi xem Lịch sử
  const ordersQuery = useInfiniteQuery({
    queryKey: ['owner', 'orders', restaurant?.id],
    queryFn: ({ pageParam }) => restaurantsApi.getRestaurantOrders(restaurant!.id, { page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: Boolean(restaurant?.id),
    refetchInterval: socketConnected ? false : 10000,
  });

  // Socket: có đơn mới / đổi trạng thái thì tải lại danh sách đơn của quán
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
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: CancelReason }) =>
      ordersApi.updateStatus(id, status, reason ? { cancelReason: reason } : undefined),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
      toast(vars.status === 'CANCELLED' ? 'Đã huỷ đơn hàng.' : 'Đã cập nhật trạng thái đơn.', 'success');
    },
    onError: (err: any) => {
      toast(err.response?.data?.message || 'Không thể chuyển trạng thái đơn', 'error');
    },
    onSettled: () => setPending(null),
  });

  const allOrders = useMemo(() => ordersQuery.data?.pages.flatMap((p) => p.items) ?? [], [ordersQuery.data]);

  const byTab = useMemo(() => {
    const out: Record<Tab, OrderDetail[]> = { NEW: [], DOING: [], PICKUP: [], HISTORY: [] };
    for (const o of allOrders) {
      const t = (Object.keys(TAB_STATUSES) as Tab[]).find((k) => TAB_STATUSES[k].includes(o.status));
      if (t) out[t].push(o);
    }
    // Đơn đang xử lý: đơn cũ nhất lên trước (làm trước); lịch sử: mới nhất trước
    for (const t of ['NEW', 'DOING', 'PICKUP'] as Tab[]) {
      out[t].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return out;
  }, [allOrders]);

  // Chưa chọn tab: mở tab đầu tiên đang có đơn cần xử lý
  const activeTab: Tab =
    tab ?? (byTab.NEW.length ? 'NEW' : byTab.DOING.length ? 'DOING' : byTab.PICKUP.length ? 'PICKUP' : 'NEW');

  const historyRows = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [];
    let header: Extract<HistoryRow, { kind: 'day' }> | null = null;
    for (const o of byTab.HISTORY) {
      const label = dayLabel(o.createdAt);
      if (!header || header.label !== label) {
        header = { kind: 'day', key: `d-${label}`, label, count: 0, revenue: 0 };
        rows.push(header);
      }
      header.count += 1;
      if (o.status === 'DELIVERED') header.revenue += o.subtotal;
      rows.push({ kind: 'order', key: o.id, order: o });
    }
    return rows;
  }, [byTab.HISTORY]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['owner', 'orders'] });
    setRefreshing(false);
  };

  const askAction = (order: OrderDetail, action: OrderAction) => {
    setCancelReason('RESTAURANT_OUT_OF_STOCK');
    setPending({ order, action });
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

  const isHistory = activeTab === 'HISTORY';
  const data: HistoryRow[] = isHistory
    ? historyRows
    : byTab[activeTab].map((o) => ({ kind: 'order' as const, key: o.id, order: o }));
  const empty = EMPTY_TEXT[activeTab];

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <TabHeader
        title="Đơn hàng"
        subtitle={<OwnerRestaurantSelector restaurants={restaurants} currentRestaurant={restaurant} />}
        trailing={<StoreStatusPill restaurant={restaurant} />}
      />

      <View className="px-4 pb-1 pt-3">
        <SegmentedTabs
          value={activeTab}
          onChange={(t) => {
            setTab(t);
            setExpandedId(null);
          }}
          trackClassName="bg-line"
          items={[
            { key: 'NEW', label: 'Mới', count: byTab.NEW.length || undefined },
            { key: 'DOING', label: 'Đang làm', count: byTab.DOING.length || undefined },
            { key: 'PICKUP', label: 'Chờ giao', count: byTab.PICKUP.length || undefined },
            { key: 'HISTORY', label: 'Lịch sử' },
          ]}
        />
      </View>

      {ordersQuery.isLoading ? (
        <LoadingSpinner message="Đang tải danh sách đơn..." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(row) => row.key}
          contentContainerClassName={`gap-3 px-4 pt-3 ${TAB_BAR_CLEARANCE}`}
          contentContainerStyle={data.length === 0 ? { flexGrow: 1 } : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand['500']}
              colors={[palette.brand['500']]}
            />
          }
          renderItem={({ item: row }) => {
            if (row.kind === 'day') {
              return (
                <View className="mt-1 flex-row items-center justify-between px-1">
                  <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
                    {row.label}
                  </Text>
                  <Text variant="caption" weight="medium" tone="muted">
                    {row.count} đơn ·{' '}
                    <Text variant="caption" weight="bold" tone="brand">
                      {formatVND(row.revenue)}
                    </Text>
                  </Text>
                </View>
              );
            }
            const order = row.order;
            if (isHistory && expandedId !== order.id) {
              return <HistoryRowCard order={order} onPress={() => setExpandedId(order.id)} />;
            }
            return (
              <OrderCard
                order={order}
                busy={updateStatusMutation.isPending && pending?.order.id === order.id}
                onAction={(action) => askAction(order, action)}
                onCollapse={isHistory ? () => setExpandedId(null) : undefined}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} className="flex-1" />
          }
          ListFooterComponent={
            isHistory && ordersQuery.hasNextPage ? (
              <Button
                label="Xem đơn cũ hơn"
                variant="ghost"
                size="md"
                loading={ordersQuery.isFetchingNextPage}
                onPress={() => ordersQuery.fetchNextPage()}
              />
            ) : undefined
          }
        />
      )}

      {/* Hộp xác nhận chạy được cả trên web (Alert.alert có nút không hiện trên web) */}
      <ConfirmDialog
        visible={!!pending}
        title={pending?.action.confirmTitle ?? ''}
        message={pending ? `Đơn #${orderCode(pending.order.id)}. ${pending.action.confirmMessage}` : ''}
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
              const selected = (pending.order.status === 'PREPARING' ? 'RESTAURANT_OUT_OF_STOCK' : cancelReason) === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setCancelReason(r)}
                  className={cn(
                    'flex-row items-center gap-2.5 rounded-xl border p-3',
                    selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                  )}
                >
                  <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size="sm" tone={selected ? 'brand' : 'muted'} />
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

/** "Tô đặc biệt · Trứng chần, Quẩy · Cay vừa" */
const optionsText = (m: OrderItem) =>
  [m.options?.size?.name, m.options?.toppings?.map((t) => t.name).join(', '), m.options?.level]
    .filter((x) => !!x)
    .join(' · ');

const OrderCard: React.FC<{
  order: OrderDetail;
  busy: boolean;
  onAction: (action: OrderAction) => void;
  onCollapse?: () => void;
}> = ({ order, busy, onAction, onCollapse }) => {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const next = NEXT_ACTION[order.status];
  const cancel = CANCEL_ACTION[order.status];
  const waiting = WAITING_NOTE[order.status];
  const isNew = order.status === 'PENDING';
  const itemCount = order.items?.reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const isCod = order.paymentMethod !== 'VNPAY';
  const driver = order.driver;
  const plate = driver?.licensePlate || driver?.driverProfile?.licensePlate;
  const vehicle = [
    driver?.vehicleBrand || driver?.driverProfile?.vehicleBrand,
    driver?.vehicleModel || driver?.driverProfile?.vehicleModel,
  ]
    .filter(Boolean)
    .join(' ');
  const endReason =
    (order.status === 'CANCELLED' || order.status === 'DELIVERY_FAILED') && formatOrderEndReason(order);

  const openChat = (channel: 'CUSTOMER_RESTAURANT' | 'RESTAURANT_DRIVER') =>
    navigation.navigate('Chat', {
      orderId: order.id,
      channel,
      recipientName:
        channel === 'CUSTOMER_RESTAURANT' ? order.customer?.fullName || 'Khách hàng' : driver?.fullName || 'Tài xế',
      recipientRole: channel === 'CUSTOMER_RESTAURANT' ? 'Khách hàng' : 'Tài xế giao hàng',
    });

  return (
    <View
      className={cn(
        'gap-3 rounded-2xl bg-surface p-4 shadow-card',
        isNew ? 'border-2 border-accent-500' : 'border border-transparent',
      )}
    >
      {/* Mã đơn · thời gian · trạng thái */}
      <View className="flex-row items-start justify-between gap-2">
        <Pressable disabled={!onCollapse} onPress={onCollapse} className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text variant="body-lg" weight="bold">
              #{orderCode(order.id)}
            </Text>
            {isNew && (
              <View className="rounded-full bg-accent-500 px-2 py-0.5">
                <Text variant="micro" weight="bold" tone="inverse">
                  MỚI
                </Text>
              </View>
            )}
          </View>
          <Text variant="caption" weight="regular" tone="muted">
            {clockTime(order.createdAt)} · {timeAgo(order.createdAt)}
          </Text>
        </Pressable>
        <OrderStatusBadge status={order.status} role="owner" />
      </View>

      {/* Khách hàng */}
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-canvas-subtle">
          <Icon name="person" size="sm" tone="secondary" />
        </View>
        <View className="flex-1">
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {order.customer?.fullName || 'Khách hàng'}
          </Text>
          <Text variant="caption" weight="regular" tone="muted">
            {itemCount} món · {isCod ? 'Tiền mặt' : order.paymentStatus === 'PAID' ? 'VNPay · đã trả' : 'VNPay'}
          </Text>
        </View>
        {!endReason && order.status !== 'DELIVERED' && (
          <RoundAction icon="chatbubble-ellipses" label="Nhắn tin với khách hàng" onPress={() => openChat('CUSTOMER_RESTAURANT')} />
        )}
      </View>

      {/* Món cần làm */}
      <View className="gap-2.5 rounded-xl bg-canvas-subtle p-3">
        {order.items?.map((m) => {
          const opts = optionsText(m);
          return (
            <View key={m.id} className="flex-row items-start gap-2.5">
              <View className="h-6 min-w-[28px] items-center justify-center rounded-md bg-brand-500 px-1">
                <Text variant="caption" weight="bold" tone="inverse">
                  {m.quantity}×
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="medium">
                  {m.name}
                </Text>
                {!!opts && (
                  <Text variant="caption" weight="regular" tone="secondary">
                    {opts}
                  </Text>
                )}
                {!!m.note && (
                  <Text variant="caption" weight="medium" className="text-warning-strong">
                    Ghi chú: {m.note}
                  </Text>
                )}
              </View>
              <Text variant="body" tone="secondary">
                {formatVND(m.lineTotal ?? m.unitPrice * m.quantity)}
              </Text>
            </View>
          );
        })}
      </View>

      {!!order.note && (
        <View className="flex-row items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5">
          <Icon name="chatbox-ellipses-outline" size="sm" tone="warning" />
          <Text variant="caption" className="flex-1 text-warning-strong">
            {order.note}
          </Text>
        </View>
      )}

      {/* Tài xế */}
      {driver && (
        <View className="flex-row items-center gap-3 rounded-xl bg-brand-50 p-2.5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-500">
            <Icon name="bicycle" size="sm" tone="inverse" />
          </View>
          <View className="flex-1">
            <Text variant="body" weight="semibold" numberOfLines={1}>
              {driver.fullName}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
              {[plate, vehicle].filter(Boolean).join(' · ') || 'Tài xế giao hàng'}
            </Text>
          </View>
          {!!driver.phone && order.status !== 'DELIVERED' && !endReason && (
            <RoundAction icon="call" label="Gọi tài xế" onPress={() => Linking.openURL(`tel:${driver.phone}`)} />
          )}
          {order.status !== 'DELIVERED' && !endReason && (
            <RoundAction icon="chatbubble-ellipses" label="Nhắn tin với tài xế" onPress={() => openChat('RESTAURANT_DRIVER')} />
          )}
        </View>
      )}

      {!!endReason && (
        <View className="flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5">
          <Icon name="alert-circle-outline" size="sm" tone="danger" />
          <Text variant="caption" tone="danger" className="flex-1">
            {endReason}
          </Text>
        </View>
      )}

      {/* Tiền quán thu về: tiền món (phí giao là của tài xế và nền tảng) */}
      <View className="flex-row items-end justify-between border-t border-line-subtle pt-3">
        <View>
          <Text variant="micro" tone="muted">
            Quán thu về
          </Text>
          <Money amount={order.subtotal} variant="headline" tone="brand" />
        </View>
        <Text variant="micro" weight="regular" tone="muted" className="text-right">
          Khách trả {formatVND(order.total)}
          {'\n'}gồm phí giao {formatVND(order.deliveryFee)}
        </Text>
      </View>

      {waiting && (
        <View className="flex-row items-center gap-2 rounded-xl bg-canvas-subtle px-3 py-2.5">
          <Icon name={waiting.icon} size="sm" tone="brand" />
          <Text variant="caption" weight="medium" tone="secondary" className="flex-1">
            {waiting.text}
          </Text>
        </View>
      )}

      {/* Thao tác: một nút chính to theo bước hiện tại */}
      {(next || cancel) && (
        <View className="flex-row gap-2">
          {cancel && (
            <Button
              label={cancel.label}
              variant="outline"
              size="lg"
              disabled={busy}
              onPress={() => onAction(cancel)}
              className="flex-1"
            />
          )}
          {next && (
            <Button
              label={next.label}
              leftIcon={next.icon}
              variant="primary"
              size="lg"
              loading={busy}
              onPress={() => onAction(next)}
              className="flex-[2]"
            />
          )}
        </View>
      )}
    </View>
  );
};

/** Dòng gọn trong Lịch sử; bấm để xem đầy đủ. */
const HistoryRowCard: React.FC<{ order: OrderDetail; onPress: () => void }> = ({ order, onPress }) => {
  const delivered = order.status === 'DELIVERED';
  const itemCount = order.items?.reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem đơn #${orderCode(order.id)}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card active:opacity-90"
    >
      <View
        className={cn('h-10 w-10 items-center justify-center rounded-full', delivered ? 'bg-success-soft' : 'bg-danger-soft')}
      >
        <Icon name={delivered ? 'checkmark' : 'close'} size="md" tone={delivered ? 'success' : 'danger'} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {order.customer?.fullName || 'Khách hàng'} · {itemCount} món
        </Text>
        <Text variant="micro" weight="medium" tone="muted" numberOfLines={1}>
          {clockTime(order.createdAt)} · #{orderCode(order.id)}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Money amount={delivered ? order.subtotal : 0} variant="body" tone={delivered ? 'brand' : 'muted'} />
        {!delivered && <OrderStatusBadge status={order.status} role="owner" />}
      </View>
    </Pressable>
  );
};
