import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapsApi } from '../../api/maps';
import { AppMapView, AppMapViewHandle, MapMarkerItem, MapRoute } from '../../components/common/AppMapView';
import { Money, RoundAction } from '../../components/modules/partner/PartnerKit';
import {
  AppImage,
  Button,
  cn,
  ConfirmDialog,
  Icon,
  IconButton,
  LoadingSpinner,
  Text,
} from '../../components/ui';
import { useSocket } from '../../hooks/useSocket';
import { useCancelOrder, useOrderDetail } from '../../services/useOrders';
import { OrderItem } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { CUSTOMER_STEPS, customerHeadline, customerStepIndex, etaText } from '../../utils/customerOrderProgress';
import { formatVND } from '../../utils/format';
import { formatOrderEndReason } from '../../utils/orderStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderTracking'>;

// Đường đi kiểu Google Maps
const ROUTE_COLOR = '#1A73E8';
const ROUTE_OUTLINE = '#1557B0';

/** "Tô đặc biệt · Trứng chần · Cay vừa" */
const optionsText = (m: OrderItem) =>
  [m.options?.size?.name, m.options?.toppings?.map((t) => t.name).join(', '), m.options?.level]
    .filter((x) => !!x)
    .join(' · ');

export const OrderTrackingScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId } = route.params;
  const { data: order, isLoading, refetch } = useOrderDetail(orderId);
  const cancelMutation = useCancelOrder();
  const { socket, joinOrder, leaveOrder } = useSocket();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<AppMapViewHandle>(null);

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeLine, setRouteLine] = useState<{ coordinates: { latitude: number; longitude: number }[]; estimate: boolean } | null>(
    null,
  );
  const [confirmCancel, setConfirmCancel] = useState(false);

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
  }, [orderId, socket, joinOrder, leaveOrder]);

  // Đường đi theo đường phố từ quán tới địa chỉ giao (tải một lần cho mỗi đơn)
  const rLat = order?.restaurant.latitude;
  const rLng = order?.restaurant.longitude;
  const dLat = order?.deliveryLat;
  const dLng = order?.deliveryLng;
  useEffect(() => {
    if (rLat === undefined || rLng === undefined || dLat === undefined || dLng === undefined) return;
    let active = true;
    mapsApi
      .getRoute(rLat, rLng, dLat, dLng)
      .then((res) => {
        if (active) setRouteLine({ coordinates: res.coordinates, estimate: res.source === 'ESTIMATED' });
      })
      .catch(() => {
        if (active) {
          setRouteLine({
            coordinates: [
              { latitude: rLat, longitude: rLng },
              { latitude: dLat, longitude: dLng },
            ],
            estimate: true,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [rLat, rLng, dLat, dLng]);

  const handleCancel = async () => {
    setConfirmCancel(false);
    try {
      await cancelMutation.mutateAsync(orderId);
      refetch();
    } catch (err: any) {
      Alert.alert('Không thể hủy đơn', err.response?.data?.message || 'Quán đã tiếp nhận đơn.');
    }
  };

  const callPhone = (phone?: string | null, missing = 'Số điện thoại hiện không khả dụng.') => {
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('Thông báo', missing);
  };

  const openChat = (channel: 'CUSTOMER_DRIVER' | 'CUSTOMER_RESTAURANT') =>
    order &&
    navigation.navigate('Chat', {
      orderId: order.id,
      channel,
      recipientName:
        channel === 'CUSTOMER_DRIVER' ? order.driver?.fullName || 'Tài xế' : order.restaurant.name,
      recipientRole: channel === 'CUSTOMER_DRIVER' ? 'Tài xế giao hàng' : 'Quán ăn',
    });

  if (isLoading || !order) {
    return <LoadingSpinner message="Đang tải dữ liệu đơn hàng..." />;
  }

  const isCancelled = order.status === 'CANCELLED';
  const isFailed = order.status === 'DELIVERY_FAILED';
  const isTerminated = isCancelled || isFailed;
  const isDelivered = order.status === 'DELIVERED';
  const endReasonText = formatOrderEndReason(order);
  const step = customerStepIndex(order.status);
  const headline = customerHeadline(order.status);
  const mapHeight = Math.round(windowHeight * 0.4);

  const effectiveDriverLocation =
    driverLocation ??
    (order.driverLocation &&
    typeof order.driverLocation.lat === 'number' &&
    typeof order.driverLocation.lng === 'number'
      ? { lat: order.driverLocation.lat, lng: order.driverLocation.lng }
      : null);

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
    ...(effectiveDriverLocation && !isTerminated && !isDelivered
      ? [
          {
            id: 'driver',
            type: 'driver' as const,
            latitude: effectiveDriverLocation.lat,
            longitude: effectiveDriverLocation.lng,
            title: order.driver?.fullName || 'Tài xế',
            description: 'Đang di chuyển',
          },
        ]
      : []),
  ];

  const routes: MapRoute[] =
    routeLine && !isTerminated
      ? [
          {
            id: 'restaurant-customer',
            coordinates: routeLine.coordinates,
            color: ROUTE_COLOR,
            outlineColor: ROUTE_OUTLINE,
            width: 5,
            dashed: routeLine.estimate,
          },
        ]
      : [];

  const driver = order.driver;
  const vehicleText = driver
    ? (driver.driverProfile?.vehicleType || driver.vehicleType) === 'BICYCLE'
      ? 'Xe đạp'
      : [
          driver.driverProfile?.vehicleBrand || driver.vehicleBrand,
          driver.driverProfile?.vehicleModel || driver.vehicleModel,
        ]
          .filter(Boolean)
          .join(' ') || 'Tài xế đối tác'
    : '';
  const plate = driver?.driverProfile?.licensePlate || driver?.licensePlate;

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* BẢN ĐỒ: quán, nhà, tài xế và đường đi */}
      <View style={{ height: mapHeight }}>
        <AppMapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: (order.restaurant.latitude + order.deliveryLat) / 2,
            longitude: (order.restaurant.longitude + order.deliveryLng) / 2,
            latitudeDelta: Math.max(Math.abs(order.restaurant.latitude - order.deliveryLat) * 1.8, 0.02),
            longitudeDelta: Math.max(Math.abs(order.restaurant.longitude - order.deliveryLng) * 1.8, 0.02),
          }}
          markers={markers}
          routes={routes}
          autoFit="once"
          edgePadding={{ top: insets.top + 70, right: 56, bottom: 60, left: 56 }}
        />

        <View className="absolute left-3 right-3 flex-row justify-between" style={{ top: insets.top + 8 }} pointerEvents="box-none">
          <IconButton icon="arrow-back" variant="surface" accessibilityLabel="Quay lại" onPress={() => navigation.goBack()} />
          <IconButton
            icon="help-circle-outline"
            variant="surface"
            accessibilityLabel="Trợ giúp đơn hàng"
            onPress={() =>
              Alert.alert('Trợ giúp đơn hàng', 'Nếu cần hỗ trợ gấp về đơn hàng, vui lòng liên hệ hotline CSKH: 1900 6868.')
            }
          />
        </View>
        <View className="absolute right-3" style={{ bottom: 36 }}>
          <IconButton
            icon="locate"
            variant="surface"
            accessibilityLabel="Canh lại bản đồ"
            onPress={() => mapRef.current?.fitAll()}
          />
        </View>
      </View>

      <View className="flex-1 overflow-hidden rounded-t-3xl bg-canvas-subtle" style={{ marginTop: -24 }}>
        <ScrollView
          contentContainerClassName="gap-3 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TRẠNG THÁI */}
          {isTerminated ? (
            <View className="gap-2 rounded-2xl border border-danger/20 bg-danger-soft p-4">
              <View className="flex-row items-center gap-2.5">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                  <Icon name={headline.icon} size="lg" tone="danger" />
                </View>
                <Text variant="headline" weight="bold" tone="danger" className="flex-1">
                  {headline.title}
                </Text>
              </View>
              <Text variant="body" weight="regular" tone="secondary">
                {endReasonText
                  ? `Lý do: ${endReasonText}`
                  : 'Đơn hàng này đã bị hủy và không còn được giao. Bạn có thể đặt lại món từ nhà hàng.'}
              </Text>
            </View>
          ) : (
            <View className="gap-4 rounded-2xl bg-surface p-4 shadow-card">
              <View className="flex-row items-center gap-3">
                <View
                  className={cn(
                    'h-12 w-12 items-center justify-center rounded-2xl',
                    isDelivered ? 'bg-success-soft' : 'bg-brand-50',
                  )}
                >
                  <Icon name={headline.icon} size="lg" tone={isDelivered ? 'success' : 'brand'} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="headline" weight="bold">
                    {headline.title}
                  </Text>
                  <Text variant="caption" weight="regular" tone="secondary">
                    {isDelivered ? headline.subtitle : `Dự kiến giao ${etaText(order)} · ${order.distanceKm} km`}
                  </Text>
                </View>
              </View>

              {/* 4 bước (cùng bước với danh sách đơn) */}
              <View className="flex-row">
                {CUSTOMER_STEPS.map((st, idx) => {
                  const isDone = idx < step || (isDelivered && idx === step);
                  const isCurrent = idx === step && !isDelivered;
                  const reached = isDone || isCurrent;
                  return (
                    <View key={st.label} className="flex-1 items-center">
                      <View className="w-full items-center">
                        {idx > 0 && (
                          <View className={cn('absolute left-0 right-1/2 top-[15px] h-0.5', reached ? 'bg-brand-500' : 'bg-line')} />
                        )}
                        {idx < CUSTOMER_STEPS.length - 1 && (
                          <View
                            className={cn('absolute left-1/2 right-0 top-[15px] h-0.5', idx < step ? 'bg-brand-500' : 'bg-line')}
                          />
                        )}
                        <View
                          className={cn(
                            'h-8 w-8 items-center justify-center rounded-full border-2',
                            reached ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
                            isCurrent ? 'shadow-glow' : 'shadow-none',
                          )}
                        >
                          <Icon name={isDone ? 'checkmark' : st.icon} size={15} tone={reached ? 'inverse' : 'muted'} />
                        </View>
                      </View>
                      <Text
                        variant="micro"
                        weight={isCurrent ? 'bold' : 'medium'}
                        tone={isCurrent ? 'brand' : isDone ? 'default' : 'muted'}
                        className="mt-1.5 text-center"
                        numberOfLines={1}
                      >
                        {st.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* TÀI XẾ */}
          {driver ? (
            <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-500">
                <Text variant="headline" weight="bold" tone="inverse">
                  {driver.fullName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body-lg" weight="bold" numberOfLines={1}>
                  {driver.fullName}
                </Text>
                <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
                  {vehicleText}
                </Text>
                {!!plate && (
                  <View className="mt-0.5 self-start rounded-md border border-ink px-1.5">
                    <Text variant="caption" weight="bold" className="tracking-wider">
                      {plate}
                    </Text>
                  </View>
                )}
              </View>
              {!isTerminated && !isDelivered && (
                <View className="flex-row gap-2">
                  <RoundAction icon="chatbubble-ellipses" label="Nhắn tin cho tài xế" onPress={() => openChat('CUSTOMER_DRIVER')} />
                  {!!driver.phone && (
                    <RoundAction
                      icon="call"
                      label="Gọi cho tài xế"
                      onPress={() => callPhone(driver.phone, 'Số điện thoại tài xế hiện không khả dụng.')}
                    />
                  )}
                </View>
              )}
            </View>
          ) : !isTerminated && !isDelivered ? (
            <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                <Icon name="search" size="md" tone="brand" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="semibold">
                  Đang tìm tài xế gần quán...
                </Text>
                <Text variant="caption" weight="regular" tone="secondary">
                  Hệ thống đang tự động điều phối tài xế phù hợp cho đơn của bạn.
                </Text>
              </View>
            </View>
          ) : null}

          {/* ĐÁNH GIÁ */}
          {isDelivered && !order.review && order.canReview !== false && (
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-85"
              onPress={() =>
                navigation.navigate('Rating', {
                  orderId,
                  restaurantName: order.restaurant?.name,
                  hasDriver: Boolean(order.driverId),
                })
              }
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-warning-soft">
                <Icon name="star" size="md" tone="rating" />
              </View>
              <View className="flex-1">
                <Text variant="body" weight="bold">
                  Đánh giá quán & tài xế
                </Text>
                <Text variant="caption" weight="regular" tone="secondary">
                  Giúp quán phục vụ bạn tốt hơn
                </Text>
              </View>
              <Icon name="chevron-forward" size="sm" tone="muted" />
            </Pressable>
          )}

          {!!order.review && (
            <View className="gap-2 rounded-2xl bg-surface p-4 shadow-card">
              <View className="flex-row items-center justify-between">
                <Text variant="body" weight="bold">
                  Đánh giá của bạn
                </Text>
                <View className="flex-row items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5">
                  <Icon name="star" size={13} tone="rating" />
                  <Text variant="caption" weight="bold" className="text-warning-strong">
                    {order.review.rating}/5
                    {order.review.driverRating ? ` · Tài xế ${order.review.driverRating}/5` : ''}
                  </Text>
                </View>
              </View>
              {!!order.review.comment && (
                <Text variant="body" weight="regular">
                  {order.review.comment}
                </Text>
              )}
              {!!order.review.ownerReply && (
                <View className="rounded-xl bg-canvas-subtle p-3">
                  <Text variant="caption" weight="bold" tone="brand">
                    Phản hồi từ nhà hàng
                  </Text>
                  <Text variant="caption" weight="regular" tone="secondary" className="mt-0.5">
                    {order.review.ownerReply}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* GIAO ĐẾN */}
          <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
            <Text variant="body" weight="bold">
              Giao đến
            </Text>
            <View className="flex-row items-start gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <Icon name="location" size="sm" tone="brand" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="semibold">
                  {order.customer?.fullName || 'Khách hàng'}
                  {order.customer?.phone ? (
                    <Text variant="body" weight="regular" tone="secondary">
                      {' '}
                      · {order.customer.phone}
                    </Text>
                  ) : null}
                </Text>
                <Text variant="caption" weight="regular" tone="secondary">
                  {order.deliveryAddress}
                </Text>
              </View>
            </View>
            {!!order.note && (
              <View className="flex-row items-start gap-2 rounded-xl bg-warning-soft px-3 py-2.5">
                <Icon name="document-text-outline" size="sm" tone="warning" />
                <Text variant="caption" className="flex-1 text-warning-strong">
                  {order.note}
                </Text>
              </View>
            )}
          </View>

          {/* CHI TIẾT ĐƠN */}
          <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
            <Text variant="body" weight="bold">
              Chi tiết đơn
            </Text>

            {/* Quán */}
            <View className="flex-row items-center gap-3">
              <AppImage uri={order.restaurant.imageUrl} className="h-11 w-11 rounded-xl" fallbackIcon="storefront-outline" />
              <View className="flex-1">
                <Text variant="body" weight="semibold" numberOfLines={1}>
                  {order.restaurant.name}
                </Text>
                {!!order.restaurant.address && (
                  <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
                    {order.restaurant.address}
                  </Text>
                )}
              </View>
              {!!order.restaurant.phone && (
                <RoundAction
                  icon="call"
                  tone="danger"
                  label="Gọi cho nhà hàng"
                  onPress={() => callPhone(order.restaurant.phone, 'Nhà hàng chưa cập nhật số điện thoại.')}
                />
              )}
              <RoundAction
                icon="chatbubble-ellipses"
                tone="danger"
                label="Nhắn tin với quán"
                onPress={() => openChat('CUSTOMER_RESTAURANT')}
              />
            </View>

            <View className="h-px bg-line-subtle" />

            {/* Món */}
            <View className="gap-2.5">
              {order.items.map((item) => {
                const opts = optionsText(item);
                return (
                  <View key={item.id} className="flex-row items-start gap-2.5">
                    <View className="h-6 min-w-[28px] items-center justify-center rounded-md bg-brand-50 px-1">
                      <Text variant="caption" weight="bold" tone="brand">
                        {item.quantity}×
                      </Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text variant="body" weight="medium">
                        {item.name}
                      </Text>
                      {!!opts && (
                        <Text variant="caption" weight="regular" tone="secondary">
                          {opts}
                        </Text>
                      )}
                      {!!item.note && (
                        <Text variant="caption" weight="regular" tone="muted">
                          Ghi chú: {item.note}
                        </Text>
                      )}
                    </View>
                    <Text variant="body" tone="secondary">
                      {formatVND(item.lineTotal ?? item.unitPrice * item.quantity)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View className="h-px bg-line-subtle" />

            <View className="gap-1.5">
              <SummaryRow label="Tạm tính" value={formatVND(order.subtotal)} />
              <SummaryRow label={`Phí giao hàng (${order.distanceKm} km)`} value={formatVND(order.deliveryFee)} />
              <SummaryRow
                label="Thanh toán"
                value={
                  order.paymentMethod === 'VNPAY'
                    ? order.paymentStatus === 'PAID'
                      ? 'VNPay · đã thanh toán'
                      : 'VNPay'
                    : 'Tiền mặt khi nhận hàng'
                }
              />
            </View>

            <View className="flex-row items-center justify-between rounded-xl bg-canvas-subtle px-3 py-3">
              <Text variant="body-lg" weight="bold">
                Tổng cộng
              </Text>
              <Money amount={order.total} variant="title" tone="brand" />
            </View>
          </View>

          {/* Hủy đơn khi quán chưa nhận */}
          {order.status === 'PENDING' && (
            <Button
              label="Hủy đơn hàng"
              variant="dangerSoft"
              size="lg"
              leftIcon="close-circle-outline"
              onPress={() => setConfirmCancel(true)}
              loading={cancelMutation.isPending}
            />
          )}
        </ScrollView>
      </View>

      <ConfirmDialog
        visible={confirmCancel}
        title="Hủy đơn hàng?"
        message="Bạn có chắc chắn muốn hủy đơn hàng này không?"
        confirmLabel="Hủy đơn"
        cancelLabel="Không"
        destructive
        loading={cancelMutation.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
      />
    </View>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View className="flex-row items-center justify-between gap-3">
    <Text variant="body" weight="regular" tone="secondary">
      {label}
    </Text>
    <Text variant="body" weight="medium" numberOfLines={1} className="flex-shrink text-right">
      {value}
    </Text>
  </View>
);
