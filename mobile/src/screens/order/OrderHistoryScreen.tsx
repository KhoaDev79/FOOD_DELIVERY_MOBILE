import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import {
  AppImage,
  cn,
  EmptyState,
  ErrorState,
  FilterBar,
  Icon,
  OrderStatusBadge,
  Skeleton,
  TabHeader,
  TAB_BAR_CLEARANCE,
  Text,
} from '../../components/ui';
import { useMyOrders } from '../../services/useOrders';
import { palette } from '../../theme';
import { OrderStatus, OrderSummary } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime, formatVND } from '../../utils/format';

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

const ACTIVE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang xử lý' },
  { value: 'done', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã huỷ' },
];

const matches = (o: OrderSummary, f: FilterKey) =>
  f === 'all' ||
  (f === 'active' && ACTIVE.includes(o.status)) ||
  (f === 'done' && o.status === 'DELIVERED') ||
  (f === 'cancelled' && o.status === 'CANCELLED');

const OrderCard = memo<{ order: OrderSummary; onOpen: (o: OrderSummary) => void }>(({ order, onOpen }) => {
  const active = ACTIVE.includes(order.status);
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Đơn từ ${order.restaurant.name}, ${formatVND(order.total)}, ${formatDateTime(order.createdAt)}`}
      onPress={() => onOpen(order)}
      className={cn(
        'gap-3 rounded-lg border bg-surface p-3 shadow-card',
        'hover:border-brand-400 active:bg-brand-50',
        active ? 'border-brand-200' : 'border-line-subtle',
      )}
    >
      <View className="flex-row items-center gap-3">
        <AppImage uri={order.restaurant.imageUrl} className="h-14 w-14 rounded-md" fallbackIcon="storefront-outline" />
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" weight="semibold" numberOfLines={1}>
            {order.restaurant.name}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon name="calendar-clear-outline" size={12} tone="muted" />
            <Text variant="caption" weight="regular" tone="secondary">
              {formatDateTime(order.createdAt)}
            </Text>
          </View>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View className="rounded-md bg-canvas-subtle px-3 py-2">
        <Text variant="body" tone="secondary" numberOfLines={2}>
          {order.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text variant="caption" weight="regular" tone="secondary">
          {itemCount} món · {order.paymentMethod === 'VNPAY' ? 'VNPAY' : 'Tiền mặt'}
        </Text>
        <Text variant="body-lg" weight="bold" tone="brand">
          {formatVND(order.total)}
        </Text>
      </View>

      {/* Chỉ là nhãn hiển thị: cả thẻ đã là nút mở trang theo dõi (tránh nút lồng nút). */}
      {active && (
        <View
          accessible={false}
          className="h-button-sm flex-row items-center justify-center gap-1 rounded-sm border border-brand-100 bg-brand-50"
        >
          <Text variant="caption" weight="semibold" tone="brand">
            Theo dõi đơn
          </Text>
          <Icon name="chevron-forward" size="sm" tone="brand" />
        </View>
      )}
    </Pressable>
  );
});
OrderCard.displayName = 'OrderCard';

const OrderSkeleton: React.FC = () => (
  <View className="gap-3 rounded-lg bg-surface p-3">
    <View className="flex-row items-center gap-3">
      <Skeleton className="h-14 w-14 rounded-md" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </View>
    </View>
    <Skeleton className="h-9 w-full" />
    <Skeleton className="h-4 w-1/3 self-end" />
  </View>
);

export const OrderHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data, isLoading, isError, refetch } = useMyOrders();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const orders = useMemo(() => data?.items ?? [], [data]);
  const visible = useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);
  const activeCount = orders.filter((o) => ACTIVE.includes(o.status)).length;
  const openOrder = (o: OrderSummary) => navigation.navigate('OrderTracking', { orderId: o.id });

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Đơn hàng của tôi"
        subtitle={
          isLoading ? 'Đang tải…' : activeCount > 0 ? `${activeCount} đơn đang xử lý` : `${orders.length} đơn đã đặt`
        }
      />
      <FilterBar options={FILTERS} value={filter} onChange={setFilter} className="mt-1" />

      {isLoading ? (
        <View className="gap-3 px-4 pt-2">
          <OrderSkeleton />
          <OrderSkeleton />
          <OrderSkeleton />
        </View>
      ) : isError ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(o) => o.id}
          contentContainerClassName={cn('flex-grow gap-3 px-4 pt-2', TAB_BAR_CLEARANCE)}
          renderItem={({ item }) => <OrderCard order={item} onOpen={openOrder} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />
          }
          ListEmptyComponent={
            orders.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="Chưa có đơn hàng nào"
                description="Những đơn hàng bạn đã đặt sẽ xuất hiện tại đây."
                actionLabel="Đặt món ngay"
                onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
              />
            ) : (
              <EmptyState
                icon="funnel-outline"
                title="Không có đơn phù hợp"
                description="Thử chọn bộ lọc khác."
                actionLabel="Xem tất cả"
                onAction={() => setFilter('all')}
              />
            )
          }
        />
      )}
    </View>
  );
};
