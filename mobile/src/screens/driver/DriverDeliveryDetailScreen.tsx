import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapsApi } from '../../api/maps';
import { ordersApi } from '../../api/orders';
import { AppMapView, AppMapViewHandle, MapMarkerItem, MapRoute } from '../../components/common/AppMapView';
import {
  Money,
  NoticeCard,
  orderCode,
  RoundAction,
  RouteStops,
  SectionCard,
  TripStepper,
} from '../../components/modules/partner/PartnerKit';
import {
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  Icon,
  IconButton,
  IconName,
  IconTone,
  Input,
  OrderStatusBadge,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { palette } from '../../theme';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../hooks/useSocket';
import { useOrderDetail } from '../../services/useOrders';
import { FailedDeliveryReason, OrderDetail } from '../../types/api';
import { formatVND } from '../../utils/format';
import { haversineKm } from '../../utils/geo';
import { FAILED_DELIVERY_REASON_LABELS, formatOrderEndReason } from '../../utils/orderStatus';

interface Props {
  navigation: any;
  route: {
    params: {
      orderId: string;
    };
  };
}

type ScrollableLike = { scrollTo: (o: { y: number; animated?: boolean }) => void };

/**
 * Bộ điều khiển bottom sheet kéo được, tạo một lần cho mỗi màn.
 * Giữ trạng thái cử chỉ trong một object thường để các hàm xử lý cử chỉ đọc/ghi được
 * mà không phải đọc ref trong lúc render.
 */
function createSheetController(initialCollapsedY: number, setExpanded: (v: boolean) => void) {
  const state = {
    collapsedY: initialCollapsedY,
    pos: initialCollapsedY, // vị trí đích hiện tại (0 = mở hẳn)
    start: 0,
    scrollY: 0,
    expanded: false,
    scroll: null as ScrollableLike | null,
  };
  const y = new Animated.Value(initialCollapsedY);
  const clamp = (v: number) => Math.min(state.collapsedY, Math.max(0, v));

  const snap = (expand: boolean) => {
    const target = expand ? 0 : state.collapsedY;
    state.pos = target;
    state.expanded = expand;
    setExpanded(expand);
    if (!expand) state.scroll?.scrollTo({ y: 0, animated: false });
    Animated.spring(y, { toValue: target, useNativeDriver: true, bounciness: 0, speed: 16 }).start();
  };

  const pan = PanResponder.create({
    // Chỉ giành cử chỉ khi kéo dọc rõ ràng; chạm/bấm nút bên trong vẫn hoạt động bình thường
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      if (Math.abs(g.dy) < 8 || Math.abs(g.dy) < Math.abs(g.dx)) return false;
      if (!state.expanded) return true; // đang hạ: kéo đâu cũng di chuyển sheet
      return g.dy > 0 && state.scrollY <= 0; // đang mở: chỉ khi kéo xuống lúc nội dung ở đầu
    },
    onPanResponderGrant: () => {
      state.start = state.pos;
    },
    onPanResponderMove: (_e, g) => {
      y.setValue(clamp(state.start + g.dy));
    },
    onPanResponderRelease: (_e, g) => {
      const pos = clamp(state.start + g.dy);
      snap(g.vy < -0.4 ? true : g.vy > 0.4 ? false : pos < state.collapsedY / 2);
    },
    onPanResponderTerminate: () => snap(state.expanded),
  });

  /** Xoay màn / đổi kích thước: cập nhật vị trí hạ, kéo sheet về đó nếu đang hạ. */
  const setCollapsedY = (v: number) => {
    state.collapsedY = v;
    if (!state.expanded) {
      state.pos = v;
      y.setValue(v);
    }
  };
  const setScroll = (r: ScrollableLike | null) => {
    state.scroll = r;
  };
  const setScrollY = (v: number) => {
    state.scrollY = v;
  };

  return { y, snap, pan, setCollapsedY, setScroll, setScrollY };
}

type RouteLine = {
  coordinates: { latitude: number; longitude: number }[];
  isEstimate: boolean;
};

// Màu đường đi kiểu Google Maps: chặng đang đi xanh đậm, chặng kế tiếp xanh nhạt
const ROUTE_ACTIVE = '#1A73E8';
const ROUTE_ACTIVE_OUTLINE = '#1557B0';
const ROUTE_NEXT = '#8AB4F8';
const ROUTE_NEXT_OUTLINE = '#5E97F6';

const FAILED_REASONS: FailedDeliveryReason[] = [
  'CUSTOMER_UNREACHABLE',
  'CUSTOMER_REFUSED',
  'WRONG_ADDRESS',
  'UNSAFE_LOCATION',
];

export const DriverDeliveryDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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

  // Đường vẽ trên bản đồ: Quán → Khách và Tài xế → Quán
  const [mainRoute, setMainRoute] = useState<RouteLine | null>(null);
  const [driverLeg, setDriverLeg] = useState<RouteLine | null>(null);
  const driverLegOrigin = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const mapRef = useRef<AppMapViewHandle>(null);

  // BOTTOM SHEET kéo được (kiểu Grab):
  // - Hạ xuống (mặc định): bản đồ lộ ~45% màn trên, kéo/zoom bình thường.
  // - Vuốt lên: sheet trượt lên che bản đồ, sau đó nội dung bên trong mới cuộn.
  // - Đang mở mà nội dung ở đầu, kéo xuống: sheet hạ xuống, bản đồ hiện lại.
  // Dùng Animated + PanResponder của React Native (không phải Reanimated) và chỉ đặt transform qua style.
  const mapHeight = Math.round(windowHeight * 0.45);
  const sheetTop = insets.top + 64; // ngay dưới thanh nút quay lại
  const collapsedY = Math.max(0, mapHeight - 24 - sheetTop); // khoảng sheet bị đẩy xuống khi hạ
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheet] = useState(() => createSheetController(collapsedY, setSheetExpanded));

  // Xoay màn / đổi kích thước: cập nhật vị trí hạ của sheet
  useEffect(() => {
    sheet.setCollapsedY(collapsedY);
  }, [collapsedY, sheet]);

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

  // C3: Trả lại đơn
  const [releaseSheetOpen, setReleaseSheetOpen] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');

  // C5: Giao thất bại & đồng hồ đếm thời gian chờ tại điểm giao
  const [waitedSeconds, setWaitedSeconds] = useState(0);
  const [failedSheetOpen, setFailedSheetOpen] = useState(false);
  const [failedReason, setFailedReason] = useState<FailedDeliveryReason>('CUSTOMER_UNREACHABLE');
  const [failedNote, setFailedNote] = useState('');

  // Đồng hồ đếm thời gian chờ từ order.arrivedAt
  useEffect(() => {
    if (!order?.arrivedAt || order.status !== 'PICKED_UP') {
      return;
    }
    const arrivedMs = new Date(order.arrivedAt).getTime();
    const updateTimer = () => {
      const sec = Math.max(0, Math.floor((Date.now() - arrivedMs) / 1000));
      setWaitedSeconds(sec);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order?.arrivedAt, order?.status]);

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
          const reason = formatOrderEndReason(updatedOrder);
          toast(`Đơn hàng đã bị huỷ${reason ? `: ${reason}` : ''}`, 'error');
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

  // Đường đi Quán → Khách: vừa để vẽ lên bản đồ, vừa lấy khoảng cách & thời gian
  useEffect(() => {
    if (!order) return;
    let active = true;

    async function calculateRoute() {
      if (!order) return;
      try {
        const res = await mapsApi.getRoute(
          order.restaurant.latitude,
          order.restaurant.longitude,
          order.deliveryLat,
          order.deliveryLng,
        );
        if (active) {
          setRouteInfo({
            distanceKm: res.distanceKm,
            durationMinutes: res.durationMinutes,
            isEstimate: res.source === 'ESTIMATED',
          });
          setMainRoute({
            coordinates: res.coordinates,
            isEstimate: res.source === 'ESTIMATED',
          });
        }
      } catch {
        if (active) {
          const dist = haversineKm(
            {
              latitude: order.restaurant.latitude,
              longitude: order.restaurant.longitude,
            },
            { latitude: order.deliveryLat, longitude: order.deliveryLng },
          );
          const duration = Math.max(5, Math.round((dist / 25) * 60 + 5));
          setRouteInfo({
            distanceKm: dist,
            durationMinutes: duration,
            isEstimate: true,
          });
          setMainRoute({
            coordinates: [
              {
                latitude: order.restaurant.latitude,
                longitude: order.restaurant.longitude,
              },
              { latitude: order.deliveryLat, longitude: order.deliveryLng },
            ],
            isEstimate: true,
          });
        }
      }
    }

    calculateRoute();
    return () => {
      active = false;
    };
    // Chỉ tính lại khi đổi đơn hoặc đổi toạ độ quán/khách, không phải mỗi lần đơn được tải lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    order?.id,
    order?.restaurant.latitude,
    order?.restaurant.longitude,
    order?.deliveryLat,
    order?.deliveryLng,
  ]);

  // Chặng Tài xế → Quán (chỉ khi chưa lấy món). Chỉ tải lại khi tài xế đã đi xa hơn 300m
  // so với lần tải trước, để không tốn lượt gọi bản đồ mỗi lần GPS cập nhật.
  const needsDriverLeg =
    order?.status === 'CONFIRMED' || order?.status === 'PREPARING' || order?.status === 'READY_FOR_PICKUP';
  useEffect(() => {
    // Sau khi lấy món, chặng này tự ẩn nhờ điều kiện showDriverLeg lúc vẽ
    if (!order || !needsDriverLeg || !driverCoords?.latitude || !driverCoords?.longitude) return;
    const origin = {
      latitude: driverCoords.latitude,
      longitude: driverCoords.longitude,
    };
    const last = driverLegOrigin.current;
    if (last && haversineKm(last, origin) < 0.3) return;
    driverLegOrigin.current = origin;

    let active = true;
    const dest = {
      latitude: order.restaurant.latitude,
      longitude: order.restaurant.longitude,
    };
    mapsApi
      .getRoute(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
      .then((res) => {
        if (active)
          setDriverLeg({
            coordinates: res.coordinates,
            isEstimate: res.source === 'ESTIMATED',
          });
      })
      .catch(() => {
        if (active) setDriverLeg({ coordinates: [origin, dest], isEstimate: true });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, needsDriverLeg, driverCoords?.latitude, driverCoords?.longitude]);

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
        pinColor: palette.danger.DEFAULT,
      },
      {
        id: 'delivery',
        latitude: order.deliveryLat,
        longitude: order.deliveryLng,
        title: `Khách hàng: ${order.customer.fullName}`,
        description: `Điểm giao: ${order.deliveryAddress}`,
        type: 'delivery',
        pinColor: palette.brand['500'],
      },
    ];

    if (driverCoords && driverCoords.latitude && driverCoords.longitude) {
      list.push({
        id: 'driver',
        latitude: driverCoords.latitude,
        longitude: driverCoords.longitude,
        title: 'Vị trí của bạn',
        type: 'driver',
        pinColor: palette.success.DEFAULT,
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

  // Gọi khách hàng (tự động ghi nhận contact-attempt nếu đang ở trạng thái PICKED_UP)
  const handleCallCustomer = async (phone?: string | null) => {
    if (!phone) {
      toast('Khách hàng chưa cung cấp số điện thoại liên lạc.', 'default');
      return;
    }
    if (order?.status === 'PICKED_UP') {
      try {
        await ordersApi.recordContactAttempt(order.id);
        refetch();
      } catch {
        // Bỏ qua lỗi giới hạn 30s để vẫn mở trình gọi điện thoại ngay lập tức
      }
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleCallRestaurant = (phone?: string | null) => {
    if (!phone) {
      toast('Quán chưa cập nhật số điện thoại liên hệ.', 'default');
      return;
    }
    Linking.openURL(`tel:${phone}`);
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
          await queryClient.invalidateQueries({
            queryKey: queryKeys.orders.all,
          });
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

  // C5: Xác nhận "Đã đến điểm giao" -> POST /orders/:id/arrived
  const handleMarkArrived = async () => {
    if (!order) return;
    if (!driverCoords) {
      toast('Không xác định được vị trí GPS hiện tại. Hãy bật định vị thiết bị.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      await ordersApi.markArrived(order.id, driverCoords.latitude, driverCoords.longitude);
      await refetch();
      toast('Đã xác nhận đến điểm giao! Khách hàng đã nhận được thông báo.', 'success');
    } catch (err: any) {
      toast(
        err?.response?.data?.message ||
          'Không thể xác nhận đến điểm giao. Hãy tiến lại gần địa chỉ khách hơn.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // C3: Tài xế trả lại đơn khi chưa lấy món
  const handleSubmitRelease = async () => {
    if (!order) return;
    if (!releaseReason.trim()) {
      toast('Vui lòng nhập lý do trả lại chuyến giao.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      await ordersApi.releaseOrder(order.id, releaseReason.trim());
      setReleaseSheetOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast('Đã trả lại chuyến giao cho hệ thống điều phối.', 'success');
      navigation.navigate('DriverTabs', { screen: 'DriverAvailableTab' });
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không thể trả lại đơn hàng.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // C5: Báo giao thất bại
  const handleSubmitFailedDelivery = async () => {
    if (!order) return;
    try {
      setIsSubmitting(true);
      await ordersApi.updateStatus(order.id, 'DELIVERY_FAILED', {
        failedReason,
        cancelNote: failedNote.trim() || undefined,
      });
      setFailedSheetOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['driver'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      await refetch();
      toast('Đã ghi nhận giao hàng thất bại và cộng công chuyến đi.', 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Chưa đủ điều kiện báo giao thất bại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý xác nhận "Đã giao cho khách" -> Chuyển sang DELIVERED
  const handleConfirmDelivered = () => {
    if (!order) return;
    const isCod = order.paymentMethod === 'COD';
    const message = isCod
      ? `ĐƠN THU TIỀN MẶT (COD)\n\nVui lòng xác nhận bạn ĐÃ THU ĐỦ ${formatVND(
          order.total,
        )} từ khách hàng ${order.customer.fullName} và đã bàn giao món thành công.`
      : `Khách hàng đã thanh toán trực tuyến.\n\nBạn chỉ cần bàn giao món và KHÔNG THU THÊM TIỀN MẶT. Xác nhận hoàn tất?`;

    setConfirmDialog({
      visible: true,
      title: 'Hoàn tất chuyến giao',
      message,
      confirmLabel: isCod ? `Đã thu ${formatVND(order.total)} & Đã giao` : 'Xác nhận đã giao hàng',
      onConfirm: async () => {
        try {
          setIsSubmitting(true);
          await ordersApi.updateStatus(order.id, 'DELIVERED');
          await queryClient.invalidateQueries({ queryKey: ['driver'] });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.orders.all,
          });
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
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
        <TopBar title="Chi tiết chuyến giao" onLeadingPress={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center p-6">
          <ActivityIndicator size="large" color={palette.brand['500']} />
          <Text variant="body" tone="secondary" className="mt-4">
            Đang tải dữ liệu chuyến giao...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const isFailed = order.status === 'DELIVERY_FAILED';
  const isDelivered = order.status === 'DELIVERED';
  const isFinished = isCancelled || isFailed || isDelivered;
  const isCod = order.paymentMethod === 'COD';
  const canRelease =
    order.status === 'CONFIRMED' || order.status === 'PREPARING' || order.status === 'READY_FOR_PICKUP';

  const tripEarning = order.driverEarning ?? order.deliveryFee;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  // Đếm số lần gọi sau thời điểm arrivedAt
  const callsAfterArrived = !order.contactAttempts
    ? 0
    : !order.arrivedAt
      ? order.contactAttempts.length
      : order.contactAttempts.filter(
          (a) => new Date(a.createdAt).getTime() >= new Date(order.arrivedAt!).getTime(),
        ).length;

  const waitedMin = Math.floor(waitedSeconds / 60);
  const waitedSecRem = waitedSeconds % 60;
  const hasWaitedMin10 = Boolean(order.arrivedAt && waitedSeconds >= 10 * 60);

  const openChat = (channel: 'CUSTOMER_DRIVER' | 'RESTAURANT_DRIVER') =>
    navigation.navigate('Chat', {
      orderId: order.id,
      channel,
      recipientName: channel === 'CUSTOMER_DRIVER' ? order.customer.fullName : order.restaurant.name,
      recipientRole: channel === 'CUSTOMER_DRIVER' ? 'Khách hàng' : 'Quán ăn',
    });

  // "Bước tiếp theo": điều duy nhất tài xế cần biết khi liếc vào màn hình
  const routeText = routeInfo
    ? `Quãng giao ${routeInfo.distanceKm} km • ~${routeInfo.durationMinutes} phút${routeInfo.isEstimate ? ' (ước tính)' : ''}`
    : 'Đang ước tính lộ trình...';
  const nextStep: {
    title: string;
    subtitle: string;
    icon: IconName;
    box: string;
    tone: IconTone;
  } = isCancelled
    ? {
        title: 'Đơn hàng đã bị huỷ',
        subtitle: 'Bạn không cần giao đơn này nữa',
        icon: 'close-circle',
        box: 'bg-danger-soft',
        tone: 'danger',
      }
    : isFailed
      ? {
          title: 'Giao hàng không thành công',
          subtitle: 'Chuyến đã được ghi nhận',
          icon: 'alert-circle',
          box: 'bg-danger-soft',
          tone: 'danger',
        }
      : isDelivered
        ? {
            title: 'Chuyến đã hoàn tất',
            subtitle: `Bạn nhận được ${formatVND(tripEarning)}`,
            icon: 'checkmark-circle',
            box: 'bg-success-soft',
            tone: 'success',
          }
        : order.status === 'READY_FOR_PICKUP'
          ? {
              title: 'Đến quán lấy món',
              subtitle: `${order.restaurant.name} • Món đã sẵn sàng`,
              icon: 'storefront',
              box: 'bg-brand-50',
              tone: 'brand',
            }
          : order.status === 'PICKED_UP'
            ? order.arrivedAt
              ? {
                  title: 'Đang chờ khách nhận hàng',
                  subtitle: order.customer.fullName,
                  icon: 'time',
                  box: 'bg-brand-50',
                  tone: 'brand',
                }
              : {
                  title: 'Giao đến khách hàng',
                  subtitle: routeText,
                  icon: 'navigate',
                  box: 'bg-brand-50',
                  tone: 'brand',
                }
            : {
                title: 'Quán đang làm món',
                subtitle: `Bạn có thể di chuyển tới ${order.restaurant.name}`,
                icon: 'restaurant',
                box: 'bg-violet-soft',
                tone: 'violet',
              };

  // Chưa lấy món: chặng Tài xế → Quán là chặng đang đi (xanh đậm), Quán → Khách là chặng kế tiếp (xanh nhạt).
  // Đã lấy món: Quán → Khách là chặng đang đi. Đường ước tính (không lấy được đường phố) vẽ nét đứt.
  const showDriverLeg = needsDriverLeg && !!driverLeg;
  const mapRoutes: MapRoute[] = [];
  if (mainRoute) {
    mapRoutes.push({
      id: 'restaurant-customer',
      coordinates: mainRoute.coordinates,
      color: showDriverLeg ? ROUTE_NEXT : ROUTE_ACTIVE,
      outlineColor: showDriverLeg ? ROUTE_NEXT_OUTLINE : ROUTE_ACTIVE_OUTLINE,
      width: showDriverLeg ? 5 : 6,
      dashed: mainRoute.isEstimate,
    });
  }
  if (showDriverLeg && driverLeg) {
    mapRoutes.push({
      id: 'driver-restaurant',
      coordinates: driverLeg.coordinates,
      color: ROUTE_ACTIVE,
      outlineColor: ROUTE_ACTIVE_OUTLINE,
      width: 6,
      dashed: driverLeg.isEstimate,
    });
  }

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* BẢN ĐỒ nằm dưới cùng; phần không bị sheet che vẫn kéo/zoom được */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: mapHeight,
        }}
      >
        <AppMapView
          ref={mapRef}
          initialRegion={mapRegion}
          markers={markers}
          routes={mapRoutes}
          autoFit="once"
          edgePadding={{
            top: insets.top + 72,
            right: 56,
            bottom: 64,
            left: 56,
          }}
          style={{ flex: 1 }}
        />

        {/* Nút canh lại bản đồ */}
        <View className="absolute right-3" style={{ bottom: 36 }}>
          <IconButton
            icon="locate"
            variant="surface"
            accessibilityLabel="Canh lại bản đồ cho vừa lộ trình"
            onPress={() => mapRef.current?.fitAll()}
          />
        </View>
      </View>

      {/* SHEET: chỉ dịch chuyển bằng transform (Animated của React Native) */}
      <Animated.View
        {...sheet.pan.panHandlers}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: sheetTop,
          bottom: 0,
          transform: [{ translateY: sheet.y }],
        }}
      >
        <View className="flex-1 overflow-hidden rounded-t-3xl bg-canvas-subtle shadow-float">
          {/* PHẦN ĐẦU SHEET: bước tiếp theo + chỉ đường + tiến trình */}
          <View className="gap-4 bg-surface px-4 pb-4 pt-2.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                sheetExpanded ? 'Hạ bảng thông tin để xem bản đồ' : 'Kéo bảng thông tin lên'
              }
              onPress={() => sheet.snap(!sheetExpanded)}
              hitSlop={10}
              className="items-center"
            >
              <View className="h-1.5 w-10 rounded-full bg-line" />
            </Pressable>

            <View className="flex-row items-center gap-3">
              <View className={cn('h-12 w-12 items-center justify-center rounded-2xl', nextStep.box)}>
                <Icon name={nextStep.icon} size="lg" tone={nextStep.tone} />
              </View>
              <View className="flex-1">
                <Text variant="micro" tone="muted" className="uppercase">
                  {isFinished ? 'Trạng thái' : 'Bước tiếp theo'}
                </Text>
                <Text variant="headline" weight="bold" numberOfLines={1}>
                  {nextStep.title}
                </Text>
                <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
                  {nextStep.subtitle}
                </Text>
              </View>
              {!isFinished && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Chỉ đường trên Google Maps hoặc Apple Maps"
                  onPress={handleOpenNavigation}
                  className="h-12 items-center justify-center rounded-2xl bg-brand-500 px-3.5 shadow-glow active:bg-brand-600"
                >
                  <Icon name="navigate" size="sm" tone="inverse" />
                  <Text variant="micro" weight="bold" tone="inverse">
                    Chỉ đường
                  </Text>
                </Pressable>
              )}
            </View>

            {!isCancelled && !isFailed && <TripStepper status={order.status} />}
          </View>

          {/* Phần đầu nằm ngoài vùng cuộn: kéo ở đây luôn điều khiển sheet */}
          <ScrollView
            ref={(r) => sheet.setScroll(r as unknown as ScrollableLike | null)}
            style={{ flex: 1 }}
            // Khi sheet đang hạ, kéo lên sẽ đẩy cả sheet lên trước; mở hẳn rồi mới cuộn nội dung
            scrollEnabled={sheetExpanded}
            bounces={false}
            overScrollMode="never"
            onScroll={(e) => sheet.setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-3 px-4 pt-3">
              {/* LÝ DO KẾT THÚC (huỷ / giao thất bại) */}
              {(isCancelled || isFailed) && !!formatOrderEndReason(order) && (
                <NoticeCard
                  tone="danger"
                  icon="information-circle"
                  title="Lý do"
                  message={formatOrderEndReason(order)}
                />
              )}

              {/* ĐỒNG HỒ CHỜ TẠI ĐIỂM GIAO & BÁO GIAO THẤT BẠI */}
              {order.status === 'PICKED_UP' && (
                <SectionCard
                  title={order.arrivedAt ? 'Đã đến điểm giao' : 'Khi tới điểm giao'}
                  icon="flag"
                  surfaceClassName="bg-brand-50"
                  className="border border-brand-200"
                  iconBox="bg-surface"
                  right={
                    order.arrivedAt ? (
                      <View className="flex-row items-center gap-1 rounded-full bg-surface px-3 py-1">
                        <Icon name="time-outline" size={14} tone="brand" />
                        <Text variant="caption" weight="bold" tone="brand">
                          {String(waitedMin).padStart(2, '0')}:{String(waitedSecRem).padStart(2, '0')}
                        </Text>
                      </View>
                    ) : undefined
                  }
                >
                  {!order.arrivedAt ? (
                    <>
                      <Text variant="caption" weight="regular" tone="secondary">
                        Khi cách địa chỉ khách dưới 200m, bấm nút bên dưới để báo cho khách và bắt đầu tính
                        thời gian chờ.
                      </Text>
                      <Button
                        label="Tôi đã đến điểm giao"
                        variant="primary"
                        size="md"
                        leftIcon="checkmark-circle-outline"
                        loading={isSubmitting}
                        onPress={handleMarkArrived}
                      />
                    </>
                  ) : (
                    <>
                      <View className="flex-row gap-2">
                        <View className="flex-1 rounded-xl bg-surface p-2.5">
                          <Text variant="micro" tone="muted">
                            Đã gọi khách
                          </Text>
                          <Text variant="body" weight="bold">
                            {callsAfterArrived}/3 lần
                          </Text>
                        </View>
                        <View className="flex-1 rounded-xl bg-surface p-2.5">
                          <Text variant="micro" tone="muted">
                            Chờ tối thiểu
                          </Text>
                          <Text variant="body" weight="bold">
                            10 phút
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row gap-2">
                        <Button
                          label="Gọi khách"
                          variant="outline"
                          size="md"
                          leftIcon="call-outline"
                          className="flex-1"
                          onPress={() => handleCallCustomer(order.customer.phone)}
                        />
                        <Button
                          label="Giao thất bại"
                          variant="dangerSoft"
                          size="md"
                          disabled={!hasWaitedMin10 || isSubmitting}
                          className="flex-1"
                          onPress={() => setFailedSheetOpen(true)}
                        />
                      </View>
                      {!hasWaitedMin10 && (
                        <Text variant="micro" weight="medium" tone="muted">
                          Nút "Giao thất bại" mở sau khi chờ đủ 10 phút tại điểm giao.
                        </Text>
                      )}
                    </>
                  )}
                </SectionCard>
              )}

              {/* LỘ TRÌNH: QUÁN → KHÁCH */}
              <SectionCard title="Lộ trình">
                <RouteStops
                  pickup={{
                    label: 'Lấy món tại quán',
                    title: order.restaurant.name,
                    address: order.restaurant.address,
                    actions: isFinished ? undefined : (
                      <>
                        {!!order.restaurant.phone && (
                          <RoundAction
                            icon="call"
                            tone="danger"
                            label="Gọi cho quán"
                            onPress={() => handleCallRestaurant(order.restaurant.phone)}
                          />
                        )}
                        <RoundAction
                          icon="chatbubble-ellipses"
                          tone="danger"
                          label="Nhắn tin với quán"
                          onPress={() => openChat('RESTAURANT_DRIVER')}
                        />
                      </>
                    ),
                  }}
                  dropoff={{
                    label: 'Giao đến khách',
                    title: order.customer.fullName,
                    meta: order.customer.phone,
                    address: order.deliveryAddress,
                    actions: isFinished ? undefined : (
                      <>
                        <RoundAction
                          icon="call"
                          label="Gọi cho khách hàng"
                          onPress={() => handleCallCustomer(order.customer.phone)}
                        />
                        <RoundAction
                          icon="chatbubble-ellipses"
                          label="Nhắn tin với khách hàng"
                          onPress={() => openChat('CUSTOMER_DRIVER')}
                        />
                      </>
                    ),
                    footer: order.note ? (
                      <View className="mt-1 flex-row gap-2 rounded-xl bg-warning-soft p-2.5">
                        <Icon name="document-text-outline" size={15} tone="warning" />
                        <Text variant="caption" tone="warning" className="flex-1">
                          {order.note}
                        </Text>
                      </View>
                    ) : undefined,
                  }}
                />
              </SectionCard>

              {/* THANH TOÁN: tiền cần thu nổi bật bằng vạch đỏ, không phủ cả mảng màu */}
              <SectionCard title="Thanh toán">
                {isCod ? (
                  <View className="flex-row overflow-hidden rounded-xl border border-danger-soft bg-surface">
                    <View className="w-1.5 bg-danger" />
                    <View className="flex-1 flex-row items-center justify-between gap-2 p-3.5">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5">
                          <Icon name="cash" size="sm" tone="danger" />
                          <Text variant="caption" weight="bold" tone="danger">
                            Thu tiền mặt
                          </Text>
                        </View>
                        <Text variant="micro" weight="regular" tone="muted">
                          Thu đủ trước khi giao món
                        </Text>
                      </View>
                      <Money amount={order.total} variant="title" tone="danger" />
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2.5 rounded-xl bg-success-soft p-3.5">
                    <Icon name="checkmark-circle" size="md" tone="success" />
                    <View className="flex-1">
                      <Text variant="caption" weight="bold" tone="success">
                        Khách đã thanh toán trực tuyến
                      </Text>
                      <Text variant="caption" weight="regular" tone="secondary">
                        Không thu thêm tiền mặt
                      </Text>
                    </View>
                  </View>
                )}

                <View className="flex-row items-center justify-between gap-3 px-1">
                  <View className="flex-1">
                    <Text variant="body" weight="medium">
                      Bạn nhận được
                    </Text>
                    <Text variant="micro" weight="regular" tone="muted">
                      {isCod ? 'Giữ lại từ tiền thu hộ' : 'Cộng vào thu nhập chuyến'}
                    </Text>
                  </View>
                  <Money amount={tripEarning} sign="+" variant="headline" tone="brand" />
                </View>
              </SectionCard>

              {/* MÓN CẦN LẤY */}
              <SectionCard
                title="Món cần lấy"
                right={
                  <View className="rounded-full bg-brand-50 px-2.5 py-0.5">
                    <Text variant="caption" weight="bold" tone="brand">
                      {itemCount} món
                    </Text>
                  </View>
                }
              >
                <View className="gap-2.5">
                  {order.items.map((item) => (
                    <View key={item.id} className="flex-row items-center gap-2.5">
                      <View className="h-7 min-w-[28px] items-center justify-center rounded-lg bg-brand-50 px-1">
                        <Text variant="caption" weight="bold" tone="brand">
                          {item.quantity}x
                        </Text>
                      </View>
                      <Text variant="body" weight="medium" className="flex-1" numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text variant="body" tone="secondary">
                        {formatVND(item.unitPrice * item.quantity)}
                      </Text>
                    </View>
                  ))}
                </View>
              </SectionCard>

              {/* TRẢ LẠI ĐƠN KHI CHƯA LẤY MÓN */}
              {canRelease && (
                <Button
                  label="Gặp sự cố? Trả lại chuyến giao"
                  variant="ghost"
                  size="md"
                  leftIcon="alert-circle-outline"
                  onPress={() => {
                    setReleaseReason('');
                    setReleaseSheetOpen(true);
                  }}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {/* NÚT QUAY LẠI + MÃ ĐƠN nổi trên bản đồ */}
      <View
        className="absolute left-3 right-3 flex-row items-center justify-between"
        style={{ top: insets.top + 8 }}
        pointerEvents="box-none"
      >
        <IconButton
          icon="arrow-back"
          variant="surface"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
        />
        <View className="flex-row items-center gap-2 rounded-full bg-surface py-1.5 pl-3 pr-1.5 shadow-raised">
          <Text variant="caption" weight="bold">
            #{orderCode(order.id)}
          </Text>
          <OrderStatusBadge status={order.status} />
        </View>
      </View>

      {/* THANH THAO TÁC CỐ ĐỊNH PHÍA DƯỚI */}
      {!isFinished && (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-line-subtle bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {order.status === 'CONFIRMED' || order.status === 'PREPARING' ? (
            <View className="h-button-lg flex-row items-center justify-center gap-2 rounded-xl bg-violet-soft">
              <ActivityIndicator size="small" color={palette.violet.strong} />
              <Text variant="body" weight="bold" className="text-violet-strong">
                Quán đang chuẩn bị món...
              </Text>
            </View>
          ) : order.status === 'READY_FOR_PICKUP' ? (
            <Button
              label="Đã lấy món & Bắt đầu đi giao"
              variant="primary"
              size="lg"
              leftIcon="bag-check-outline"
              loading={isSubmitting}
              onPress={handleConfirmPickup}
            />
          ) : order.status === 'PICKED_UP' ? (
            <Button
              label={isCod ? `Đã thu ${formatVND(order.total)} & Hoàn tất` : 'Hoàn tất giao hàng'}
              variant="primary"
              size="lg"
              leftIcon="checkmark-done"
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

      {/* SHEET TRẢ LẠI ĐƠN (C3) */}
      <BottomSheet
        visible={releaseSheetOpen}
        onClose={() => setReleaseSheetOpen(false)}
        title="Trả lại chuyến giao"
        footer={
          <View className="pb-2">
            <Button
              label="Xác nhận trả lại đơn"
              variant="danger"
              size="lg"
              loading={isSubmitting}
              disabled={!releaseReason.trim()}
              onPress={handleSubmitRelease}
            />
          </View>
        }
      >
        <View className="gap-3 py-2">
          <NoticeCard
            tone="warning"
            icon="information-circle"
            title="Tối đa 3 lần mỗi ngày"
            message="Chỉ trả được đơn trước khi lấy món. Đơn sẽ được chuyển cho tài xế khác gần quán."
          />
          <Input
            label="Lý do trả đơn *"
            placeholder="Ví dụ: Xe gặp sự cố, quán chờ quá lâu..."
            value={releaseReason}
            onChangeText={setReleaseReason}
            maxLength={200}
          />
        </View>
      </BottomSheet>

      {/* SHEET BÁO GIAO HÀNG THẤT BẠI (C5) */}
      <BottomSheet
        visible={failedSheetOpen}
        onClose={() => setFailedSheetOpen(false)}
        title="Báo giao hàng thất bại"
        footer={
          <View className="pb-2">
            <Button
              label="Xác nhận giao thất bại"
              variant="danger"
              size="lg"
              loading={isSubmitting}
              onPress={handleSubmitFailedDelivery}
            />
          </View>
        }
      >
        <View className="gap-3 py-2">
          <Text variant="caption" weight="regular" tone="secondary">
            Chọn lý do không thể giao hàng. Với lý do "Không liên lạc được với khách hàng", hệ thống yêu cầu
            tối thiểu 3 cuộc gọi sau khi đến điểm giao.
          </Text>
          <View className="gap-2">
            {FAILED_REASONS.map((r) => {
              const selected = failedReason === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setFailedReason(r)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-xl border p-3.5',
                    selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                  )}
                >
                  <Icon
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size="md"
                    tone={selected ? 'brand' : 'muted'}
                  />
                  <Text variant="body" weight={selected ? 'semibold' : 'regular'} className="flex-1">
                    {FAILED_DELIVERY_REASON_LABELS[r]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            label="Ghi chú chi tiết (tuỳ chọn)"
            placeholder="Mô tả thêm tình huống tại điểm giao..."
            value={failedNote}
            onChangeText={setFailedNote}
            maxLength={300}
          />
        </View>
      </BottomSheet>

      {/* MODAL TỔNG KẾT HOÀN TẤT CHUYẾN GIAO */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-scrim p-6">
          <View className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-float">
            <View className="items-center">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-success-soft">
                <Icon name="checkmark-circle" size={52} tone="success" />
              </View>
              <Text variant="title" weight="bold" className="mt-4 text-center">
                Giao hàng thành công!
              </Text>
              <Text variant="caption" weight="regular" tone="secondary" className="mt-1 text-center">
                Đơn #{orderCode(order.id)} đã được bàn giao an toàn.
              </Text>
            </View>

            <View className="mt-5 gap-3 rounded-2xl bg-canvas-subtle p-4">
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Bạn nhận được
                </Text>
                <Text variant="headline" weight="bold" tone="brand">
                  +{formatVND(tripEarning)}
                </Text>
              </View>
              <View className="h-px bg-line" />
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Tiền mặt đã thu
                </Text>
                <Text variant="body" weight="bold" tone={isCod ? 'danger' : 'secondary'}>
                  {isCod ? formatVND(order.total) : '0 ₫ (Đã thanh toán)'}
                </Text>
              </View>
            </View>

            <View className="mt-6">
              <Button
                label="Tìm đơn mới"
                variant="primary"
                size="lg"
                leftIcon="search"
                onPress={() => {
                  setShowSuccessModal(false);
                  navigation.navigate('DriverTabs', {
                    screen: 'DriverAvailableTab',
                  });
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
