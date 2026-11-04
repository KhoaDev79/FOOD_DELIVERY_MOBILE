import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi, AdminOrderGroup, AdminOrderListItem } from '../../api/admin';
import { ContentWidth, DetailPlaceholder, ListSkeleton, TabStrip, useIsWide } from '../../components/modules/admin/AdminKit';
import { OrderDetailPanel } from '../../components/modules/admin/OrderDetailPanel';
import { ExportCsvSheet } from '../../components/modules/partner/ExportCsvSheet';
import { MetricChip, Money } from '../../components/modules/partner/PartnerKit';
import {
  BottomSheet,
  Button,
  cn,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  IconButton,
  OrderStatusBadge,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
} from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useNow } from '../../hooks/useNow';
import { useSocket } from '../../hooks/useSocket';
import { palette } from '../../theme';
import { OrderStatus } from '../../types/api';
import { AdminTabParamList } from '../../types/navigation';
import { formatDuration, minutesBetween, ORDER_STEP_LABEL, relativeTime } from '../../utils/adminOrder';
import { orderCode } from '../../utils/format';

type Props = BottomTabScreenProps<AdminTabParamList, 'AdminOrdersTab'>;

const GROUPS: { key: AdminOrderGroup; label: string }[] = [
  { key: 'active', label: 'Đang chạy' },
  { key: 'stalled', label: 'Ứ đọng' },
  { key: 'done', label: 'Đã giao' },
  { key: 'failed', label: 'Huỷ / thất bại' },
];

/** Trạng thái chi tiết được lọc trong từng nhóm tab. */
const GROUP_STATUSES: Record<AdminOrderGroup, OrderStatus[]> = {
  active: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'],
  stalled: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'],
  done: [],
  failed: ['CANCELLED', 'DELIVERY_FAILED'],
};

const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'];
const PAYMENT_SHORT: Record<string, string> = { COD: 'Tiền mặt', VNPAY: 'VNPay' };

export const AdminOrdersScreen: React.FC<Props> = ({ route, navigation }) => {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const wide = useIsWide();
  const now = useNow();

  // Nhóm tab + trạng thái nằm trong tham số route để Tổng quan mở thẳng đúng bộ lọc
  const group: AdminOrderGroup = route.params?.group ?? (route.params?.stalledOnly ? 'stalled' : 'active');
  const status = (route.params?.status as OrderStatus | undefined) ?? undefined;
  const setGroup = (g: AdminOrderGroup) => navigation.setParams({ group: g, status: undefined, stalledOnly: undefined });
  const setStatus = (s?: OrderStatus) => navigation.setParams({ status: s });

  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 350);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [restSearch, setRestSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ['admin', 'orders', group, status, restaurant?.id, q],
    queryFn: () =>
      adminApi.listOrders({ group, status, restaurantId: restaurant?.id, q: q || undefined, page: 1, limit: 50 }),
    placeholderData: (prev) => prev,
  });

  const restaurantsQuery = useQuery({
    queryKey: ['admin', 'restaurants', 'picker', restSearch.trim()],
    queryFn: () => adminApi.listRestaurants({ q: restSearch.trim() || undefined, limit: 30 }),
    enabled: filterOpen,
  });

  // Đơn mới / đổi trạng thái → làm mới danh sách (và chi tiết đơn đang mở)
  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    const refreshDetail = (p: { id: string }) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['admin', 'order-detail', p.id] });
    };
    socket.on('order:created', refresh);
    socket.on('order:status', refreshDetail);
    socket.on('order:stalled', refresh);
    return () => {
      socket.off('order:created', refresh);
      socket.off('order:status', refreshDetail);
      socket.off('order:stalled', refresh);
    };
  }, [socket, queryClient]);

  const orders = listQuery.data?.items ?? [];
  const counts = listQuery.data?.counts;
  // Màn rộng: chưa chọn thì mở sẵn đơn đầu tiên ở cột phải
  const activeId = selectedId ?? (wide ? (orders[0]?.id ?? null) : null);

  const onRefresh = async () => {
    setRefreshing(true);
    await listQuery.refetch();
    setRefreshing(false);
  };

  const filterCount = (status ? 1 : 0) + (restaurant ? 1 : 0);

  const renderCard = ({ item }: { item: AdminOrderListItem }) => {
    const stalled = !!item.stalledAt && !TERMINAL.includes(item.status);
    const stuckMin = item.statusSince ? minutesBetween(item.statusSince, now) : 0;
    const selected = wide && item.id === activeId;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Đơn #${orderCode(item.id)}, ${item.restaurant?.name ?? ''}, ${ORDER_STEP_LABEL[item.status]}`}
        onPress={() => setSelectedId(item.id)}
        className={cn(
          'gap-2.5 rounded-2xl border-2 bg-surface p-4 shadow-card active:opacity-90',
          stalled ? 'border-danger' : selected ? 'border-brand-500' : 'border-surface',
        )}
      >
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
            #{orderCode(item.id)}
          </Text>
          <Text variant="caption" weight="regular" tone="muted" className="flex-1" numberOfLines={1}>
            {relativeTime(item.createdAt, now)}
          </Text>
          <OrderStatusBadge status={item.status} role="admin" />
        </View>

        {/* Quán và khách mỗi bên một dòng để không cắt tên; SĐT chỉ hiện trong chi tiết */}
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-accent-50">
              <Icon name="storefront" size={12} tone="accent" />
            </View>
            <Text variant="body" weight="semibold" numberOfLines={1} className="flex-1">
              {item.restaurant?.name || 'Quán'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-50">
              <Icon name="person" size={12} tone="brand" />
            </View>
            <Text variant="body" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
              {item.customer?.fullName || 'Khách'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
          <View className="flex-1 flex-row flex-wrap items-center gap-1.5">
            <MetricChip
              icon={item.paymentMethod === 'COD' ? 'cash-outline' : 'card-outline'}
              label={PAYMENT_SHORT[item.paymentMethod] ?? item.paymentMethod}
              tone={item.paymentMethod === 'COD' ? 'success' : 'brand'}
            />
            {item.driver ? (
              <MetricChip icon="bicycle" label={item.driver.fullName} tone="neutral" />
            ) : (
              !TERMINAL.includes(item.status) && <MetricChip icon="bicycle-outline" label="Chưa có tài xế" tone="warning" />
            )}
          </View>
          <Money amount={item.total} variant="body-lg" tone="brand" />
        </View>

        {stalled && (
          <View className="flex-row items-center gap-1.5 rounded-xl bg-danger-soft px-3 py-2">
            <Icon name="alert-circle" size="sm" tone="danger" />
            <Text variant="caption" weight="bold" tone="danger" className="flex-1">
              Kẹt {formatDuration(stuckMin)} ở bước {ORDER_STEP_LABEL[item.status]}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const list =
    listQuery.isLoading && !listQuery.data ? (
      <View className="px-4 pt-1">
        <ListSkeleton rows={5} />
      </View>
    ) : listQuery.isError && !listQuery.data ? (
      <ErrorState onRetry={() => listQuery.refetch()} />
    ) : (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerClassName={cn('gap-3 px-4 pt-1', TAB_BAR_CLEARANCE)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
        ListEmptyComponent={
          <EmptyState
            icon={group === 'stalled' ? 'checkmark-done-circle-outline' : 'receipt-outline'}
            title={group === 'stalled' ? 'Không có đơn ứ đọng' : 'Không tìm thấy đơn hàng'}
            description={
              group === 'stalled' ? 'Mọi đơn đang chạy đều đúng tiến độ.' : 'Thử đổi tab, bộ lọc hoặc từ khoá tìm kiếm.'
            }
          />
        }
      />
    );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <TabHeader
        compact
        trailing={
          <IconButton
            icon="download-outline"
            variant="glass"
            accessibilityLabel="Xuất danh sách đơn ra file CSV"
            onPress={() => setExportOpen(true)}
          />
        }
        title="Điều hành đơn"
        subtitle={counts ? `${counts.active} đơn đang chạy${counts.stalled ? ` · ${counts.stalled} ứ đọng` : ''}` : undefined}
      >
        <ContentWidth className="flex-row items-center gap-2">
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
            placeholder="Mã đơn, tên khách, tên quán, SĐT..."
            className="h-search-lg flex-1 rounded-full bg-surface px-4"
          />
          <View>
            <IconButton
              icon="options-outline"
              variant="glass"
              accessibilityLabel={filterCount ? `Bộ lọc, đang bật ${filterCount}` : 'Bộ lọc'}
              onPress={() => setFilterOpen(true)}
            />
            {filterCount > 0 && (
              <View className="absolute -right-0.5 -top-0.5 h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-500 px-1">
                <Text variant="micro" weight="bold" tone="inverse">
                  {filterCount}
                </Text>
              </View>
            )}
          </View>
        </ContentWidth>
      </TabHeader>

      <ContentWidth className="flex-1">
        {/* Tab nhóm + bộ lọc đang bật nằm cố định trên danh sách khi cuộn */}
        <TabStrip
          items={GROUPS.map((g) => ({
            ...g,
            count: counts?.[g.key],
            tone: g.key === 'stalled' ? ('danger' as const) : undefined,
          }))}
          value={group}
          onChange={(g) => {
            setGroup(g);
            setSelectedId(null);
          }}
        />
        <View className={filterCount > 0 ? 'px-4 pb-1 pt-3' : 'pt-3'}>
          {filterCount > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {status && <FilterChip label={`${ORDER_STEP_LABEL[status]} ✕`} selected onPress={() => setStatus(undefined)} />}
              {restaurant && <FilterChip label={`${restaurant.name} ✕`} selected onPress={() => setRestaurant(null)} />}
            </ScrollView>
          )}
        </View>

        {wide ? (
          <View className="flex-1 flex-row gap-4 pr-4">
            <View className="w-[42%]">{list}</View>
            <View className={cn('flex-1 pt-1', TAB_BAR_CLEARANCE)}>
              {activeId ? (
                <View className="flex-1 rounded-2xl bg-surface p-4 shadow-card">
                  <OrderDetailPanel key={activeId} orderId={activeId} />
                </View>
              ) : (
                <DetailPlaceholder icon="receipt-outline" text="Chọn một đơn để xem chi tiết và can thiệp." />
              )}
            </View>
          </View>
        ) : (
          list
        )}
      </ContentWidth>

      {/* Điện thoại: chi tiết đơn trong bảng trượt */}
      {!wide && (
        <BottomSheet
          visible={!!selectedId}
          onClose={() => setSelectedId(null)}
          title={selectedId ? `Đơn #${orderCode(selectedId)}` : 'Chi tiết đơn'}
        >
          {selectedId ? <OrderDetailPanel key={selectedId} orderId={selectedId} /> : <View />}
        </BottomSheet>
      )}

      {/* Bộ lọc chi tiết: trạng thái cụ thể + quán */}
      <BottomSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Bộ lọc đơn hàng"
        footer={
          <View className="flex-row gap-2 pb-2">
            <Button
              label="Xoá lọc"
              variant="secondary"
              size="lg"
              className="flex-1"
              disabled={!filterCount}
              onPress={() => {
                setStatus(undefined);
                setRestaurant(null);
              }}
            />
            <Button label="Xong" size="lg" className="flex-1" onPress={() => setFilterOpen(false)} />
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-4">
          {GROUP_STATUSES[group].length > 0 && (
            <View className="gap-2">
              <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
                Trạng thái
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {GROUP_STATUSES[group].map((s) => (
                  <FilterChip
                    key={s}
                    label={ORDER_STEP_LABEL[s]}
                    selected={status === s}
                    onPress={() => setStatus(status === s ? undefined : s)}
                  />
                ))}
              </View>
            </View>
          )}
          <View className="gap-2">
            <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
              Quán
            </Text>
            <SearchBar value={restSearch} onChangeText={setRestSearch} onClear={() => setRestSearch('')} placeholder="Tìm quán..." />
            {(restaurantsQuery.data?.items ?? []).map((r) => {
              const on = restaurant?.id === r.id;
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setRestaurant(on ? null : { id: r.id, name: r.name })}
                  className={cn(
                    'min-h-touch flex-row items-center gap-3 rounded-xl border px-3 py-2 active:opacity-80',
                    on ? 'border-brand-500 bg-brand-50' : 'border-line-subtle bg-surface',
                  )}
                >
                  <Icon name="storefront-outline" size="sm" tone={on ? 'brand' : 'secondary'} />
                  <Text variant="body" weight={on ? 'semibold' : 'regular'} className="flex-1" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size="md" tone={on ? 'brand' : 'muted'} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>
      <ExportCsvSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Xuất đơn hàng (CSV)"
        description="Toàn bộ đơn trong kỳ, mọi trạng thái: mã đơn, thời gian, quán, khách, tài xế, thanh toán, tiền món, phí giao, tổng, phí sàn, lý do huỷ."
        filePrefix="zomzom-don-hang"
        fetchCsv={adminApi.exportOrdersCsv}
      />
    </View>
  );
};
