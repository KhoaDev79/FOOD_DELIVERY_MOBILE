import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi } from '../../api/admin';
import { ordersApi } from '../../api/orders';
import {
  Badge,
  BottomSheet,
  Button,
  Divider,
  EmptyState,
  FilterChip,
  Icon,
  Input,
  LoadingSpinner,
  OrderStatusBadge,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { palette } from '../../theme';
import { OrderDetail, OrderStatus } from '../../types/api';
import { AdminTabParamList } from '../../types/navigation';
import { formatDateTime, formatVND } from '../../utils/format';
import { CANCEL_REASON_LABELS, FAILED_DELIVERY_REASON_LABELS } from '../../utils/orderStatus';

type Props = BottomTabScreenProps<AdminTabParamList, 'AdminOrdersTab'>;

const STATUS_FILTERS: { key: OrderStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PREPARING', label: 'Đang chuẩn bị' },
  { key: 'READY_FOR_PICKUP', label: 'Chờ tài xế' },
  { key: 'PICKED_UP', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Đã giao' },
  { key: 'DELIVERY_FAILED', label: 'Giao thất bại' },
  { key: 'CANCELLED', label: 'Đã huỷ' },
];

const TERMINAL_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'];

export const AdminOrdersScreen: React.FC<Props> = ({ route }) => {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>(
    route.params?.status ? (route.params.status as OrderStatus) : 'ALL',
  );
  const [stalledOnly, setStalledOnly] = useState(Boolean(route.params?.stalledOnly));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'NONE' | 'CANCEL' | 'UNASSIGN'>('NONE');
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    if (route.params?.stalledOnly !== undefined || route.params?.status) {
      queueMicrotask(() => {
        if (route.params?.stalledOnly !== undefined) {
          setStalledOnly(Boolean(route.params.stalledOnly));
        }
        if (route.params?.status) {
          setStatusFilter(route.params.status as OrderStatus);
        }
      });
    }
  }, [route.params?.stalledOnly, route.params?.status]);

  const {
    data: ordersRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'orders', statusFilter, stalledOnly, searchQuery.trim()],
    queryFn: () =>
      adminApi.listOrders({
        page: 1,
        limit: 50,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        stalled: stalledOnly || undefined,
        q: searchQuery.trim() || undefined,
      }),
  });

  const { data: detailOrder, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin', 'order-detail', selectedOrderId],
    queryFn: () => adminApi.getOrderDetail(selectedOrderId!),
    enabled: Boolean(selectedOrderId),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      ordersApi.updateStatus(id, 'CANCELLED', {
        cancelReason: 'ADMIN_INTERVENTION',
        cancelNote: note,
      }),
    onSuccess: () => {
      toast('Đã huỷ đơn hàng.', 'success');
      setActionMode('NONE');
      setActionNote('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'order-detail', selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Không thể huỷ đơn hàng', 'error');
    },
  });

  const unassignDriverMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.unassignDriver(id, reason),
    onSuccess: () => {
      toast('Đã gỡ tài xế và phát lại đơn cho tài xế khác.', 'success');
      setActionMode('NONE');
      setActionNote('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'order-detail', selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Không thể gỡ tài xế', 'error');
    },
  });

  const orders = ordersRes?.items ?? [];
  const isTerminal = detailOrder ? TERMINAL_STATUSES.includes(detailOrder.status) : true;
  const driverProfile = (detailOrder?.driver as any)?.driverProfile;

  const renderOrderCard = ({ item }: { item: OrderDetail & { _count?: { contactAttempts: number } } }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        setSelectedOrderId(item.id);
        setActionMode('NONE');
        setActionNote('');
      }}
      className="gap-2.5 rounded-xl bg-surface p-4 shadow-card active:opacity-85"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text variant="body" weight="bold">
            #{item.id.slice(-6).toUpperCase()}
          </Text>
          {item.stalledAt && !TERMINAL_STATUSES.includes(item.status) && (
            <Badge label="Ứ đọng" tone="danger" size="sm" />
          )}
        </View>
        <OrderStatusBadge status={item.status} role="admin" />
      </View>

      <View className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Icon name="storefront-outline" size="xs" tone="brand" />
          <Text variant="caption" weight="semibold" className="flex-1" numberOfLines={1}>
            {item.restaurant?.name || 'Nhà hàng'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="person-outline" size="xs" tone="secondary" />
          <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
            Khách: {item.customer?.fullName || '—'} {item.customer?.phone ? `(${item.customer.phone})` : ''}
          </Text>
        </View>
        {item.driver && (
          <View className="flex-row items-center gap-1.5">
            <Icon name="bicycle-outline" size="xs" tone="secondary" />
            <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
              Tài xế: {item.driver.fullName} {item.driver.phone ? `(${item.driver.phone})` : ''}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between border-t border-line-subtle pt-2">
        <Text variant="micro" weight="regular" tone="muted">
          {formatDateTime(item.createdAt)}
        </Text>
        <Text variant="body" weight="bold" tone="brand">
          {formatVND(item.total)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <TabHeader title="Điều hành đơn hàng">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm mã đơn, SĐT, tên khách hoặc quán..."
        />
      </TabHeader>

      <View className="gap-2 py-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          <FilterChip
            label="Đơn ứ đọng"
            selected={stalledOnly}
            onPress={() => setStalledOnly((v) => !v)}
          />
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              selected={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading && !ordersRes ? (
        <LoadingSpinner message="Đang tải danh sách đơn..." />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCard}
          contentContainerClassName={`gap-3 px-4 pt-1 ${TAB_BAR_CLEARANCE}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
              colors={[palette.brand['500']]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="Không tìm thấy đơn hàng"
              description="Thử thay đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm."
            />
          }
        />
      )}

      {/* Bảng chi tiết & can thiệp đơn hàng */}
      <BottomSheet
        visible={Boolean(selectedOrderId)}
        onClose={() => {
          setSelectedOrderId(null);
          setActionMode('NONE');
          setActionNote('');
        }}
        title={detailOrder ? `Đơn #${detailOrder.id.slice(-6).toUpperCase()}` : 'Chi tiết đơn hàng'}
      >
        {loadingDetail || !detailOrder ? (
          <View className="py-8">
            <LoadingSpinner message="Đang tải chi tiết đơn..." />
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-6">
            <View className="flex-row items-center justify-between">
              <OrderStatusBadge status={detailOrder.status} />
              <Text variant="title" weight="bold" tone="brand">
                {formatVND(detailOrder.total)}
              </Text>
            </View>

            {/* Thông tin các bên */}
            <View className="gap-2 rounded-xl bg-canvas-subtle p-3">
              <Text variant="caption" weight="semibold" tone="secondary">
                Quán ăn: {detailOrder.restaurant?.name} ({detailOrder.restaurant?.phone || 'Chưa có SĐT'})
              </Text>
              <Text variant="caption" weight="semibold" tone="secondary">
                Khách hàng: {detailOrder.customer?.fullName} ({detailOrder.customer?.phone || 'Đã ẩn/Chưa có SĐT'})
              </Text>
              <Text variant="caption" tone="secondary">
                Địa chỉ giao: {detailOrder.deliveryAddress}
              </Text>
              <Text variant="caption" weight="semibold" tone="secondary">
                Tài xế:{' '}
                {detailOrder.driver
                  ? `${detailOrder.driver.fullName} (${detailOrder.driver.phone || 'Chưa có SĐT'})`
                  : 'Chưa có tài xế'}
              </Text>
              {driverProfile?.lastLatitude !== null && driverProfile?.lastLatitude !== undefined && (
                <Text variant="micro" weight="regular" tone="muted">
                  Vị trí tài xế cuối: {driverProfile.lastLatitude.toFixed(5)}, {driverProfile.lastLongitude?.toFixed(5)}{' '}
                  {driverProfile.lastLocationAt ? `(${formatDateTime(driverProfile.lastLocationAt)})` : ''}
                </Text>
              )}
              <Text variant="caption" tone="secondary">
                Số lần tài xế gọi khách: {detailOrder.contactAttempts?.length ?? 0} lần
              </Text>
            </View>

            {/* Lý do huỷ / giao thất bại nếu có */}
            {(detailOrder.cancelReason || detailOrder.failedReason || detailOrder.cancelNote) && (
              <View className="gap-1 rounded-xl border border-danger/30 bg-danger-soft p-3">
                {!!detailOrder.cancelReason && (
                  <Text variant="caption" weight="semibold" tone="danger">
                    Lý do huỷ: {CANCEL_REASON_LABELS[detailOrder.cancelReason]}
                  </Text>
                )}
                {!!detailOrder.failedReason && (
                  <Text variant="caption" weight="semibold" tone="danger">
                    Giao thất bại: {FAILED_DELIVERY_REASON_LABELS[detailOrder.failedReason]}
                  </Text>
                )}
                {!!detailOrder.cancelNote && (
                  <Text variant="caption" tone="default">
                    Ghi chú: {detailOrder.cancelNote}
                  </Text>
                )}
              </View>
            )}

            {/* Lịch sử trạng thái */}
            <View className="gap-2">
              <Text variant="body" weight="bold">
                Lịch sử trạng thái
              </Text>
              {(detailOrder.statusHistory ?? []).map((h, idx) => (
                <View key={h.id ?? idx} className="gap-0.5 rounded-lg border border-line-subtle bg-surface p-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text variant="caption" weight="bold">
                      {h.status}
                    </Text>
                    <Text variant="micro" weight="regular" tone="muted">
                      {formatDateTime(h.createdAt)}
                    </Text>
                  </View>
                  <Text variant="micro" weight="regular" tone="secondary">
                    Người thực hiện: {h.changedBy || 'SYSTEM'}
                  </Text>
                  {!!h.note && (
                    <Text variant="caption" tone="secondary">
                      Ghi chú: {h.note}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <Divider />

            {/* Hành động can thiệp của Admin */}
            {!isTerminal && (
              <View className="gap-3">
                <Text variant="body" weight="bold">
                  Can thiệp điều hành
                </Text>

                {actionMode === 'NONE' ? (
                  <View className="flex-row gap-2">
                    {Boolean(detailOrder.driverId) && (
                      <View className="flex-1">
                        <Button
                          label="Gỡ tài xế"
                          leftIcon="person-remove-outline"
                          variant="secondary"
                          onPress={() => {
                            setActionMode('UNASSIGN');
                            setActionNote('');
                          }}
                        />
                      </View>
                    )}
                    <View className="flex-1">
                      <Button
                        label="Huỷ đơn hàng"
                        leftIcon="close-circle-outline"
                        variant="danger"
                        onPress={() => {
                          setActionMode('CANCEL');
                          setActionNote('');
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <View className="gap-2 rounded-xl border border-line bg-canvas-subtle p-3">
                    <Input
                      label={
                        actionMode === 'CANCEL'
                          ? 'Lý do huỷ đơn (bắt buộc) *'
                          : 'Lý do gỡ tài xế (bắt buộc) *'
                      }
                      placeholder="Nhập lý do can thiệp để lưu nhật ký kiểm toán..."
                      value={actionNote}
                      onChangeText={setActionNote}
                      multiline
                    />
                    <View className="flex-row justify-end gap-2">
                      <Button
                        label="Đóng"
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        onPress={() => setActionMode('NONE')}
                      />
                      <Button
                        label={actionMode === 'CANCEL' ? 'Xác nhận huỷ đơn' : 'Xác nhận gỡ tài xế'}
                        variant={actionMode === 'CANCEL' ? 'danger' : 'primary'}
                        size="sm"
                        fullWidth={false}
                        disabled={actionNote.trim().length < 2}
                        loading={cancelOrderMutation.isPending || unassignDriverMutation.isPending}
                        onPress={() => {
                          if (actionMode === 'CANCEL') {
                            cancelOrderMutation.mutate({
                              id: detailOrder.id,
                              note: actionNote.trim(),
                            });
                          } else {
                            unassignDriverMutation.mutate({
                              id: detailOrder.id,
                              reason: actionNote.trim(),
                            });
                          }
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
};

