import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mapsApi } from '../../api/maps';
import { ordersApi } from '../../api/orders';
import { AppMapView, MapMarkerItem } from '../../components/common/AppMapView';
import {
  Button,
  cn,
  ConfirmDialog,
  Icon,
  OrderStatusBadge,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../hooks/useSocket';
import { useOrderDetail } from '../../services/useOrders';
import { OrderDetail, OrderStatus } from '../../types/api';
import { formatVND } from '../../utils/format';
import { haversineKm } from '../../utils/geo';

interface Props {
  navigation: any;
  route: {
    params: {
      orderId: string;
    };
  };
}

const STEP_LABELS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'CONFIRMED', label: 'Đã nhận chuyến', desc: 'Tài xế đã tiếp nhận đơn hàng' },
  { status: 'PREPARING', label: 'Quán đang làm món', desc: 'Đang chờ bếp hoàn tất chế biến' },
  { status: 'READY_FOR_PICKUP', label: 'Sẵn sàng lấy món', desc: 'Món ăn đã sẵn sàng tại quầy' },
  { status: 'PICKED_UP', label: 'Đang đi giao', desc: 'Tài xế đang trên đường đến khách' },
  { status: 'DELIVERED', label: 'Đã giao thành công', desc: 'Đơn hàng hoàn tất viên mãn' },
];

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

export const DriverDeliveryDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const { data: order, isLoading, refetch } = useOrderDetail(orderId);
  const queryClient = useQueryClient();
  const { coords: driverCoords } = useLocation();
  const { socket, joinOrder, leaveOrder } = useSocket();
  const toast = useToast();

  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMinutes: number;
    isEstimate: boolean;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: '',
    onConfirm: async () => {},
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Lắng nghe socket cập nhật trạng thái đơn
  useEffect(() => {
    if (!orderId) return;
    joinOrder(orderId);

    const onStatusUpdate = (updatedOrder: OrderDetail) => {
      if (updatedOrder.id === orderId) {
        refetch();
        if (updatedOrder.status === 'READY_FOR_PICKUP') {
          toast('Món đã sẵn sàng! Quán đã làm xong, hãy đến lấy ngay nhé.', 'success');
        } else if (updatedOrder.status === 'CANCELLED') {
          toast('Đơn hàng đã bị huỷ bởi quán hoặc hệ thống.', 'error');
        }
      }
    };

    const onPaymentUpdate = (updatedOrder: OrderDetail) => {
      if (updatedOrder.id === orderId) {
        refetch();
      }
    };

    socket?.on('order:status', onStatusUpdate);
    socket?.on('order:payment', onPaymentUpdate);

    return () => {
      leaveOrder(orderId);
      socket?.off('order:status', onStatusUpdate);
      socket?.off('order:payment', onPaymentUpdate);
    };
  }, [orderId, socket, joinOrder, leaveOrder, refetch, toast]);

  // Tính khoảng cách & thời gian ước tính giữa Quán và Khách
  useEffect(() => {
    if (!order) return;
    let active = true;

    async function calculateRoute() {
      if (!order) return;
      try {
        const res = await mapsApi.getDistance(
          order.restaurant.latitude,
          order.restaurant.longitude,
          order.deliveryLat,
          order.deliveryLng,
        );
        if (active) {
          setRouteInfo({
            distanceKm: res.distanceKm,
            durationMinutes: res.durationMinutes,
            isEstimate: false,
          });
        }
      } catch {
        if (active) {
          const dist = haversineKm(
            { latitude: order.restaurant.latitude, longitude: order.restaurant.longitude },
            { latitude: order.deliveryLat, longitude: order.deliveryLng },
          );
          const duration = Math.max(5, Math.round((dist / 25) * 60 + 5));
          setRouteInfo({
            distanceKm: dist,
            durationMinutes: duration,
            isEstimate: true,
          });
        }
      }
    }

    calculateRoute();
    return () => {
      active = false;
    };
  }, [order]);

  // Marker cho bản đồ
  const markers: MapMarkerItem[] = useMemo(() => {
    if (!order) return [];
    const list: MapMarkerItem[] = [
      {
        id: 'restaurant',
        latitude: order.restaurant.latitude,
        longitude: order.restaurant.longitude,
        title: order.restaurant.name,
        description: `Điểm lấy món: ${order.restaurant.address}`,
        type: 'restaurant',
        pinColor: '#EF4444',
      },
      {
        id: 'delivery',
        latitude: order.deliveryLat,
        longitude: order.deliveryLng,
        title: `Khách hàng: ${order.customer.fullName}`,
        description: `Điểm giao: ${order.deliveryAddress}`,
        type: 'delivery',
        pinColor: '#1EB9CE',
      },
    ];

    if (driverCoords && driverCoords.latitude && driverCoords.longitude) {
      list.push({
        id: 'driver',
        latitude: driverCoords.latitude,
        longitude: driverCoords.longitude,
        title: 'Vị trí của bạn',
        type: 'driver',
        pinColor: '#10B981',
      });
    }

    return list;
  }, [order, driverCoords]);

  const mapRegion = useMemo(() => {
    if (!order) {
      return {
        latitude: 10.7769,
        longitude: 106.7009,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: (order.restaurant.latitude + order.deliveryLat) / 2,
      longitude: (order.restaurant.longitude + order.deliveryLng) / 2,
      latitudeDelta: Math.max(Math.abs(order.restaurant.latitude - order.deliveryLat) * 1.6, 0.02),
      longitudeDelta: Math.max(Math.abs(order.restaurant.longitude - order.deliveryLng) * 1.6, 0.02),
    };
  }, [order]);

  // Mở ứng dụng bản đồ chỉ đường
  const handleOpenNavigation = () => {
    if (!order) return;
    const isHeadingToCustomer = order.status === 'PICKED_UP';
    const destLat = isHeadingToCustomer ? order.deliveryLat : order.restaurant.latitude;
    const destLng = isHeadingToCustomer ? order.deliveryLng : order.restaurant.longitude;
    const destLabel = isHeadingToCustomer ? order.deliveryAddress : order.restaurant.name;

    const scheme = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(destLabel)}@${destLat},${destLng}`,
      android: `geo:0,0?q=${destLat},${destLng}(${encodeURIComponent(destLabel)})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`,
    });

    const url = scheme || `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`);
    });
  };

  const handleCall = (phone?: string | null) => {
    if (!phone) {
      toast('Khách hàng chưa cung cấp số điện thoại liên lạc.', 'default');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleOpenChat = () => {
    if (!order) return;
    navigation.navigate('Chat', {
      orderId: order.id,
      recipientName: order.customer.fullName,
      recipientRole: 'CUSTOMER',
    });
  };

  // Xử lý xác nhận "Đã lấy món" -> Chuyển sang PICKED_UP
  const handleConfirmPickup = () => {
    if (!order) return;
    setConfirmDialog({
      visible: true,
      title: 'Xác nhận đã lấy món',
      message: `Bạn xác nhận đã kiểm tra đủ ${order.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      )} món từ quán "${order.restaurant.name}" và bắt đầu đi giao?`,
      confirmLabel: 'Đã nhận món & Bắt đầu giao',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          await ordersApi.updateStatus(order.id, 'PICKED_UP');
          await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          await refetch();
          toast('Đã nhận món! Di chuyển cẩn thận đến địa chỉ của khách nhé.', 'success');
        } catch (err: any) {
          toast(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật trạng thái.', 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
        }
      },
    });
  };

  // Xử lý xác nhận "Đã giao cho khách" -> Chuyển sang DELIVERED
  const handleConfirmDelivered = () => {
    if (!order) return;
    const isCod = order.paymentMethod === 'COD';
    const message = isCod
      ? `⚠️ ĐƠN THU TIỀN MẶT (COD)\n\nVui lòng xác nhận bạn ĐÃ THU ĐỦ ${formatVND(
          order.total,
        )} từ khách hàng ${order.customer.fullName} và đã bàn giao món thành công.`
      : `Khách hàng đã thanh toán trực tuyến qua thẻ/VNPay.\n\nBạn chỉ cần bàn giao món và KHÔNG THU THÊM TIỀN MẶT. Xác nhận hoàn tất?`;

    setConfirmDialog({
      visible: true,
      title: 'Hoàn tất chuyến giao',
      message,
      confirmLabel: isCod ? `Đã thu ${formatVND(order.total)} & Đã giao` : 'Xác nhận đã giao hàng',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          await ordersApi.updateStatus(order.id, 'DELIVERED');
          await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          await refetch();
          setShowSuccessModal(true);
        } catch (err: any) {
          toast(err.response?.data?.message || 'Có lỗi xảy ra khi hoàn tất đơn hàng.', 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmDialog((prev) => ({ ...prev, visible: false }));
        }
      },
    });
  };

  if (isLoading || !order) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-surface">
        <TopBar title="Chi tiết chuyến giao" onLeadingPress={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color="#1EB9CE" />
          <Text variant="body" tone="secondary" className="mt-4">
            Đang tải dữ liệu chuyến giao...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';
  const isCod = order.paymentMethod === 'COD';
  const isHeadingToCustomer = order.status === 'PICKED_UP';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <TopBar
        title={`Chuyến giao #${order.id.slice(0, 8).toUpperCase()}`}
        onLeadingPress={() => navigation.goBack()}
        trailing={
          <View className="pr-3">
            <OrderStatusBadge status={order.status} />
          </View>
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
        {/* NỬA TRÊN: BẢN ĐỒ LỘ TRÌNH CHUYẾN GIAO */}
        <View className="h-72 w-full overflow-hidden bg-surface shadow-card">
          <AppMapView initialRegion={mapRegion} markers={markers} style={{ flex: 1 }} />

          {/* Thanh nổi đè lên góc bản đồ: Nút mở chỉ đường Turn-by-Turn */}
          {!isCancelled && !isDelivered && (
            <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2 rounded-xl bg-surface/95 px-3 py-2 shadow-float backdrop-blur-md">
                <Icon
                  name={isHeadingToCustomer ? 'location' : 'storefront'}
                  size="sm"
                  tone="brand"
                />
                <View className="flex-1">
                  <Text variant="caption" weight="bold" numberOfLines={1}>
                    {isHeadingToCustomer ? 'Điểm đến: Khách hàng' : 'Điểm đến: Quán lấy món'}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {routeInfo
                      ? `${routeInfo.distanceKm} km • ~${routeInfo.durationMinutes} phút${
                          routeInfo.isEstimate ? ' (ước tính)' : ''
                        }`
                      : 'Đang ước tính lộ trình...'}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chỉ đường trên Google Maps hoặc Apple Maps"
                onPress={handleOpenNavigation}
                className="flex-row items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2.5 shadow-float active:bg-brand-600"
              >
                <Icon name="navigate" size="sm" tone="inverse" />
                <Text variant="caption" weight="bold" tone="inverse">
                  Chỉ đường
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* THÔNG BÁO NẾU ĐƠN BỊ HUỶ */}
        {isCancelled && (
          <View className="mx-4 mt-4 flex-row items-center gap-3 rounded-2xl border border-danger-soft bg-danger-soft/20 p-4">
            <Icon name="close-circle" size="lg" tone="danger" />
            <View className="flex-1">
              <Text variant="body" weight="bold" tone="danger">
                Đơn hàng này đã bị huỷ
              </Text>
              <Text variant="caption" tone="secondary">
                Quán hoặc khách đã huỷ đơn. Bạn không cần tiếp tục giao đơn này nữa.
              </Text>
            </View>
          </View>
        )}

        {/* TIẾN TRÌNH CÁC BƯỚC GIAO HÀNG */}
        <View className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <View className="mb-3 flex-row items-center justify-between">
            <Text variant="headline" weight="bold">
              Tiến trình chuyến giao
            </Text>
            <Text variant="caption" tone="secondary">
              Bước {Math.min(currentStep + 1, 5)}/5
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-1">
            {STEP_LABELS.map((step, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <View key={step.status} className="flex-1 items-center">
                  <View className="relative w-full items-center">
                    {idx > 0 && (
                      <View
                        className={cn(
                          'absolute left-0 right-1/2 top-3.5 h-0.5',
                          isDone || isCurrent ? 'bg-brand-500' : 'bg-line',
                        )}
                      />
                    )}
                    {idx < STEP_LABELS.length - 1 && (
                      <View
                        className={cn(
                          'absolute left-1/2 right-0 top-3.5 h-0.5',
                          isDone ? 'bg-brand-500' : 'bg-line',
                        )}
                      />
                    )}
                    <View
                      className={cn(
                        'h-7 w-7 items-center justify-center rounded-full border-2',
                        isCurrent
                          ? 'border-brand-500 bg-brand-500 shadow-glow'
                          : isDone
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-line bg-surface',
                      )}
                    >
                      <Ionicons
                        name={isDone ? 'checkmark' : 'ellipse'}
                        size={isDone ? 14 : 8}
                        color={isDone || isCurrent ? '#FFFFFF' : '#94A3B8'}
                      />
                    </View>
                  </View>
                  <Text
                    variant="caption"
                    weight={isCurrent ? 'bold' : 'regular'}
                    tone={isCurrent ? 'brand' : isDone ? 'default' : 'secondary'}
                    className="mt-1.5 text-center text-[10px]"
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* THÔNG TIN LỘ TRÌNH HAI ĐIỂM: QUÁN & KHÁCH */}
        <View className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <Text variant="headline" weight="bold" className="mb-3">
            Lộ trình giao hàng
          </Text>

          {/* Điểm 1: Quán lấy món */}
          <View className="flex-row items-start gap-3">
            <View className="items-center">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-danger-soft">
                <Ionicons name="storefront" size={16} color="#EF4444" />
              </View>
              <View className="my-1 h-7 w-0.5 border-l-2 border-dashed border-line" />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                ĐIỂM LẤY MÓN (QUÁN)
              </Text>
              <Text variant="body" weight="bold">
                {order.restaurant.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {order.restaurant.address}
              </Text>
            </View>
          </View>

          {/* Điểm 2: Khách nhận món */}
          <View className="flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="home" size={16} color="#1EB9CE" />
            </View>
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                ĐIỂM GIAO MÓN (KHÁCH HÀNG)
              </Text>
              <Text variant="body" weight="bold">
                {order.customer.fullName}
              </Text>
              <Text variant="caption" tone="secondary">
                {order.deliveryAddress}
              </Text>
              {!!order.note && (
                <View className="mt-1.5 rounded-lg bg-warning-soft/20 p-2">
                  <Text variant="caption" weight="medium" tone="warning">
                    Ghi chú của khách: {order.note}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Nút liên hệ với khách hàng */}
          <View className="mt-4 flex-row items-center gap-2 border-t border-line-subtle pt-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gọi cho khách hàng"
              onPress={() => handleCall(order.customer.phone)}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-50 py-2.5 active:bg-brand-100"
            >
              <Ionicons name="call" size={16} color="#1EB9CE" />
              <Text variant="caption" weight="bold" tone="brand">
                Gọi khách hàng
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nhắn tin với khách hàng"
              onPress={handleOpenChat}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface-subtle py-2.5 active:bg-line-subtle"
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#64748B" />
              <Text variant="caption" weight="bold" tone="secondary">
                Nhắn tin
              </Text>
            </Pressable>
          </View>
        </View>

        {/* THÔNG TIN THANH TOÁN & THU NHẬP */}
        <View className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <Text variant="headline" weight="bold" className="mb-3">
            Tài chính chuyến giao
          </Text>

          <View className="flex-row items-center justify-between border-b border-line-subtle pb-3">
            <View>
              <Text variant="caption" tone="secondary">
                THU NHẬP TÀI XẾ (CÔNG GIAO)
              </Text>
              <Text variant="headline" weight="bold" tone="brand">
                +{formatVND(order.deliveryFee)}
              </Text>
            </View>
            <View className="rounded-full bg-brand-50 px-3 py-1">
              <Text variant="caption" weight="bold" tone="brand">
                Cộng vào ví khi xong
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-1">
              <Text variant="caption" tone="secondary">
                TIỀN CẦN THU TỪ KHÁCH HÀNG
              </Text>
              {isCod ? (
                <Text variant="body-lg" weight="bold" tone="danger">
                  Thu tiền mặt: {formatVND(order.total)}
                </Text>
              ) : (
                <Text variant="body-lg" weight="bold" tone="success">
                  0 ₫ (Khách đã trả qua thẻ/VNPay)
                </Text>
              )}
            </View>
            <View
              className={cn(
                'rounded-lg px-2.5 py-1',
                isCod ? 'bg-danger-soft' : 'bg-success-soft',
              )}
            >
              <Text
                variant="caption"
                weight="bold"
                tone={isCod ? 'danger' : 'success'}
              >
                {isCod ? 'TIỀN MẶT COD' : 'ĐÃ THANH TOÁN'}
              </Text>
            </View>
          </View>
        </View>

        {/* DANH SÁCH MÓN ĂN TRONG ĐƠN */}
        <View className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <Text variant="headline" weight="bold" className="mb-3">
            Món ăn cần nhận ({order.items.reduce((s, i) => s + i.quantity, 0)} món)
          </Text>

          <View className="gap-2.5">
            {order.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between">
                <View className="flex-1 flex-row items-center gap-2">
                  <View className="h-6 w-6 items-center justify-center rounded-md bg-brand-50">
                    <Text variant="caption" weight="bold" tone="brand">
                      {item.quantity}x
                    </Text>
                  </View>
                  <Text variant="body" weight="medium" className="flex-1" numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <Text variant="body" tone="secondary">
                  {formatVND(item.unitPrice * item.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* THANH THAO TÁC CỐ ĐỊNH PHÍA DƯỚI */}
      {!isCancelled && !isDelivered && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface p-4 shadow-float">
          {order.status === 'CONFIRMED' || order.status === 'PREPARING' ? (
            <View className="flex-row items-center justify-center gap-2 rounded-xl bg-surface-subtle py-3.5">
              <ActivityIndicator size="small" color="#64748B" />
              <Text variant="body" weight="bold" tone="secondary">
                Quán đang chuẩn bị món...
              </Text>
            </View>
          ) : order.status === 'READY_FOR_PICKUP' ? (
            <Button
              label="Đã lấy món & Bắt đầu đi giao"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleConfirmPickup}
            />
          ) : order.status === 'PICKED_UP' ? (
            <Button
              label={
                isCod
                  ? `Đã đến nơi — Thu ${formatVND(order.total)} & Hoàn tất`
                  : 'Đã đến nơi — Hoàn tất giao hàng'
              }
              variant="primary"
              size="lg"
              loading={isSubmitting}
              onPress={handleConfirmDelivered}
            />
          ) : null}
        </View>
      )}

      {/* HỘP THOẠI XÁC NHẬN */}
      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel="Kiểm tra lại"
        loading={isSubmitting}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, visible: false }))}
      />

      {/* MODAL TỔNG KẾT HOÀN TẤT CHUYẾN GIAO */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-scrim p-6">
          <View className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-float">
            <View className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-success-soft">
                <Ionicons name="checkmark-circle" size={42} color="#10B981" />
              </View>
              <Text variant="title" weight="bold" className="mt-3 text-center">
                Giao hàng thành công!
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1 text-center">
                Đơn hàng #{order.id.slice(0, 8).toUpperCase()} đã được bàn giao an toàn.
              </Text>
            </View>

            <View className="mt-6 gap-3 rounded-2xl bg-surface-subtle p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Thu nhập chuyến này:
                </Text>
                <Text variant="body" weight="bold" tone="brand">
                  +{formatVND(order.deliveryFee)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Tiền mặt COD đã thu:
                </Text>
                <Text variant="body" weight="bold" tone={isCod ? 'danger' : 'secondary'}>
                  {isCod ? formatVND(order.total) : '0 ₫ (Đã thanh toán)'}
                </Text>
              </View>
            </View>

            <View className="mt-6">
              <Button
                label="Về trang tìm đơn mới"
                variant="primary"
                size="lg"
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.navigate('DriverTabs', { screen: 'DriverAvailableTab' });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
