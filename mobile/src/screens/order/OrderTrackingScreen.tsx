import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppMapView, MapMarkerItem } from '../../components/common/AppMapView';
import { Button, cn, Icon, LoadingSpinner, Text, TopBar } from '../../components/ui';
import { useSocket } from '../../hooks/useSocket';
import { useCancelOrder, useOrderDetail } from '../../services/useOrders';
import { OrderStatus } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { estimateDeliveryTime } from '../../utils/fee';
import { formatVND } from '../../utils/format';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderTracking'>;

const TRACKING_STEPS = [
  { key: 'PENDING', label: 'Chờ duyệt', icon: 'time-outline' as const },
  { key: 'CONFIRMED', label: 'Đã nhận', icon: 'checkmark-circle-outline' as const },
  { key: 'PREPARING', label: 'Chuẩn bị', icon: 'restaurant-outline' as const },
  { key: 'PICKED_UP', label: 'Đang giao', icon: 'bicycle-outline' as const },
  { key: 'DELIVERED', label: 'Đã giao', icon: 'home-outline' as const },
];

const getStepIndex = (status: OrderStatus) => {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'CONFIRMED':
      return 1;
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
      return 2;
    case 'PICKED_UP':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
};

export const OrderTrackingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { data: order, isLoading, refetch } = useOrderDetail(orderId);
  const cancelMutation = useCancelOrder();
  const { socket, joinOrder, leaveOrder } = useSocket();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    joinOrder(orderId);

    const handleDriverLoc = (data: { orderId: string; lat: number; lng: number }) => {
      if (data.orderId === orderId) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    };

    socket?.on('driver:location', handleDriverLoc);

    return () => {
      leaveOrder(orderId);
      socket?.off('driver:location', handleDriverLoc);
    };
  }, [orderId, socket]);

  const handleCancel = () => {
    Alert.alert('Xác nhận hủy đơn', 'Bạn có chắc chắn muốn hủy đơn hàng này không?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đơn',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelMutation.mutateAsync(orderId);
            refetch();
          } catch (err: any) {
            Alert.alert('Không thể hủy đơn', err.response?.data?.message || 'Quán đã tiếp nhận đơn.');
          }
        },
      },
    ]);
  };

  const handleOpenCall = () => {
    const phone = order?.driver?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Thông báo', 'Tài xế chưa cập nhật số điện thoại.');
    }
  };

  const handleOpenRating = () => {
    navigation.navigate('Rating', {
      orderId,
      driverName: order?.driver?.fullName || 'Tài xế',
      restaurantName: order?.restaurant?.name,
    });
  };

  if (isLoading || !order) {
    return <LoadingSpinner message="Đang tải dữ liệu đơn hàng..." />;
  }

  const isCancelled = order.status === 'CANCELLED';
  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const currentStep = getStepIndex(order.status);
  const eta = estimateDeliveryTime(order.distanceKm);

  const markers: MapMarkerItem[] = [
    {
      id: 'restaurant',
      type: 'restaurant',
      latitude: order.restaurant.latitude,
      longitude: order.restaurant.longitude,
      title: order.restaurant.name,
      description: 'Điểm lấy món',
    },
    {
      id: 'delivery',
      type: 'delivery',
      latitude: order.deliveryLat,
      longitude: order.deliveryLng,
      title: 'Điểm giao hàng',
      description: order.deliveryAddress,
    },
    ...(driverLocation
      ? [
          {
            id: 'driver',
            type: 'driver' as const,
            latitude: driverLocation.lat,
            longitude: driverLocation.lng,
            title: order.driver?.fullName || 'Tài xế',
            description: 'Đang di chuyển',
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-canvas-subtle">
      <TopBar
        title="Theo dõi đơn hàng"
        onLeadingPress={() => navigation.goBack()}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Trợ giúp đơn hàng"
            onPress={() =>
              Alert.alert('Trợ giúp đơn hàng', 'Nếu cần hỗ trợ gấp về đơn hàng, vui lòng liên hệ hotline CSKH: 1900 6868.')
            }
            className="p-1 active:opacity-70"
          >
            <Icon name="help-circle-outline" size="md" tone="secondary" />
          </Pressable>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerClassName="p-4 gap-4 pb-12" showsVerticalScrollIndicator={false}>
        {/* Bản đồ định vị trực quan bao quát quán và khách */}
        <View className="h-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <AppMapView
            style={{ width: '100%', height: '100%' }}
            initialRegion={{
              latitude: (order.restaurant.latitude + order.deliveryLat) / 2,
              longitude: (order.restaurant.longitude + order.deliveryLng) / 2,
              latitudeDelta: Math.max(Math.abs(order.restaurant.latitude - order.deliveryLat) * 1.8, 0.02),
              longitudeDelta: Math.max(Math.abs(order.restaurant.longitude - order.deliveryLng) * 1.8, 0.02),
            }}
            markers={markers}
          />
        </View>

        {/* Thanh trạng thái & tiến trình */}
        {isCancelled ? (
          <View className="gap-2 rounded-2xl border border-danger-soft bg-danger-soft/30 p-4">
            <View className="flex-row items-center gap-2">
              <Icon name="close-circle" size="md" tone="danger" />
              <Text variant="headline" weight="bold" tone="danger">
                Đơn hàng đã hủy
              </Text>
            </View>
            <Text variant="body" tone="secondary">
              Đơn hàng này đã bị hủy và không còn được giao. Bạn có thể đặt lại món từ nhà hàng.
            </Text>
          </View>
        ) : (
          <View className="gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <View className="flex-row items-center justify-between">
              <View className="gap-0.5">
                <Text variant="headline" weight="bold">
                  {statusConfig.label}
                </Text>
                <Text variant="caption" tone="secondary">
                  Dự kiến giao: {eta} ({order.distanceKm} km)
                </Text>
              </View>
              <View className="rounded-full bg-brand-50 px-3 py-1">
                <Text variant="caption" weight="bold" tone="brand">
                  {order.status === 'PENDING'
                    ? 'Chờ duyệt'
                    : order.status === 'CONFIRMED'
                    ? 'Đã nhận'
                    : order.status === 'PREPARING'
                    ? 'Đang làm món'
                    : order.status === 'PICKED_UP'
                    ? 'Đang giao'
                    : 'Hoàn thành'}
                </Text>
              </View>
            </View>

            {/* Stepper có vạch nối trực quan */}
            <View className="pt-1">
              <View className="flex-row items-center justify-between">
                {TRACKING_STEPS.map((step, idx) => {
                  const isDone = idx < currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <View key={step.key} className="flex-1 items-center">
                      <View className="relative w-full items-center">
                        {/* Đường nối giữa các bước */}
                        {idx > 0 && (
                          <View
                            className={cn(
                              'absolute left-0 right-1/2 top-4 h-0.5',
                              isDone || isCurrent ? 'bg-brand-500' : 'bg-line',
                            )}
                          />
                        )}
                        {idx < TRACKING_STEPS.length - 1 && (
                          <View
                            className={cn(
                              'absolute left-1/2 right-0 top-4 h-0.5',
                              isDone ? 'bg-brand-500' : 'bg-line',
                            )}
                          />
                        )}

                        {/* Nút tròn bước */}
                        <View
                          className={cn(
                            'h-8 w-8 items-center justify-center rounded-full border-2',
                            isCurrent
                              ? 'border-brand-500 bg-brand-500 shadow-glow'
                              : isDone
                              ? 'border-brand-500 bg-brand-500'
                              : 'border-line bg-surface',
                          )}
                        >
                          <Icon
                            name={isDone ? 'checkmark' : step.icon}
                            size="xs"
                            tone={isDone || isCurrent ? 'inverse' : 'muted'}
                          />
                        </View>
                      </View>
                      <Text
                        variant="caption"
                        weight={isCurrent ? 'bold' : isDone ? 'medium' : 'regular'}
                        tone={isCurrent ? 'brand' : isDone ? 'default' : 'muted'}
                        className="mt-1.5 text-center"
                        numberOfLines={1}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Thẻ Tài xế (nếu có tài xế phụ trách) */}
        {order.driver ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-500 shadow-card">
              <Text variant="headline" weight="bold" tone="inverse">
                {order.driver.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View className="flex-1 gap-0.5">
              <Text variant="body-lg" weight="bold">
                {order.driver.fullName}
              </Text>
              <Text variant="caption" tone="secondary">
                {order.driver.driverProfile?.vehicleType === 'BICYCLE'
                  ? 'Giao bằng Xe đạp'
                  : order.driver.driverProfile?.vehicleBrand
                  ? `${order.driver.driverProfile.vehicleBrand} ${order.driver.driverProfile.vehicleModel || ''}`
                  : 'Tài xế đối tác'}
                {order.driver.driverProfile?.licensePlate
                  ? ` • Biển số: ${order.driver.driverProfile.licensePlate}`
                  : ''}
              </Text>
              {!!order.driver.phone && (
                <Text variant="caption" weight="medium" tone="brand">
                  {order.driver.phone}
                </Text>
              )}
            </View>

            {!!order.driver.phone && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gọi cho tài xế"
                className="h-11 w-11 items-center justify-center rounded-full bg-brand-50 active:bg-brand-100"
                onPress={handleOpenCall}
              >
                <Icon name="call" size="md" tone="brand" />
              </Pressable>
            )}
          </View>
        ) : !isCancelled && order.status !== 'DELIVERED' ? (
          <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Icon name="search" size="md" tone="brand" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="semibold">
                Đang tìm tài xế gần quán...
              </Text>
              <Text variant="caption" tone="secondary">
                Hệ thống đang tự động điều phối tài xế phù hợp cho đơn của bạn.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Nút đánh giá dịch vụ nếu đơn đã hoàn thành */}
        {order.status === 'DELIVERED' && (
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-2xl border border-warning-soft bg-warning-soft/20 p-4 shadow-card active:opacity-80"
            onPress={handleOpenRating}
          >
            <View className="flex-row items-center gap-2.5">
              <Icon name="star" size="md" tone="rating" />
              <Text variant="body" weight="bold" tone="default">
                Đánh giá tài xế & Món ăn
              </Text>
            </View>
            <Icon name="chevron-forward" size="sm" tone="secondary" />
          </Pressable>
        )}

        {/* Địa chỉ giao hàng */}
        <View className="gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
            Địa chỉ nhận hàng
          </Text>
          <View className="flex-row items-start gap-2.5">
            <View className="mt-0.5">
              <Icon name="location-sharp" size="md" tone="brand" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body" weight="medium">
                {order.deliveryAddress}
              </Text>
              {!!order.note && (
                <Text variant="caption" tone="secondary">
                  Ghi chú: {order.note}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Chi tiết đơn hàng */}
        <View className="gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
            Chi tiết đơn hàng · {order.restaurant.name}
          </Text>

          <View className="gap-2">
            {order.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between">
                <Text variant="body" className="flex-1 pr-2" numberOfLines={2}>
                  {item.quantity}× {item.name}
                </Text>
                <Text variant="body" weight="medium">
                  {formatVND(item.lineTotal)}
                </Text>
              </View>
            ))}
          </View>

          <View className="h-[1px] bg-line-subtle" />

          <View className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text variant="body" tone="secondary">
                Tạm tính
              </Text>
              <Text variant="body">{formatVND(order.subtotal)}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="body" tone="secondary">
                Phí giao hàng ({order.distanceKm} km)
              </Text>
              <Text variant="body">{formatVND(order.deliveryFee)}</Text>
            </View>
          </View>

          <View className="h-[1px] bg-line-subtle" />

          <View className="flex-row items-center justify-between pt-0.5">
            <Text variant="headline" weight="bold">
              Tổng cộng
            </Text>
            <Text variant="headline" weight="bold" tone="brand">
              {formatVND(order.total)}
            </Text>
          </View>
        </View>

        {/* Nút hủy đơn hàng khi đơn còn ở trạng thái PENDING */}
        {order.status === 'PENDING' && (
          <Button
            label="Hủy đơn hàng"
            variant="danger"
            size="lg"
            leftIcon="close-circle-outline"
            onPress={handleCancel}
            loading={cancelMutation.isPending}
            className="mt-1"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
