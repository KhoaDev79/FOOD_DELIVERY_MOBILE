import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { clockTime, dayLabel, Money, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import {
  AppImage,
  cn,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
  TabHeader,
  TAB_BAR_CLEARANCE,
  Text,
} from '../../components/ui';
import { useReorder } from '../../hooks/useReorder';
import { useMyOrders } from '../../services/useOrders';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { OrderStatus, OrderSummary } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { CUSTOMER_STEPS, customerHeadline, customerStepIndex, etaText } from '../../utils/customerOrderProgress';
import { formatVND } from '../../utils/format';
import { formatOrderEndReason, getOrderStatusRoleLabel } from '../../utils/orderStatus';

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

const ACTIVE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

const matches = (o: OrderSummary, f: FilterKey) =>
  f === 'all' ||
  (f === 'active' && ACTIVE.includes(o.status)) ||
  (f === 'done' && o.status === 'DELIVERED') ||
  (f === 'cancelled' && (o.status === 'CANCELLED' || o.status === 'DELIVERY_FAILED'));


const itemsText = (o: OrderSummary) => o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
const itemCount = (o: OrderSummary) => o.items.reduce((s, i) => s + i.quantity, 0);
const paymentText = (o: OrderSummary) => (o.paymentMethod === 'VNPAY' ? 'VNPay' : 'Tiền mặt');

type Row =
  | { kind: 'section'; key: string; title: string }
  | { kind: 'active'; key: string; order: OrderSummary }
  | { kind: 'day'; key: string; label: string }
  | { kind: 'past'; key: string; order: OrderSummary };

/** Đơn đang xử lý: thẻ lớn nổi bật, có tiến trình và giờ giao dự kiến. */
const ActiveOrderCard = memo<{ order: OrderSummary; onOpen: (o: OrderSummary) => void }>(({ order, onOpen }) => {
  const step = customerStepIndex(order.status);
  const headline = customerHeadline(order.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Theo dõi đơn từ ${order.restaurant.name}, ${getOrderStatusRoleLabel(order.status, 'customer')}`}
      onPress={() => onOpen(order)}
      className="gap-3 rounded-2xl border border-brand-200 bg-surface p-4 shadow-card active:opacity-95"
    >
      <View className="flex-row items-center gap-3">
        <AppImage uri={order.restaurant.imageUrl} className="h-14 w-14 rounded-xl" fallbackIcon="storefront-outline" />
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" weight="bold" numberOfLines={1}>
            {order.restaurant.name}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            {itemCount(order)} món · {formatVND(order.total)} · {paymentText(order)}
          </Text>
        </View>
        <Icon name="chevron-forward" size="sm" tone="muted" />
      </View>

      {/* Tiến trình 4 bước (cùng bước với màn Theo dõi đơn) */}
      <View className="gap-1.5">
        <View className="flex-row gap-1.5">
          {CUSTOMER_STEPS.map((st, i) => (
            <View key={st.label} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand-500' : 'bg-line')} />
          ))}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="caption" weight="bold" tone="brand" numberOfLines={1} className="flex-1">
            {headline.title}
          </Text>
          <Text variant="caption" weight="medium" tone="secondary">
            Giao {etaText(order)}
          </Text>
        </View>
      </View>

      {/* Nhãn hành động: cả thẻ đã là nút (tránh nút lồng nút) */}
      <View
        accessible={false}
        className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-50"
      >
        <Icon name="navigate" size="sm" tone="brand" />
        <Text variant="caption" weight="bold" tone="brand">
          Theo dõi đơn
        </Text>
        <Icon name="chevron-forward" size={14} tone="brand" />
      </View>
    </Pressable>
  );
});
ActiveOrderCard.displayName = 'ActiveOrderCard';

/** Đơn đã kết thúc: thẻ gọn, có Đánh giá và Đặt lại. */
const PastOrderCard = memo<{
  order: OrderSummary;
  reordering: boolean;
  onOpen: (o: OrderSummary) => void;
  onReview: (o: OrderSummary) => void;
  onReorder: (o: OrderSummary) => void;
}>(({ order, reordering, onOpen, onReview, onReorder }) => {
  const delivered = order.status === 'DELIVERED';
  const canReview = Boolean(order.canReview || (delivered && !order.review && order.canReview !== false));
  const endReason = !delivered ? formatOrderEndReason(order) : null;

  return (
    <Pressable
      accessibilityLabel={`Đơn từ ${order.restaurant.name}, ${getOrderStatusRoleLabel(order.status, 'customer')}`}
      onPress={() => onOpen(order)}
      className="gap-3 rounded-2xl bg-surface p-3.5 shadow-card active:opacity-95"
    >
      <View className="flex-row gap-3">
        <AppImage
          uri={order.restaurant.imageUrl}
          className={cn('h-14 w-14 rounded-xl', delivered ? '' : 'opacity-50')}
          fallbackIcon="storefront-outline"
        />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-start justify-between gap-2">
            <Text variant="body" weight="bold" numberOfLines={1} className="flex-1">
              {order.restaurant.name}
            </Text>
            <Money amount={order.total} variant="body" tone={delivered ? 'default' : 'muted'} />
          </View>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            {itemsText(order)}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Icon
              name={delivered ? 'checkmark-circle' : 'close-circle'}
              size={13}
              tone={delivered ? 'success' : 'danger'}
            />
            <Text variant="micro" weight="semibold" tone={delivered ? 'success' : 'danger'}>
              {getOrderStatusRoleLabel(order.status, 'customer')}
            </Text>
            <Text variant="micro" weight="medium" tone="muted">
              · {clockTime(order.createdAt)} · {paymentText(order)}
            </Text>
          </View>
        </View>
      </View>

      {!!endReason && (
        <Text variant="caption" weight="regular" tone="danger" numberOfLines={2}>
          {endReason}
        </Text>
      )}

      <View className="flex-row items-center justify-end gap-2 border-t border-line-subtle pt-3">
        {order.review ? (
          <View className="flex-row items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1">
            <Icon name="star" size={13} tone="rating" />
            <Text variant="caption" weight="bold" className="text-warning-strong">
              Đã đánh giá {order.review.rating}
            </Text>
          </View>
        ) : canReview ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Đánh giá đơn hàng từ ${order.restaurant.name}`}
            onPress={(e) => {
              e.stopPropagation();
              onReview(order);
            }}
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-line px-3.5 active:bg-canvas-subtle"
          >
            <Icon name="star" size={14} tone="rating" />
            <Text variant="caption" weight="semibold">
              Đánh giá
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Đặt lại đơn từ ${order.restaurant.name}`}
          disabled={reordering}
          onPress={(e) => {
            e.stopPropagation();
            onReorder(order);
          }}
          className="h-9 min-w-[96px] flex-row items-center justify-center gap-1.5 rounded-full bg-brand-50 px-3.5 active:bg-brand-100"
        >
          {reordering ? (
            <ActivityIndicator size="small" color={palette.brand['500']} />
          ) : (
            <>
              <Icon name="refresh" size={14} tone="brand" />
              <Text variant="caption" weight="bold" tone="brand">
                Đặt lại
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
});
PastOrderCard.displayName = 'PastOrderCard';

const OrderSkeleton: React.FC = () => (
  <View className="gap-3 rounded-2xl bg-surface p-3.5">
    <View className="flex-row items-center gap-3">
      <Skeleton className="h-14 w-14 rounded-xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </View>
    </View>
  </View>
);

export const OrderHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data, isLoading, isError, refetch } = useMyOrders();
  const { reorder, confirmReplace, cancelReplace, conflict, loadingId } = useReorder();

  const onRefresh = async () => {
    if (!isAuthenticated) return;
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const orders = useMemo(() => (isAuthenticated ? data?.items ?? [] : []), [data, isAuthenticated]);
  const activeCount = orders.filter((o) => ACTIVE.includes(o.status)).length;

  // Đơn đang xử lý lên đầu; đơn đã kết thúc nhóm theo ngày
  const rows = useMemo<Row[]>(() => {
    const visible = orders.filter((o) => matches(o, filter));
    const active = visible.filter((o) => ACTIVE.includes(o.status));
    const past = visible.filter((o) => !ACTIVE.includes(o.status));
    const out: Row[] = [];
    if (active.length) {
      if (filter === 'all') out.push({ kind: 'section', key: 's-active', title: 'Đang xử lý' });
      active.forEach((o) => out.push({ kind: 'active', key: o.id, order: o }));
    }
    let lastDay = '';
    for (const o of past) {
      const label = dayLabel(o.createdAt);
      if (label !== lastDay) {
        out.push({ kind: 'day', key: `d-${label}`, label });
        lastDay = label;
      }
      out.push({ kind: 'past', key: o.id, order: o });
    }
    return out;
  }, [orders, filter]);

  const openOrder = (o: OrderSummary) => navigation.navigate('OrderTracking', { orderId: o.id });
  const openReview = (o: OrderSummary) =>
    navigation.navigate('Rating', {
      orderId: o.id,
      restaurantName: o.restaurant.name,
      hasDriver: Boolean(o.driverId),
    });

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Đơn hàng của tôi"
        subtitle={
          !isAuthenticated
            ? 'Đăng nhập để xem lịch sử đơn'
            : isLoading
              ? 'Đang tải…'
              : activeCount > 0
                ? `${activeCount} đơn đang xử lý`
                : `${orders.length} đơn đã đặt`
        }
      />

      {isAuthenticated && (
        <View className="px-4 pb-1 pt-3">
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            trackClassName="bg-line"
            items={[
              { key: 'all', label: 'Tất cả' },
              { key: 'active', label: 'Đang xử lý', count: activeCount || undefined },
              { key: 'done', label: 'Đã giao' },
              { key: 'cancelled', label: 'Đã huỷ' },
            ]}
          />
        </View>
      )}

      {isAuthenticated && isLoading ? (
        <View className="gap-3 px-4 pt-3">
          <OrderSkeleton />
          <OrderSkeleton />
          <OrderSkeleton />
        </View>
      ) : isAuthenticated && isError ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerClassName={cn('flex-grow gap-3 px-4 pt-3', TAB_BAR_CLEARANCE)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) =>
            row.kind === 'section' || row.kind === 'day' ? (
              <Text variant="caption" weight="bold" tone="secondary" className="mt-1 px-1 uppercase">
                {row.kind === 'section' ? row.title : row.label}
              </Text>
            ) : row.kind === 'active' ? (
              <ActiveOrderCard order={row.order} onOpen={openOrder} />
            ) : (
              <PastOrderCard
                order={row.order}
                reordering={loadingId === row.order.id}
                onOpen={openOrder}
                onReview={openReview}
                onReorder={reorder}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand['500']}
              colors={[palette.brand['500']]}
            />
          }
          ListEmptyComponent={
            !isAuthenticated ? (
              <EmptyState
                icon="receipt-outline"
                title="Bạn chưa đăng nhập"
                description="Đăng nhập để xem lịch sử và theo dõi trạng thái đơn hàng của bạn."
                actionLabel="Đăng nhập ngay"
                onAction={() => navigation.navigate('Login')}
              />
            ) : orders.length === 0 ? (
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

      {/* Giỏ đang có món của quán khác */}
      <ConfirmDialog
        visible={!!conflict}
        title="Thay giỏ hàng?"
        message={
          conflict
            ? `Giỏ hàng đang có món của "${conflict.cartRestaurantName}". Bỏ các món đó để đặt lại đơn từ "${conflict.order.restaurant.name}"?`
            : ''
        }
        confirmLabel="Thay giỏ hàng"
        cancelLabel="Giữ giỏ cũ"
        onCancel={cancelReplace}
        onConfirm={() => {
          confirmReplace();
        }}
      />
    </View>
  );
};
