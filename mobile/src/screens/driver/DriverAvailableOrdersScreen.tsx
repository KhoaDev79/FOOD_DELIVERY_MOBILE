import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
import { ordersApi } from '../../api/orders';
import {
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  LoadingSpinner,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { FilterChip } from '../../components/ui/Chip';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { OrderDetail } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';
import { haversineKm } from '../../utils/geo';

export const DriverAvailableOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const { coords: driverCoords } = useLocation();
  const toast = useToast();

  const [isOnline, setIsOnline] = useState(true);
  const [filterReadyOnly, setFilterReadyOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Lấy thông tin hồ sơ tài xế thật từ backend
  const { data: driverProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: () => driversApi.getMe(),
  });

  // Lấy hạn mức công nợ COD
  const { data: ledgerSummary, refetch: refetchLedger } = useQuery({
    queryKey: ['driver', 'ledger'],
    queryFn: () => driversApi.getMyLedger({ page: 1, limit: 5 }),
  });

  const codBalance = ledgerSummary?.balance ?? driverProfile?.codBalance ?? 0;
  const debtLimit = ledgerSummary?.limit ?? 2000000;
  const isOverDebtLimit = codBalance >= debtLimit;
  const isNearDebtLimit = !isOverDebtLimit && debtLimit > 0 && codBalance >= debtLimit * 0.8;

  // Đồng bộ trạng thái trực tuyến ban đầu từ server
  useEffect(() => {
    if (driverProfile !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOnline(driverProfile.isOnline);
    }
  }, [driverProfile]);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    order: OrderDetail | null;
  }>({
    visible: false,
    order: null,
  });

  // Thống kê nhanh hôm nay
  const { data: todayStats } = useQuery({
    queryKey: ['driver', 'stats', 1],
    queryFn: () => ordersApi.getDriverStats({ days: 1 }),
    refetchInterval: 30000,
  });

  // Lấy các chuyến đang giao để kiểm tra giới hạn MAX_ACTIVE_DELIVERIES = 2
  const { data: activeDeliveriesData, refetch: refetchDeliveries } = useQuery({
    queryKey: ['driver', 'deliveries', 'active_count'],
    queryFn: () => ordersApi.getDeliveries({ limit: 10 }),
    refetchInterval: 10000,
  });

  const activeDeliveriesCount = useMemo(() => {
    return (
      activeDeliveriesData?.items?.filter(
        (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
      ).length || 0
    );
  }, [activeDeliveriesData]);

  // Xử lý bật/tắt trực tuyến qua API server
  const handleToggleOnline = async (nextValue: boolean) => {
    if (isTogglingStatus) return;

    if (nextValue) {
      // Kiểm tra hồ sơ đã được duyệt chưa
      if (driverProfile?.verificationStatus === 'PENDING') {
        toast('Hồ sơ của bạn đang chờ duyệt. Chưa thể bật trực tuyến.', 'error');
        return;
      }
      if (driverProfile?.verificationStatus === 'REJECTED') {
        toast(`Hồ sơ bị từ chối: ${driverProfile.rejectionReason || ''}`, 'error');
        return;
      }
      if (driverProfile?.verificationStatus === 'SUSPENDED') {
        toast(`Tài khoản bị tạm khoá: ${driverProfile.rejectionReason || ''}`, 'error');
        return;
      }
    } else {
      if (activeDeliveriesCount > 0) {
        toast(`Lưu ý: Bạn vẫn còn ${activeDeliveriesCount} đơn đang giao.`, 'default');
      }
    }

    try {
      setIsTogglingStatus(true);
      await driversApi.updateStatus({
        isOnline: nextValue,
        latitude: driverCoords?.latitude,
        longitude: driverCoords?.longitude,
      });
      setIsOnline(nextValue);
      queryClient.invalidateQueries({ queryKey: ['driver', 'me'] });
      toast(nextValue ? 'Đã chuyển sang Trực tuyến!' : 'Đã chuyển sang Ngoại tuyến', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể cập nhật trạng thái trực tuyến';
      toast(msg, 'error');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Lấy danh sách đơn chờ nhận
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'available'],
    queryFn: () => ordersApi.getAvailable({ limit: 50 }),
    enabled: isOnline,
    refetchInterval: isOnline ? 8000 : false,
  });

  // Socket lắng nghe thời gian thực
  React.useEffect(() => {
    if (!isOnline) return;

    const handleAvailable = (order: OrderDetail) => {
      queryClient.setQueryData<any>(['driver', 'available'], (old: any) => {
        if (!old?.items) return { items: [order] };
        if (old.items.some((o: OrderDetail) => o.id === order.id)) return old;
        return { ...old, items: [order, ...old.items] };
      });
      toast(
        `Đơn hàng mới từ ${order.restaurant?.name || 'Nhà hàng'} (Phí ship ${formatVND(
          order.deliveryFee,
        )})`,
        'default',
      );
    };

    const handleAssigned = (order: OrderDetail) => {
      // Nếu tài xế khác nhận đơn, xoá khỏi danh sách chờ
      queryClient.setQueryData<any>(['driver', 'available'], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter((o: OrderDetail) => o.id !== order.id),
        };
      });
    };

    const handleStatus = () => {
      refetch();
    };

    socket?.on('order:available', handleAvailable);
    socket?.on('order:driver_assigned', handleAssigned);
    socket?.on('order:status', handleStatus);

    return () => {
      socket?.off('order:available', handleAvailable);
      socket?.off('order:driver_assigned', handleAssigned);
      socket?.off('order:status', handleStatus);
    };
  }, [socket, isOnline, queryClient, refetch, toast]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchDeliveries(), refetchProfile(), refetchLedger()]);
    setRefreshing(false);
  };

  // Nhận đơn mutation
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.acceptOrder(orderId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['driver', 'deliveries'] });
      toast(`Đã nhận chuyến #${updated.id.slice(0, 8).toUpperCase()}!`, 'success');
      navigation.navigate('DriverDeliveryDetail', { orderId: updated.id });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'Đơn đã có tài xế khác nhận hoặc không còn khả dụng.';
      toast(msg, 'error');
      refetch();
    },
  });

  const handleOpenConfirm = (order: OrderDetail) => {
    setConfirmDialog({
      visible: true,
      order,
    });
  };

  const handleConfirmAccept = () => {
    if (confirmDialog.order) {
      const id = confirmDialog.order.id;
      setConfirmDialog({ visible: false, order: null });
      acceptMutation.mutate(id);
    }
  };

  // Tính khoảng cách từ tài xế tới quán và sắp xếp quán gần nhất
  const sortedAndFilteredOrders = useMemo(() => {
    if (!ordersData?.items) return [];
    let items = [...ordersData.items];

    if (filterReadyOnly) {
      items = items.filter((o) => o.status === 'READY_FOR_PICKUP');
    }

    // Gắn khoảng cách từ tài xế đến quán
    const withDistance = items.map((order) => {
      let driverToRestKm: number | null = null;
      if (
        driverCoords &&
        order.restaurant?.latitude &&
        order.restaurant?.longitude
      ) {
        driverToRestKm = haversineKm(driverCoords, {
          latitude: order.restaurant.latitude,
          longitude: order.restaurant.longitude,
        });
      }
      return { order, driverToRestKm };
    });

    // Sắp xếp quán gần tài xế nhất
    withDistance.sort((a, b) => {
      if (a.driverToRestKm !== null && b.driverToRestKm !== null) {
        return a.driverToRestKm - b.driverToRestKm;
      }
      return 0;
    });

    return withDistance;
  }, [ordersData, filterReadyOnly, driverCoords]);

  const isMaxDeliveries = activeDeliveriesCount >= 2;

  const renderOrderItem = ({
    item,
  }: {
    item: { order: OrderDetail; driverToRestKm: number | null };
  }) => {
    const { order, driverToRestKm } = item;
    const isCod = order.paymentMethod === 'COD';
    const isReady = order.status === 'READY_FOR_PICKUP';
    const itemCount =
      order.items?.reduce((acc, it) => acc + it.quantity, 0) || 0;
    const tripEarning = order.driverEarning ?? order.deliveryFee;
    const orderDebt = order.subtotal + (order.platformCommission ?? Math.max(0, order.deliveryFee - tripEarning));
    const exceedsDebtForOrder = isOverDebtLimit || codBalance + orderDebt > debtLimit;

    return (
      <View className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card">
        {/* Header đơn: Mã đơn, thời gian, trạng thái chuẩn bị */}
        <View className="flex-row items-center justify-between border-b border-line-subtle pb-3">
          <View>
            <Text variant="headline" weight="bold">
              Đơn #{order.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDateTime(order.createdAt)} • {itemCount} món
            </Text>
          </View>

          <View
            className={cn(
              'rounded-full px-2.5 py-1',
              isReady ? 'bg-success-soft' : 'bg-warning-soft/30',
            )}
          >
            <Text
              variant="caption"
              weight="bold"
              tone={isReady ? 'success' : 'warning'}
            >
              {isReady ? 'Món đã sẵn sàng' : 'Quán đang làm món'}
            </Text>
          </View>
        </View>

        {/* Lộ trình hai chặng: Quán và Khách */}
        <View className="my-3 gap-2.5 rounded-xl bg-surface-subtle p-3">
          {/* Điểm lấy */}
          <View className="flex-row items-center gap-2.5">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-danger-soft">
              <Ionicons name="storefront" size={13} color="#EF4444" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Lấy tại quán
                </Text>
                {driverToRestKm !== null && (
                  <Text variant="caption" weight="medium" tone="brand">
                    Cách bạn {driverToRestKm} km
                  </Text>
                )}
              </View>
              <Text variant="body" weight="bold" numberOfLines={1}>
                {order.restaurant?.name || 'Nhà hàng'}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {order.restaurant?.address || 'Địa chỉ quán'}
              </Text>
            </View>
          </View>

          <View className="ml-3 h-3 w-0.5 border-l border-dashed border-line" />

          {/* Điểm giao */}
          <View className="flex-row items-center gap-2.5">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="location" size={13} color="#1EB9CE" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Giao đến khách
                </Text>
                <Text variant="caption" tone="secondary">
                  Quán → Khách: {order.distanceKm} km
                </Text>
              </View>
              <Text variant="body" weight="bold" numberOfLines={1}>
                {order.customer?.fullName || 'Khách hàng'}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {order.deliveryAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Tài chính đơn: Thu nhập chuyến & Tiền cần thu */}
        <View className="flex-row items-center justify-between border-t border-line-subtle pt-3">
          <View>
            <Text variant="caption" tone="secondary">
              Thu nhập thực nhận
            </Text>
            <Text variant="headline" weight="bold" tone="brand">
              +{formatVND(tripEarning)}
            </Text>
          </View>

          <View className="items-end">
            <Text variant="caption" tone="secondary">
              Tiền thu của khách
            </Text>
            {isCod ? (
              <Text variant="body" weight="bold" tone="danger">
                Thu COD: {formatVND(order.total)}
              </Text>
            ) : (
              <Text variant="body" weight="bold" tone="success">
                Khách đã trả qua thẻ (0 ₫)
              </Text>
            )}
          </View>
        </View>

        {/* Nút bấm nhận chuyến */}
        <View className="mt-3">
          {isMaxDeliveries ? (
            <View className="items-center rounded-xl bg-surface-subtle py-2.5">
              <Text variant="caption" weight="bold" tone="secondary">
                Đang giao tối đa ({activeDeliveriesCount}/2 đơn)
              </Text>
            </View>
          ) : exceedsDebtForOrder ? (
            <View className="items-center rounded-xl bg-danger-soft/40 py-2.5">
              <Text variant="caption" weight="bold" tone="danger">
                Vượt hạn mức công nợ COD ({formatVND(codBalance + orderDebt)} / {formatVND(debtLimit)})
              </Text>
            </View>
          ) : (
            <Button
              label="Nhận chuyến này"
              variant="primary"
              size="md"
              loading={acceptMutation.isPending}
              onPress={() => handleOpenConfirm(order)}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      {/* Header gradient với công tắc Trực tuyến / Ngoại tuyến */}
      <TabHeader
        title={`Chào ${user?.fullName || 'Tài xế'}!`}
        subtitle="Sẵn sàng nhận những cuốc xe giao đồ ăn mới"
        trailing={
          <View className="flex-row items-center gap-2 rounded-2xl bg-surface/20 px-3 py-1.5 backdrop-blur-md">
            <View
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                isOnline ? 'bg-success' : 'bg-line',
              )}
            />
            <Text variant="caption" weight="bold" tone="inverse">
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              disabled={isTogglingStatus}
              trackColor={{ false: '#94A3B8', true: '#10B981' }}
              thumbColor="#FFFFFF"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        }
      />

      {/* Cảnh báo hồ sơ chưa được duyệt */}
      {driverProfile && driverProfile.verificationStatus !== 'APPROVED' && (
        <View className="flex-row items-center justify-between border-b border-warning-soft bg-warning-soft/20 px-4 py-3">
          <View className="flex-1 pr-2">
            <Text variant="caption" weight="bold" tone="warning">
              {driverProfile.verificationStatus === 'PENDING'
                ? 'Hồ sơ phương tiện đang chờ duyệt'
                : driverProfile.verificationStatus === 'SUSPENDED'
                ? 'Tài khoản đối tác bị tạm khoá'
                : 'Hồ sơ phương tiện bị từ chối'}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {driverProfile.rejectionReason || 'Vui lòng hoàn tất thông tin xe để ban quản trị xác nhận.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('DriverProfileTab')}
            className="rounded-lg bg-surface px-2.5 py-1.5 shadow-card active:bg-canvas-subtle"
          >
            <Text variant="caption" weight="bold" tone="brand">
              Hồ sơ
            </Text>
          </Pressable>
        </View>
      )}

      {/* Cảnh báo công nợ COD sắp chạm hoặc đã chạm hạn mức (C4) */}
      {(isOverDebtLimit || isNearDebtLimit) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('DriverWallet')}
          className={cn(
            'flex-row items-center justify-between border-b px-4 py-3',
            isOverDebtLimit
              ? 'border-danger-soft bg-danger-soft/30'
              : 'border-warning-soft bg-warning-soft/20',
          )}
        >
          <View className="flex-1 pr-2">
            <Text variant="caption" weight="bold" tone={isOverDebtLimit ? 'danger' : 'warning'}>
              {isOverDebtLimit
                ? `Công nợ COD đã chạm hạn mức (${formatVND(codBalance)} / ${formatVND(debtLimit)})`
                : `Công nợ COD sắp chạm hạn mức (${formatVND(codBalance)} / ${formatVND(debtLimit)})`}
            </Text>
            <Text variant="caption" tone="secondary">
              {isOverDebtLimit
                ? 'Vui lòng nộp tiền mặt về công ty để mở khoá nhận đơn mới.'
                : 'Chạm để xem chi tiết sổ quỹ COD và hạn mức.'}
            </Text>
          </View>
          <View className="rounded-lg bg-surface px-2.5 py-1.5 shadow-card">
            <Text variant="caption" weight="bold" tone="brand">
              Ví COD
            </Text>
          </View>
        </Pressable>
      )}

      {/* Thẻ tóm tắt nhanh hôm nay */}
      <View className="border-b border-line bg-surface px-4 py-3 shadow-card">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 items-center border-r border-line-subtle pr-2">
            <Text variant="caption" tone="secondary">
              Thu nhập hôm nay
            </Text>
            <Text variant="body-lg" weight="bold" tone="brand">
              {formatVND(todayStats?.earnings || 0)}
            </Text>
          </View>

          <View className="flex-1 items-center border-r border-line-subtle px-2">
            <Text variant="caption" tone="secondary">
              Chuyến hôm nay
            </Text>
            <Text variant="body-lg" weight="bold">
              {todayStats?.deliveredTrips || 0}
            </Text>
          </View>

          <View className="flex-1 items-center pl-2">
            <Text variant="caption" tone="secondary">
              Đang giao
            </Text>
            <Text
              variant="body-lg"
              weight="bold"
              tone={isMaxDeliveries ? 'danger' : 'default'}
            >
              {activeDeliveriesCount}/2
            </Text>
          </View>
        </View>

        {/* Lọc danh sách: Tất cả / Món đã sẵn sàng */}
        {isOnline && (
          <View className="mt-3 flex-row items-center gap-2 border-t border-line-subtle pt-2.5">
            <FilterChip
              label="Tất cả đơn chờ"
              selected={!filterReadyOnly}
              onPress={() => setFilterReadyOnly(false)}
            />
            <FilterChip
              label="Món đã sẵn sàng"
              selected={filterReadyOnly}
              onPress={() => setFilterReadyOnly(true)}
            />
          </View>
        )}
      </View>

      {/* Danh sách đơn hoặc Trạng thái Ngoại tuyến */}
      {!isOnline ? (
        <EmptyState
          icon="moon-outline"
          title="Bạn đang ngoại tuyến"
          message="Hãy gạt công tắc phía trên để chuyển sang Trực tuyến và bắt đầu nhận các đơn hàng xung quanh bạn."
          actionLabel="Bật trực tuyến ngay"
          onAction={() => setIsOnline(true)}
        />
      ) : isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center p-6">
          <LoadingSpinner message="Đang tìm kiếm đơn hàng quanh bạn..." />
        </View>
      ) : (
        <FlatList
          data={sortedAndFilteredOrders}
          keyExtractor={(item) => item.order.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 100,
            flexGrow: sortedAndFilteredOrders.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1EB9CE"
              colors={['#1EB9CE']}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Hiện chưa có đơn hàng chờ"
              message="Các đơn hàng mới từ quán ăn sẽ tự động hiển thị ngay khi có khách đặt. Bạn có thể kéo xuống để làm mới."
            />
          }
        />
      )}

      {/* HỘP XÁC NHẬN NHẬN CHUYẾN */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title="Xác nhận nhận chuyến giao"
        message={
          confirmDialog.order
            ? `Điểm lấy: ${confirmDialog.order.restaurant?.name}\nĐiểm giao: ${confirmDialog.order.deliveryAddress}\n\nThu nhập chuyến: +${formatVND(
                confirmDialog.order.deliveryFee,
              )}`
            : ''
        }
        confirmLabel="Nhận chuyến này"
        cancelLabel="Bỏ qua"
        onConfirm={handleConfirmAccept}
        onCancel={() => setConfirmDialog({ visible: false, order: null })}
      />
    </SafeAreaView>
  );
};
