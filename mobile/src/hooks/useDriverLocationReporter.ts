import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { driversApi } from '../api/drivers';
import { ordersApi } from '../api/orders';
import { useAuthStore } from '../store/useAuthStore';
import { OrderStatus } from '../types/api';
import { useSocket } from './useSocket';

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
];

const SOCKET_EMIT_INTERVAL_MS = 4000;
const HTTP_REPORT_INTERVAL_MS = 45000;

/**
 * D1: Hook báo cáo vị trí GPS thời gian thực của tài xế.
 * Gắn một lần tại DriverTabNavigator:
 * - Chỉ chạy khi tài xế đang trực tuyến (isOnline = true) và đã cấp quyền vị trí foreground.
 * - Khi có đơn đang giữ (CONFIRMED/PREPARING/READY_FOR_PICKUP/PICKED_UP):
 *   emit socket `driver:location` cho từng đơn, tối đa 1 lần / 4 giây.
 * - Mọi lúc khi trực tuyến: gọi PATCH /drivers/me/location tối đa 1 lần / 45 giây.
 * - Tự dừng theo dõi khi tắt trực tuyến, đăng xuất hoặc ứng dụng vào nền.
 */
export function useDriverLocationReporter() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);
  const { socket } = useSocket();

  const isDriver = isAuthenticated && role === 'DRIVER';

  const { data: driverProfile } = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: () => driversApi.getMe(),
    enabled: isDriver,
  });

  const isOnline = Boolean(isDriver && driverProfile?.isOnline);

  const { data: deliveriesData } = useQuery({
    queryKey: ['driver', 'deliveries', 'active_count'],
    queryFn: () => ordersApi.getDeliveries({ limit: 10 }),
    enabled: isOnline,
  });

  const activeOrderIdsRef = useRef<string[]>([]);
  const socketRef = useRef(socket);
  const lastSocketEmitAtRef = useRef<number>(0);
  const lastHttpReportAtRef = useRef<number>(0);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const items = deliveriesData?.items ?? [];
    activeOrderIdsRef.current = items
      .filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status))
      .map((o) => o.id);
  }, [deliveriesData]);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let isCancelled = false;
    let nativeSubscription: Location.LocationSubscription | null = null;
    let webWatchId: number | null = null;

    const handleCoords = (coords: {
      latitude: number;
      longitude: number;
      heading?: number | null;
      speed?: number | null;
      accuracy?: number | null;
    }) => {
      if (isCancelled) return;
      const now = Date.now();
      const { latitude: lat, longitude: lng, heading, speed, accuracy } = coords;

      // 1. Emit socket driver:location cho từng đơn đang hoạt động (tối đa 1 lần / 4s)
      const activeIds = activeOrderIdsRef.current;
      if (
        activeIds.length > 0 &&
        socketRef.current &&
        now - lastSocketEmitAtRef.current >= SOCKET_EMIT_INTERVAL_MS
      ) {
        lastSocketEmitAtRef.current = now;
        activeIds.forEach((orderId, idx) => {
          setTimeout(() => {
            socketRef.current?.emit('driver:location', {
              orderId,
              lat,
              lng,
              ...(typeof heading === 'number' && Number.isFinite(heading) ? { heading } : {}),
              ...(typeof speed === 'number' && Number.isFinite(speed) ? { speed } : {}),
              ...(typeof accuracy === 'number' && Number.isFinite(accuracy) ? { accuracy } : {}),
            });
          }, idx * 2100);
        });
      }

      // 2. Gọi PATCH /drivers/me/location định kỳ (tối đa 1 lần / 45s)
      if (now - lastHttpReportAtRef.current >= HTTP_REPORT_INTERVAL_MS) {
        lastHttpReportAtRef.current = now;
        void driversApi.updateLocation({ latitude: lat, longitude: lng }).catch(() => undefined);
      }
    };

    const stopWatch = () => {
      if (nativeSubscription) {
        nativeSubscription.remove();
        nativeSubscription = null;
      }
      if (
        webWatchId !== null &&
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
      }
    };

    const startWatch = async () => {
      stopWatch();
      if (isCancelled) return;

      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              handleCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                accuracy: pos.coords.accuracy,
              });
            },
            () => undefined,
            { enableHighAccuracy: true, maximumAge: 4000 },
          );
        }
        return;
      }

      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          if (req.status !== 'granted') return;
        }
        if (isCancelled) return;

        nativeSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 15,
          },
          (loc) => {
            handleCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
              speed: loc.coords.speed,
              accuracy: loc.coords.accuracy,
            });
          },
        );
      } catch {
        // Bỏ qua nếu thiết bị tắt dịch vụ vị trí
      }
    };

    void startWatch();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void startWatch();
      } else if (nextState === 'background') {
        stopWatch();
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isCancelled = true;
      appStateSub.remove();
      stopWatch();
    };
  }, [isOnline]);
}

