import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ordersApi } from '../../api/orders';
import {
  clockTime,
  dayLabel,
  Money,
  orderCode,
  RoundAction,
  RouteStops,
  SegmentedTabs,
  timeAgo,
  TripStepper,
} from '../../components/modules/partner/PartnerKit';
import {
  cn,
  EmptyState,
  Icon,
  LoadingSpinner,
  OrderStatusBadge,
  TabHeader,
  Text,
} from '../../components/ui';
import { useDriverContact } from '../../hooks/useDriverContact';
import { useSocket, useSocketConnected } from '../../hooks/useSocket';
import { palette } from '../../theme';
import { OrderDetail, OrderStatus } from '../../types/api';
import { formatVND } from '../../utils/format';

type DeliveryTab = 'ACTIVE' | 'COMPLETED';

/** Đơn đã kết thúc: giao xong, huỷ, hoặc giao thất bại (đều nằm ở tab Lịch sử). */
const FINISHED: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'];

type DayRow = { kind: 'day'; key: string; day: string; label: string; count: number; total: number };
type Row = DayRow | { kind: 'order'; key: string; order: OrderDetail };

export const DriverDeliveriesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { socket } = useSocket();
  const socketConnected = useSocketConnected();
  const { callCustomer, callRestaurant } = useDriverContact();
  const [activeTab, setActiveTab] = useState<DeliveryTab>('ACTIVE');
  const [refreshing, setRefreshing] = useState(false);

  // Một lần tải cho cả hai tab, lọc ở dưới (trước đây tab Lịch sử chỉ tải đơn DELIVERED nên thiếu đơn huỷ/thất bại)
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['driver', 'deliveries', 'all'],
    queryFn: () => ordersApi.getDeliveries({ limit: 50 }),
    refetchInterval: socketConnected ? false : 10000,
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

  const { activeItems, finishedItems } = useMemo(() => {
    const all = ordersData?.items || [];
    // Đơn giao thất bại trước đây bị kẹt ở "Đang thực hiện": giờ thuộc Lịch sử như đơn huỷ và đơn đã giao
    return {
      activeItems: all.filter((o) => !FINISHED.includes(o.status)),
      finishedItems: all.filter((o) => FINISHED.includes(o.status)),
    };
  }, [ordersData]);

  const earningOf = (o: OrderDetail) => (o.status === 'CANCELLED' ? 0 : (o.driverEarning ?? o.deliveryFee));

  // Danh sách hiển thị: tab Lịch sử được nhóm theo ngày, mỗi ngày có dòng tổng
  const rows = useMemo<Row[]>(() => {
    if (activeTab === 'ACTIVE') return activeItems.map((o) => ({ kind: 'order', key: o.id, order: o }));
    const out: Row[] = [];
    const sorted = [...finishedItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    let header: DayRow | null = null;
    for (const o of sorted) {
      const day = new Date(o.createdAt).toDateString();
      if (!header || header.day !== day) {
        header = { kind: 'day', key: `d-${day}`, day, label: dayLabel(o.createdAt), count: 0, total: 0 };
        out.push(header);
      }
      header.count += 1;
      header.total += earningOf(o);
      out.push({ kind: 'order', key: o.id, order: o });
    }
    return out;
  }, [activeTab, activeItems, finishedItems]);

  /** Thẻ chuyến đang giao: đủ tiến trình, lộ trình và nút gọi nhanh. */
  const renderActiveItem = (item: OrderDetail) => {
    const isCod = item.paymentMethod === 'COD';
    const tripEarning = item.driverEarning ?? item.deliveryFee;

    return (
      <Pressable
        accessibilityLabel={`Xem chi tiết chuyến giao #${orderCode(item.id)}`}
        onPress={() => navigation.navigate('DriverDeliveryDetail', { orderId: item.id })}
        className="mb-3 gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-95"
      >
        <View className="flex-row items-center justify-between gap-2">
          <View>
            <Text variant="body-lg" weight="bold">
              #{orderCode(item.id)}
            </Text>
            <Text variant="micro" weight="medium" tone="muted">
              Đặt {timeAgo(item.createdAt)}
            </Text>
          </View>
          <OrderStatusBadge status={item.status} />
        </View>

        <TripStepper status={item.status} compact />

        <View className="rounded-xl bg-canvas-subtle p-3">
          <RouteStops
            compact
            pickup={{
              label: 'Lấy món tại',
              title: item.restaurant?.name || 'Nhà hàng',
              actions: item.restaurant?.phone ? (
                <RoundAction icon="call" tone="danger" label="Gọi cho quán" onPress={() => callRestaurant(item.restaurant?.phone)} />
              ) : undefined,
            }}
            dropoff={{
              label: 'Giao đến',
              title: item.customer?.fullName || 'Khách hàng',
              // Địa chỉ là thông tin tài xế cần đọc đủ: tối đa 2 dòng
              address: item.deliveryAddress,
              addressLines: 2,
              actions: item.customer?.phone ? (
                <RoundAction icon="call" label="Gọi cho khách hàng" onPress={() => callCustomer(item)} />
              ) : undefined,
            }}
          />
        </View>

        {/* Hai cột cùng kiểu: nhãn nhỏ trên, số tiền dưới */}
        <View className="flex-row">
          <View className="flex-1">
            <Text variant="micro" tone="muted">
              Thu nhập chuyến
            </Text>
            <Money amount={tripEarning} sign="+" tone="brand" />
          </View>
          <View className="w-px bg-line-subtle" />
          <View className="flex-1 items-end">
            <Text variant="micro" tone="muted">
              {isCod ? 'Thu tiền mặt' : 'Khách đã thanh toán'}
            </Text>
            <Money amount={isCod ? item.total : 0} tone={isCod ? 'danger' : 'success'} />
          </View>
        </View>

        <View className="h-button-md flex-row items-center justify-center gap-2 rounded-xl bg-brand-500">
          <Icon name="map" size="sm" tone="inverse" />
          <Text variant="caption" weight="bold" tone="inverse">
            Mở bản đồ & thao tác giao hàng
          </Text>
          <Icon name="chevron-forward" size="sm" tone="inverse" />
        </View>
      </Pressable>
    );
  };

  /** Thẻ lịch sử: gọn, chỉ những gì cần xem lại. */
  const renderFinishedItem = (item: OrderDetail) => {
    const isStopped = item.status === 'CANCELLED' || item.status === 'DELIVERY_FAILED';

    return (
      <Pressable
        accessibilityLabel={`Xem lại chuyến giao #${orderCode(item.id)}`}
        onPress={() => navigation.navigate('DriverDeliveryDetail', { orderId: item.id })}
        className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card active:opacity-95"
      >
        <View
          className={cn(
            'h-11 w-11 items-center justify-center rounded-full',
            isStopped ? 'bg-danger-soft' : 'bg-success-soft',
          )}
        >
          <Icon
            name={isStopped ? 'close' : 'checkmark'}
            size="md"
            tone={isStopped ? 'danger' : 'success'}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="bold" numberOfLines={1}>
            {item.restaurant?.name || 'Nhà hàng'}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            → {item.customer?.fullName || 'Khách hàng'}
          </Text>
          <Text variant="micro" weight="medium" tone="muted" numberOfLines={1}>
            {clockTime(item.createdAt)} • #{orderCode(item.id)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Money
            amount={earningOf(item)}
            sign={item.status === 'CANCELLED' ? '' : '+'}
            variant="body"
            tone={item.status === 'CANCELLED' ? 'muted' : 'brand'}
          />
          {/* Icon ✓ đã đủ cho đơn giao thành công; chỉ ghi rõ khi huỷ hoặc thất bại */}
          {isStopped && <OrderStatusBadge status={item.status} />}
        </View>
      </Pressable>
    );
  };

  const renderDayHeader = (row: DayRow) => (
    <View className="mb-2 mt-1 flex-row items-center justify-between px-1">
      <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
        {row.label}
      </Text>
      <Text variant="caption" weight="medium" tone="muted">
        {row.count} chuyến • <Text variant="caption" weight="bold" tone="brand">+{formatVND(row.total)}</Text>
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Chuyến giao của tôi"
        subtitle="Quản lý và thực hiện các đơn hàng đang giao"
      />

      {/* Tabs chọn phân loại: Đang thực hiện / Lịch sử */}
      <View className="px-4 pt-3">
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          trackClassName="bg-line"
          items={[
            { key: 'ACTIVE', label: 'Đang giao', icon: 'bicycle', count: activeItems.length },
            { key: 'COMPLETED', label: 'Lịch sử', icon: 'time-outline', count: finishedItems.length },
          ]}
        />
      </View>

      {/* Danh sách đơn */}
      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center p-6">
          <LoadingSpinner message="Đang tải danh sách chuyến giao..." />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) =>
            row.kind === 'day'
              ? renderDayHeader(row)
              : activeTab === 'ACTIVE'
                ? renderActiveItem(row.order)
                : renderFinishedItem(row.order)
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 112, // khớp TAB_BAR_CLEARANCE (pb-28) của thanh tab nổi
            flexGrow: rows.length === 0 ? 1 : undefined,
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
            <EmptyState
              icon={activeTab === 'ACTIVE' ? 'bicycle-outline' : 'checkmark-done-circle-outline'}
              title={
                activeTab === 'ACTIVE'
                  ? 'Không có chuyến nào đang giao'
                  : 'Chưa có lịch sử chuyến giao'
              }
              message={
                activeTab === 'ACTIVE'
                  ? 'Hãy vào tab Tìm đơn để nhận thêm đơn mới!'
                  : 'Các chuyến đã giao, đã huỷ hoặc giao không thành công sẽ hiển thị tại đây.'
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
    </View>
  );
};
