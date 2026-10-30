import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi } from '../../api/admin';
import { ROLE_META, SectionCard } from '../../components/modules/admin/adminShared';
import {
  CountBadge,
  ErrorState,
  Icon,
  IconName,
  IconTone,
  IconButton,
  OrderStatusBadge,
  Skeleton,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useSocket } from '../../hooks/useSocket';
import { palette } from '../../theme';
import { OrderStatus, Role } from '../../types/api';
import { formatVND } from '../../utils/format';

const ORDER_FLOW: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'DELIVERED',
  'CANCELLED',
];

const ROLE_ORDER: Role[] = ['CUSTOMER', 'RESTAURANT_OWNER', 'DRIVER', 'ADMIN'];
const ROLE_BAR: Record<Role, string> = {
  CUSTOMER: 'bg-brand-500',
  RESTAURANT_OWNER: 'bg-warning',
  DRIVER: 'bg-success',
  ADMIN: 'bg-danger',
};

/** Thẻ số liệu bo 2xl, bóng nhẹ, icon tròn nền nhạt như thẻ ở Trang chủ. */
const MetricCard: React.FC<{
  label: string;
  value: string;
  caption?: string;
  icon: IconName;
  iconTone?: IconTone;
  iconBg?: string;
  onPress?: () => void;
}> = ({ label, value, caption, icon, iconTone = 'brand', iconBg = 'bg-brand-50', onPress }) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}: ${value}`}
    disabled={!onPress}
    onPress={onPress}
    className="min-w-36 flex-1 basis-[46%] gap-1.5 rounded-2xl bg-surface p-4 shadow-card active:opacity-90"
  >
    <View className={`h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
      <Icon name={icon} size="md" tone={iconTone} />
    </View>
    <Text variant="title" weight="bold" numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text variant="caption" tone="secondary" numberOfLines={1}>
      {label}
    </Text>
    {!!caption && (
      <Text variant="micro" weight="regular" tone="muted" numberOfLines={2}>
        {caption}
      </Text>
    )}
  </Pressable>
);

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
  });

  useEffect(() => {
    if (!socket) return;
    const onOrderStalled = (payload: { id: string }) => {
      toast(`Đơn #${payload.id.slice(-6).toUpperCase()} bị ứ đọng!`, 'error');
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    };
    socket.on('order:stalled', onOrderStalled);
    return () => {
      socket.off('order:stalled', onOrderStalled);
    };
  }, [socket, toast, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const users = stats?.users;
  const orders = stats?.orders;
  const statuses = orders?.statuses ?? {};
  const delivered = statuses.DELIVERED ?? 0;
  const successRate = orders?.total ? Math.round((delivered / orders.total) * 100) : null;
  const pendingRequests = stats?.roleRequests.pending ?? 0;
  const pendingRestaurants = stats?.restaurants.pendingApproval ?? stats?.restaurants.pending ?? 0;

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerClassName={TAB_BAR_CLEARANCE}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
      >
        <TabHeader
          title="Tổng quan Quản trị"
          trailing={
            <IconButton
              icon="refresh"
              variant="glass"
              accessibilityLabel="Làm mới số liệu"
              onPress={onRefresh}
            />
          }
        >
          {/* Doanh thu toàn sàn */}
          <View className="gap-0.5 rounded-xl bg-surface/15 p-4">
            <Text variant="caption" tone="inverse" className="opacity-85">
              Doanh thu sàn (GMV) – đơn giao thành công
            </Text>
            {isLoading ? (
              <Skeleton className="mt-1 h-8 w-40 bg-surface/30" />
            ) : (
              <Text variant="display" tone="inverse">
                {formatVND(orders?.totalRevenue ?? 0)}
              </Text>
            )}
          </View>
        </TabHeader>

        {isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <View className="gap-4 px-4 pt-4">
            {/* Đơn hàng ứ đọng */}
            {Boolean(orders?.stalled) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${orders!.stalled} đơn hàng ứ đọng cần xử lý`}
                onPress={() => navigation.navigate('AdminOrdersTab', { stalledOnly: true })}
                className="flex-row items-center gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 active:opacity-85"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Icon name="alert-circle-outline" size="md" tone="danger" />
                </View>
                <View className="flex-1">
                  <Text variant="body" weight="semibold" tone="danger">
                    Đơn hàng ứ đọng ({orders!.stalled})
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Quá hạn chuẩn bị hoặc chưa có tài xế nhận, cần can thiệp
                  </Text>
                </View>
                <CountBadge count={orders!.stalled ?? 0} />
                <Icon name="chevron-forward" size="md" tone="muted" />
              </Pressable>
            )}

            {/* Yêu cầu chờ duyệt */}
            {pendingRequests > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${pendingRequests} yêu cầu nâng cấp vai trò đang chờ duyệt`}
                onPress={() => navigation.navigate('AdminUsersTab', { openRequests: true })}
                className="flex-row items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 active:opacity-85"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Icon name="person-add" size="md" tone="accent" />
                </View>
                <View className="flex-1">
                  <Text variant="body" weight="semibold">
                    Yêu cầu mở quán / làm tài xế
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Có {pendingRequests} yêu cầu đang chờ bạn duyệt
                  </Text>
                </View>
                <CountBadge count={pendingRequests} />
                <Icon name="chevron-forward" size="md" tone="muted" />
              </Pressable>
            )}

            {/* Quán chờ duyệt */}
            {pendingRestaurants > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${pendingRestaurants} quán đang chờ duyệt`}
                onPress={() => navigation.navigate('AdminRestaurantsTab', { filter: 'pending' })}
                className="flex-row items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 active:opacity-85"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Icon name="storefront-outline" size="md" tone="accent" />
                </View>
                <View className="flex-1">
                  <Text variant="body" weight="semibold">
                    Quán ăn chờ duyệt
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Có {pendingRestaurants} quán đang chờ phê duyệt hồ sơ
                  </Text>
                </View>
                <CountBadge count={pendingRestaurants} />
                <Icon name="chevron-forward" size="md" tone="muted" />
              </Pressable>
            )}

            {/* Lưới chỉ số */}
            <View className="flex-row flex-wrap gap-3">
              <MetricCard
                label="Người dùng"
                value={isLoading ? '—' : String(users?.total ?? 0)}
                caption={users?.inactive ? `${users.inactive} tài khoản đang bị khoá` : 'Tất cả đang hoạt động'}
                icon="people"
                onPress={() => navigation.navigate('AdminUsersTab')}
              />
              <MetricCard
                label="Quán ăn"
                value={isLoading ? '—' : String(stats?.restaurants.total ?? 0)}
                caption={`${stats?.restaurants.open ?? 0} đang mở • ${stats?.restaurants.closed ?? 0} tạm ngưng`}
                icon="storefront"
                iconTone="accent"
                iconBg="bg-accent-50"
                onPress={() => navigation.navigate('AdminRestaurantsTab', { filter: 'all' })}
              />
              <MetricCard
                label="Tổng đơn hàng"
                value={isLoading ? '—' : String(orders?.total ?? 0)}
                caption={`${delivered} đơn hoàn thành`}
                icon="receipt"
                iconTone="success"
                iconBg="bg-success-soft"
                onPress={() => navigation.navigate('AdminOrdersTab')}
              />
              <MetricCard
                label="Công nợ COD tài xế"
                value={isLoading ? '—' : formatVND(stats?.drivers?.totalCodDebt ?? 0)}
                caption="Tổng tiền mặt đang giữ"
                icon="wallet-outline"
                iconTone="brand"
                iconBg="bg-brand-50"
                onPress={() => navigation.navigate('AdminUsersTab')}
              />
              <MetricCard
                label="Tỷ lệ giao thành công"
                value={successRate === null ? '—' : `${successRate}%`}
                caption={`${statuses.CANCELLED ?? 0} đơn đã huỷ`}
                icon="checkmark-done-circle"
                iconTone="success"
                iconBg="bg-success-soft"
              />
            </View>

            {/* Quán chưa có chủ */}
            {!!stats?.restaurants.unassigned && (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('AdminRestaurantsTab', { filter: 'unassigned' })}
                className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-85"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-danger-soft">
                  <Icon name="key-outline" size="md" tone="danger" />
                </View>
                <Text variant="body" weight="medium" className="flex-1">
                  {stats.restaurants.unassigned} quán chưa có chủ quán – cần gán người quản lý
                </Text>
                <Icon name="chevron-forward" size="md" tone="muted" />
              </Pressable>
            )}

            {/* Cơ cấu người dùng: tổng = các vai trò cộng lại */}
            <SectionCard title="Cơ cấu người dùng" icon="people-outline">
              {users && users.total > 0 && (
                <View className="h-2.5 flex-row overflow-hidden rounded-full bg-canvas-subtle">
                  {ROLE_ORDER.map((r) =>
                    users.roles[r] ? (
                      <View key={r} className={ROLE_BAR[r]} style={{ flex: users.roles[r] }} />
                    ) : null,
                  )}
                </View>
              )}
              {ROLE_ORDER.map((r) => (
                <View key={r} className="flex-row items-center gap-2 py-1">
                  <View className={`h-2.5 w-2.5 rounded-full ${ROLE_BAR[r]}`} />
                  <Text variant="body" tone="secondary" className="flex-1">
                    {ROLE_META[r].label}
                  </Text>
                  <Text variant="body" weight="semibold">
                    {users?.roles[r] ?? 0}
                  </Text>
                </View>
              ))}
              <View className="mt-1 flex-row items-center justify-between border-t border-line-subtle pt-2">
                <Text variant="body" weight="semibold">
                  Tổng cộng
                </Text>
                <Text variant="body" weight="bold" tone="brand">
                  {users?.total ?? 0}
                </Text>
              </View>
            </SectionCard>

            {/* Phân bổ trạng thái đơn */}
            <SectionCard title="Trạng thái đơn hàng" icon="receipt-outline">
              {ORDER_FLOW.map((s) => {
                const n = statuses[s] ?? 0;
                const pct = orders?.total ? (n / orders.total) * 100 : 0;
                return (
                  <View key={s} className="gap-1 py-1">
                    <View className="flex-row items-center justify-between">
                      <OrderStatusBadge status={s} />
                      <Text variant="body" weight="semibold">
                        {n}
                      </Text>
                    </View>
                    <View className="h-1.5 overflow-hidden rounded-full bg-canvas-subtle">
                      <View className="h-full rounded-full bg-brand-300" style={{ width: `${pct}%` }} />
                    </View>
                  </View>
                );
              })}
            </SectionCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
