import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../api/orders';
import {
  cn,
  EmptyState,
  LoadingSpinner,
  OrderStatusBadge,
  TabHeader,
  Text,
} from '../../components/ui';
import { useSocket } from '../../hooks/useSocket';
import { OrderDetail, OrderStatus } from '../../types/api';
import { formatDateTime, formatVND } from '../../utils/format';

type DeliveryTab = 'ACTIVE' | 'COMPLETED';

const STEP_LABELS = ['Đã nhận', 'Đang nấu', 'Sẵn sàng', 'Đang giao', 'Đã giao'];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'CONFIRMED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY_FOR_PICKUP':
      return 2;
    case 'PICKED_UP':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
}

export const DriverDeliveriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<DeliveryTab>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);

  // Lấy danh sách chuyến giao của tài xế
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'deliveries', activeTab],
    queryFn: () =>
      ordersApi.getDeliveries({
        status: activeTab === 'COMPLETED' ? 'DELIVERED' : undefined,
        limit: 50,
      }),
    refetchInterval: 10000,
  });

  // Socket lắng nghe thay đổi trạng thái
  useEffect(() => {
    const handleOrderUpdate = () => {
      refetch();
    };

    socket?.on('order:status', handleOrderUpdate);
    socket?.on('order:driver_assigned', handleOrderUpdate);

    return () => {
      socket?.off('order:status', handleOrderUpdate);
      socket?.off('order:driver_assigned', handleOrderUpdate);
    };
  }, [socket, refetch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const allItems = ordersData?.items || [];
  const filteredItems = allItems.filter((o) => {
    if (activeTab === 'ACTIVE') {
      return o.status !== 'DELIVERED' && o.status !== 'CANCELLED';
    }
    return o.status === 'DELIVERED' || o.status === 'CANCELLED';
  });

  const renderOrderItem = ({ item }: { item: OrderDetail }) => {
    const currentStep = getStepIndex(item.status);
    const isCod = item.paymentMethod === 'COD';
    const isDelivered = item.status === 'DELIVERED';
    const isCancelled = item.status === 'CANCELLED';

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem chi tiết chuyến giao #${item.id.slice(0, 8).toUpperCase()}`}
        onPress={() => navigation.navigate('DriverDeliveryDetail', { orderId: item.id })}
        className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card active:opacity-95"
      >
        {/* Header thẻ: Mã đơn, thời gian & Trạng thái */}
        <View className="flex-row items-center justify-between border-b border-line-subtle pb-3">
          <View>
            <Text variant="headline" weight="bold">
              Đơn #{item.id.slice(0, 8).toUpperCase()}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatDateTime(item.createdAt)}
            </Text>
          </View>
          <OrderStatusBadge status={item.status} />
        </View>

        {/* Thanh tiến trình 5 bước */}
        {!isCancelled && (
          <View className="my-3 py-1">
            <View className="flex-row items-center justify-between">
              {STEP_LABELS.map((label, idx) => {
                const isDone = idx < currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <View key={label} className="flex-1 items-center">
                    <View className="relative w-full items-center">
                      {idx > 0 && (
                        <View
                          className={cn(
                            'absolute left-0 right-1/2 top-2.5 h-0.5',
                            isDone || isCurrent ? 'bg-brand-500' : 'bg-line',
                          )}
                        />
                      )}
                      {idx < STEP_LABELS.length - 1 && (
                        <View
                          className={cn(
                            'absolute left-1/2 right-0 top-2.5 h-0.5',
                            isDone ? 'bg-brand-500' : 'bg-line',
                          )}
                        />
                      )}
                      <View
                        className={cn(
                          'h-5 w-5 items-center justify-center rounded-full border',
                          isCurrent
                            ? 'border-brand-500 bg-brand-500 shadow-glow'
                            : isDone
                            ? 'border-brand-500 bg-brand-500'
                            : 'border-line bg-surface',
                        )}
                      >
                        <Ionicons
                          name={isDone ? 'checkmark' : 'ellipse'}
                          size={isDone ? 10 : 6}
                          color={isDone || isCurrent ? '#FFFFFF' : '#94A3B8'}
                        />
                      </View>
                    </View>
                    <Text
                      variant="micro"
                      weight={isCurrent ? 'bold' : 'regular'}
                      tone={isCurrent ? 'brand' : isDone ? 'default' : 'secondary'}
                      className="mt-1 text-center text-[9px]"
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Lộ trình hai chặng */}
        <View className="gap-2.5 rounded-xl bg-surface-subtle p-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-danger-soft">
              <Ionicons name="storefront" size={13} color="#EF4444" />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                Lấy món tại
              </Text>
              <Text variant="body" weight="bold" numberOfLines={1}>
                {item.restaurant?.name || 'Nhà hàng'}
              </Text>
            </View>
          </View>

          <View className="ml-3 h-3 w-0.5 border-l border-dashed border-line" />

          <View className="flex-row items-center gap-2.5">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="location" size={13} color="#1EB9CE" />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                Giao đến
              </Text>
              <Text variant="body" weight="bold" numberOfLines={1}>
                {item.customer?.fullName || 'Khách hàng'} • {item.deliveryAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Thu nhập & Tiền cần thu */}
        <View className="mt-3 flex-row items-center justify-between border-t border-line-subtle pt-3">
          <View>
            <Text variant="caption" tone="secondary">
              Thu nhập chuyến
            </Text>
            <Text variant="body-lg" weight="bold" tone="brand">
              +{formatVND(item.deliveryFee)}
            </Text>
          </View>

          <View className="items-end">
            <Text variant="caption" tone="secondary">
              Tiền thu khách
            </Text>
            {isCod ? (
              <Text variant="body" weight="bold" tone="danger">
                Thu COD: {formatVND(item.total)}
              </Text>
            ) : (
              <Text variant="body" weight="bold" tone="success">
                Đã thanh toán (0 ₫)
              </Text>
            )}
          </View>
        </View>

        {/* Nút mở bản đồ chi tiết */}
        <View className="mt-3 flex-row items-center justify-between rounded-xl bg-brand-50 px-3.5 py-2.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="map" size={16} color="#1EB9CE" />
            <Text variant="caption" weight="bold" tone="brand">
              {isDelivered || isCancelled ? 'Xem lại lộ trình' : 'Xem bản đồ & Thao tác giao hàng'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#1EB9CE" />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <TabHeader
        title="Chuyến giao của tôi"
        subtitle="Quản lý và thực hiện các đơn hàng đang giao"
      />

      {/* Tabs chọn phân loại: Đang thực hiện / Lịch sử */}
      <View className="flex-row border-b border-line bg-surface px-4 py-2">
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'ACTIVE' }}
          onPress={() => setActiveTab('ACTIVE')}
          className={cn(
            'mr-2 flex-row items-center gap-2 rounded-xl px-4 py-2.5',
            activeTab === 'ACTIVE' ? 'bg-brand-500' : 'bg-surface-subtle',
          )}
        >
          <Ionicons
            name="bicycle"
            size={16}
            color={activeTab === 'ACTIVE' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            variant="caption"
            weight="bold"
            tone={activeTab === 'ACTIVE' ? 'inverse' : 'secondary'}
          >
            Đang thực hiện
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'COMPLETED' }}
          onPress={() => setActiveTab('COMPLETED')}
          className={cn(
            'flex-row items-center gap-2 rounded-xl px-4 py-2.5',
            activeTab === 'COMPLETED' ? 'bg-brand-500' : 'bg-surface-subtle',
          )}
        >
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={activeTab === 'COMPLETED' ? '#FFFFFF' : '#64748B'}
          />
          <Text
            variant="caption"
            weight="bold"
            tone={activeTab === 'COMPLETED' ? 'inverse' : 'secondary'}
          >
            Lịch sử đã giao
          </Text>
        </Pressable>
      </View>

      {/* Danh sách đơn */}
      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center p-6">
          <LoadingSpinner message="Đang tải danh sách chuyến giao..." />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 100,
            flexGrow: filteredItems.length === 0 ? 1 : undefined,
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
              icon={activeTab === 'ACTIVE' ? 'bicycle-outline' : 'checkmark-done-circle-outline'}
              title={
                activeTab === 'ACTIVE'
                  ? 'Không có chuyến nào đang giao'
                  : 'Chưa có lịch sử chuyến giao'
              }
              message={
                activeTab === 'ACTIVE'
                  ? 'Bạn hiện không có chuyến giao nào đang thực hiện. Hãy vào tab Tìm đơn để nhận thêm đơn mới!'
                  : 'Các đơn hàng bạn đã giao thành công sẽ hiển thị tại đây.'
              }
              actionLabel={activeTab === 'ACTIVE' ? 'Tìm đơn hàng mới ngay' : undefined}
              onAction={
                activeTab === 'ACTIVE'
                  ? () => navigation.navigate('DriverTabs', { screen: 'DriverAvailableTab' })
                  : undefined
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
};
