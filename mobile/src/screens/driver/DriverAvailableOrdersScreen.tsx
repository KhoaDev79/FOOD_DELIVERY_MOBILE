import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Switch,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { driversApi } from '../../api/drivers';
import { ordersApi } from '../../api/orders';
import {
  MetricChip,
  Money,
  NoticeCard,
  orderCode,
  RouteStops,
  SegmentedTabs,
  timeAgo,
} from '../../components/modules/partner/PartnerKit';
import {
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconName,
  LoadingSpinner,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useLocation } from '../../hooks/useLocation';
import { palette } from '../../theme';
import { useSocket, useSocketConnected } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { OrderDetail } from '../../types/api';
import { formatVND } from '../../utils/format';

export const DriverAvailableOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const socketConnected = useSocketConnected();
  const { refreshLocation } = useLocation();
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
    refetchInterval: socketConnected ? 60000 : 10000,
  });

  // Lấy các chuyến đang giao để kiểm tra giới hạn MAX_ACTIVE_DELIVERIES = 2
  const { data: activeDeliveriesData, refetch: refetchDeliveries } = useQuery({
    queryKey: ['driver', 'deliveries', 'active_count'],
    queryFn: () => ordersApi.getDeliveries({ limit: 10 }),
    refetchInterval: socketConnected ? false : 10000,
  });

  const activeOrders = useMemo(
    () =>
      activeDeliveriesData?.items?.filter(
        (o) =>
          o.status !== 'DELIVERED' &&
          o.status !== 'CANCELLED' &&
          o.status !== 'DELIVERY_FAILED',
      ) ?? [],
    [activeDeliveriesData],
  );
  const activeDeliveriesCount = activeOrders.length;

  // Xử lý bật/tắt trực tuyến qua API server (D1: Bắt buộc vị trí thật khi bật trực tuyến)
  const handleToggleOnline = async (nextValue: boolean) => {
    if (isTogglingStatus) return;

    let liveCoords: { latitude: number; longitude: number } | null = null;
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

      liveCoords = await refreshLocation();
      if (!liveCoords) {
        toast(
          'Vui lòng cấp quyền truy cập vị trí và bật GPS để nhận đơn hàng trong bán kính gần bạn.',
          'error',
        );
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
        ...(liveCoords
          ? { latitude: liveCoords.latitude, longitude: liveCoords.longitude }
          : {}),
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
    refetchInterval: isOnline ? (socketConnected ? false : 10000) : false,
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
      const earning = order.driverEarning ?? order.deliveryFee;
      toast(
        `Đơn hàng mới từ ${order.restaurant?.name || 'Nhà hàng'} (Thu nhập ${formatVND(
          earning,
        )})`,
        'default',
      );
    };

    const handleRemoveTaken = (payload: { id: string }) => {
      queryClient.setQueryData<any>(['driver', 'available'], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.filter((o: OrderDetail) => o.id !== payload.id),
        };
      });
    };

    const handleStatus = () => {
      refetch();
    };

    socket?.on('order:available', handleAvailable);
    socket?.on('order:driver_assigned', handleRemoveTaken);
    socket?.on('order:taken', handleRemoveTaken);
    socket?.on('order:status', handleStatus);

    return () => {
      socket?.off('order:available', handleAvailable);
      socket?.off('order:driver_assigned', handleRemoveTaken);
      socket?.off('order:taken', handleRemoveTaken);
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
      toast(`Đã nhận chuyến #${orderCode(updated.id)}!`, 'success');
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

    // Gắn khoảng cách từ tài xế đến quán (ưu tiên distanceToRestaurantKm từ server D3)
    const withDistance = items.map((order) => {
      const driverToRestKm =
        typeof order.distanceToRestaurantKm === 'number' ? order.distanceToRestaurantKm : null;
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
  }, [ordersData, filterReadyOnly]);

  const isMaxDeliveries = activeDeliveriesCount >= 2;

  const allCount = ordersData?.items?.length ?? 0;
  const readyCount = ordersData?.items?.filter((o) => o.status === 'READY_FOR_PICKUP').length ?? 0;

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
      <View className="mb-3 gap-3 rounded-2xl bg-surface p-4 shadow-card">
        {/* Thu nhập chuyến (thứ tài xế nhìn đầu tiên) + trạng thái món */}
        <View className="flex-row items-start justify-between gap-3">
          <View>
            <Text variant="micro" tone="muted">
              Thu nhập chuyến
            </Text>
            <Text variant="title" weight="bold" tone="brand">
              +{formatVND(tripEarning)}
            </Text>
          </View>
          <View className="items-end gap-1">
            <View
              className={cn(
                'flex-row items-center gap-1 rounded-full px-2.5 py-1',
                isReady ? 'bg-success-soft' : 'bg-warning-soft',
              )}
            >
              <Icon name={isReady ? 'checkmark-circle' : 'flame'} size={13} tone={isReady ? 'success' : 'warning'} />
              <Text variant="micro" weight="bold" tone={isReady ? 'success' : 'warning'}>
                {isReady ? 'Món đã sẵn sàng' : 'Quán đang làm món'}
              </Text>
            </View>
            <Text variant="micro" weight="medium" tone="muted">
              #{orderCode(order.id)} • {timeAgo(order.createdAt)}
            </Text>
          </View>
        </View>

        {/* Số liệu nhanh để quyết định nhận đơn */}
        <View className="flex-row flex-wrap gap-1.5">
          {driverToRestKm !== null && (
            <MetricChip icon="navigate" tone="brand" label={`Cách bạn ${driverToRestKm} km`} />
          )}
          <MetricChip icon="swap-horizontal" label={`Quãng giao ${order.distanceKm} km`} />
          <MetricChip icon="fast-food-outline" label={`${itemCount} món`} />
        </View>

        {/* Lộ trình hai chặng */}
        <View className="rounded-xl bg-canvas-subtle p-3">
          <RouteStops
            compact
            pickup={{
              label: 'Lấy món',
              title: order.restaurant?.name || 'Nhà hàng',
              address: order.restaurant?.address || 'Địa chỉ quán',
              addressLines: 1,
            }}
            dropoff={{
              label: 'Giao đến',
              title: order.customer?.fullName || 'Khách hàng',
              address: order.deliveryAddress,
              addressLines: 2,
            }}
          />
        </View>

        {/* Tiền cần thu của khách */}
        <View
          className={cn(
            'flex-row items-center justify-between rounded-xl px-3 py-2.5',
            isCod ? 'bg-danger-soft' : 'bg-success-soft',
          )}
        >
          <View className="flex-row items-center gap-2">
            <Icon name={isCod ? 'cash' : 'card'} size="sm" tone={isCod ? 'danger' : 'success'} />
            <Text variant="caption" weight="semibold" tone={isCod ? 'danger' : 'success'}>
              {isCod ? 'Thu tiền mặt' : 'Khách đã thanh toán'}
            </Text>
          </View>
          <Text variant="body-lg" weight="bold" tone={isCod ? 'danger' : 'success'}>
            {isCod ? formatVND(order.total) : '0 ₫'}
          </Text>
        </View>

        {/* Nút nhận chuyến */}
        {isMaxDeliveries ? (
          <View className="h-button-md flex-row items-center justify-center gap-2 rounded-xl bg-canvas-subtle">
            <Icon name="bicycle" size="sm" tone="secondary" />
            <Text variant="caption" weight="bold" tone="secondary">
              Đang giao tối đa ({activeDeliveriesCount}/2 đơn)
            </Text>
          </View>
        ) : exceedsDebtForOrder ? (
          <View className="min-h-button-md flex-row items-center justify-center gap-2 rounded-xl border border-danger-soft px-3 py-2">
            <Icon name="lock-closed" size="sm" tone="danger" />
            <Text variant="caption" weight="bold" tone="danger" className="flex-shrink text-center">
              Vượt hạn mức công nợ COD ({formatVND(codBalance + orderDebt)} / {formatVND(debtLimit)})
            </Text>
          </View>
        ) : (
          <Button
            label="Nhận chuyến này"
            variant="primary"
            size="lg"
            rightIcon="arrow-forward"
            loading={acceptMutation.isPending}
            onPress={() => handleOpenConfirm(order)}
          />
        )}
      </View>
    );
  };

  const verificationNotice: { title: string; icon: IconName } | null =
    driverProfile && driverProfile.verificationStatus !== 'APPROVED'
      ? driverProfile.verificationStatus === 'PENDING'
        ? { title: 'Hồ sơ phương tiện đang chờ duyệt', icon: 'hourglass' }
        : driverProfile.verificationStatus === 'SUSPENDED'
          ? { title: 'Tài khoản đối tác bị tạm khoá', icon: 'lock-closed' }
          : { title: 'Hồ sơ phương tiện bị từ chối', icon: 'close-circle' }
      : null;

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      {/* Header gradient với công tắc Trực tuyến / Ngoại tuyến (tên dài được xuống 2 dòng) */}
      <TabHeader
        title={`Chào ${user?.fullName || 'Tài xế'}!`}
        titleLines={2}
        subtitle={isOnline ? 'Đang tìm đơn quanh bạn' : 'Bạn đang tạm nghỉ'}
        trailing={
          <View className="flex-row items-center gap-2 rounded-full bg-surface/20 py-1 pl-3 pr-1.5">
            <View className={cn('h-2.5 w-2.5 rounded-full', isOnline ? 'bg-success' : 'bg-line')} />
            <Text variant="caption" weight="bold" tone="inverse">
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              disabled={isTogglingStatus}
              trackColor={{ false: palette.ink.muted, true: palette.success.DEFAULT }}
              thumbColor={palette.ink.inverse}
            />
          </View>
        }
      />

      <View className="gap-3 px-4 pt-3">
        {/* Cảnh báo hồ sơ chưa được duyệt */}
        {verificationNotice && (
          <NoticeCard
            tone="warning"
            icon={verificationNotice.icon}
            title={verificationNotice.title}
            message={driverProfile?.rejectionReason || 'Vui lòng hoàn tất thông tin xe để ban quản trị xác nhận.'}
            actionLabel="Hồ sơ"
            onPress={() => navigation.navigate('DriverProfileTab')}
          />
        )}

        {/* Cảnh báo công nợ COD sắp chạm hoặc đã chạm hạn mức (C4) */}
        {(isOverDebtLimit || isNearDebtLimit) && (
          <NoticeCard
            tone={isOverDebtLimit ? 'danger' : 'warning'}
            icon="wallet"
            title={`${isOverDebtLimit ? 'Công nợ COD đã chạm hạn mức' : 'Công nợ COD sắp chạm hạn mức'} (${formatVND(codBalance)} / ${formatVND(debtLimit)})`}
            message={
              isOverDebtLimit
                ? 'Vui lòng nộp tiền mặt về công ty để mở khoá nhận đơn mới.'
                : 'Chạm để xem chi tiết sổ quỹ COD và hạn mức.'
            }
            actionLabel="Ví COD"
            onPress={() => navigation.navigate('DriverWallet')}
          />
        )}

        {/* Tóm tắt nhanh hôm nay */}
        <View className="flex-row rounded-2xl bg-surface p-3 shadow-card">
          <TodayStat icon="wallet" box="bg-brand-50" iconTone="brand" label="Thu nhập hôm nay">
            <Money amount={todayStats?.earnings || 0} tone="brand" />
          </TodayStat>
          <View className="mx-1 w-px bg-line-subtle" />
          <TodayStat icon="checkmark-done" box="bg-success-soft" iconTone="success" label="Chuyến hôm nay">
            <Text variant="body-lg" weight="bold">
              {todayStats?.deliveredTrips || 0}
            </Text>
          </TodayStat>
          <View className="mx-1 w-px bg-line-subtle" />
          <TodayStat
            icon="bicycle"
            box={isMaxDeliveries ? 'bg-danger-soft' : 'bg-accent-50'}
            iconTone={isMaxDeliveries ? 'danger' : 'accent'}
            label="Đang giao"
          >
            <Text variant="body-lg" weight="bold" tone={isMaxDeliveries ? 'danger' : 'default'}>
              {activeDeliveriesCount}/2
            </Text>
          </TodayStat>
        </View>

        {/* Nhắc chuyến đang giao dở: tài xế mở lại nhanh, khỏi phải đổi tab */}
        {activeDeliveriesCount > 0 && (
          <NoticeCard
            tone="brand"
            icon="bicycle"
            title={`Bạn có ${activeDeliveriesCount} chuyến đang giao`}
            message="Chạm để tiếp tục giao hàng"
            actionLabel="Mở"
            onPress={() =>
              activeDeliveriesCount === 1 && activeOrders[0]
                ? navigation.navigate('DriverDeliveryDetail', { orderId: activeOrders[0].id })
                : navigation.navigate('DriverDeliveriesTab')
            }
          />
        )}

        {/* Lọc danh sách: Tất cả / Món đã sẵn sàng */}
        {isOnline && (
          <SegmentedTabs
            value={filterReadyOnly ? 'READY' : 'ALL'}
            onChange={(k) => setFilterReadyOnly(k === 'READY')}
            items={[
              // Không hiện số 0 cho đỡ rối
              { key: 'ALL', label: 'Tất cả đơn', count: allCount || undefined },
              { key: 'READY', label: 'Món đã sẵn sàng', count: readyCount || undefined },
            ]}
            trackClassName="bg-line"
          />
        )}
      </View>

      {/* Danh sách đơn hoặc Trạng thái Ngoại tuyến */}
      {!isOnline ? (
        <EmptyState
          icon="moon-outline"
          title="Bạn đang ngoại tuyến"
          message="Bật Trực tuyến để bắt đầu nhận các đơn hàng xung quanh bạn."
          actionLabel="Bật trực tuyến ngay"
          onAction={() => handleToggleOnline(true)}
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 112, // khớp TAB_BAR_CLEARANCE (pb-28) của thanh tab nổi
            flexGrow: sortedAndFilteredOrders.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand['500']}
              colors={[palette.brand['500']]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center gap-4">
              <EmptyState
                icon="search-outline"
                title="Đang tìm đơn quanh bạn"
                message="Đơn mới sẽ tự hiện ngay khi có khách đặt. Kéo xuống để làm mới."
              />
              <View className="gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
                <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
                  Mẹo nhận đơn nhanh
                </Text>
                {EMPTY_TIPS.map((tip) => (
                  <View key={tip.text} className="flex-row items-center gap-2.5">
                    <View className={cn('h-8 w-8 items-center justify-center rounded-full', tip.box)}>
                      <Icon name={tip.icon} size="sm" tone={tip.tone} />
                    </View>
                    <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
                      {tip.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          }
        />
      )}

      {/* HỘP XÁC NHẬN NHẬN CHUYẾN */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title="Xác nhận nhận chuyến giao"
        message={
          confirmDialog.order
            ? `Điểm lấy: ${confirmDialog.order.restaurant?.name}\nĐiểm giao: ${confirmDialog.order.deliveryAddress}\n\nCông giao của bạn: ${formatVND(
                confirmDialog.order.driverEarning ?? confirmDialog.order.deliveryFee,
              )}`
            : ''
        }
        confirmLabel="Nhận chuyến này"
        cancelLabel="Bỏ qua"
        onConfirm={handleConfirmAccept}
        onCancel={() => setConfirmDialog({ visible: false, order: null })}
      />
    </View>
  );
};

const EMPTY_TIPS: { icon: IconName; box: string; tone: 'brand' | 'accent' | 'success'; text: string }[] = [
  { icon: 'restaurant', box: 'bg-accent-50', tone: 'accent', text: 'Đứng gần khu có nhiều quán ăn để được ưu tiên đơn gần.' },
  { icon: 'time', box: 'bg-brand-50', tone: 'brand', text: 'Giờ cao điểm 11h–13h và 17h–20h có nhiều đơn nhất.' },
  { icon: 'location', box: 'bg-success-soft', tone: 'success', text: 'Giữ GPS luôn bật để hệ thống tìm thấy bạn.' },
];

/** Ô số liệu trong thẻ "hôm nay". */
const TodayStat: React.FC<{
  icon: IconName;
  box: string;
  iconTone: 'brand' | 'success' | 'accent' | 'danger';
  label: string;
  children: React.ReactNode;
}> = ({ icon, box, iconTone, label, children }) => (
  <View className="flex-1 items-center gap-1 py-1">
    <View className={cn('h-10 w-10 items-center justify-center rounded-full', box)}>
      <Icon name={icon} size="md" tone={iconTone} />
    </View>
    {children}
    <Text variant="caption" weight="medium" tone="muted" numberOfLines={1} adjustsFontSizeToFit>
      {label}
    </Text>
  </View>
);
