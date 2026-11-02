import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';
import { refreshAuthTokens } from '../api/client';
import { SOCKET_URL } from '../constants/config';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

let socketInstance: Socket | null = null;
let socketUserId: string | null = null;
let isConnectedState = false;
const openOrderRooms = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Socket | null {
  return socketInstance;
}

function getConnectedSnapshot(): boolean {
  return isConnectedState;
}

/** Đọc trạng thái kết nối ngoài React (vd. trong bộ xử lý push notification). */
export function isSocketConnected(): boolean {
  return isConnectedState;
}

/**
 * D4: Hook kiểm tra trạng thái kết nối Socket.IO thời gian thực
 * dùng để tắt hoặc giảm tần suất polling khi socket đang hoạt động ổn định.
 */
export function useSocketConnected(): boolean {
  return useSyncExternalStore(subscribe, getConnectedSnapshot, () => false);
}

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const queryClient = useQueryClient();
  const socket = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const isConnected = useSyncExternalStore(subscribe, getConnectedSnapshot, () => false);

  useEffect(() => {
    if (!accessToken || !userId) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        socketUserId = null;
        isConnectedState = false;
        openOrderRooms.clear();
        notify();
      }
      return;
    }

    // Nếu đổi sang người dùng khác -> ngắt socket cũ và tạo mới
    if (socketInstance && socketUserId && socketUserId !== userId) {
      socketInstance.disconnect();
      socketInstance = null;
      socketUserId = null;
      isConnectedState = false;
      openOrderRooms.clear();
      notify();
    }

    if (!socketInstance) {
      socketUserId = userId;
      const created = io(SOCKET_URL, {
        auth: (cb) => {
          cb({ token: useAuthStore.getState().accessToken });
        },
        transports: ['websocket'],
      });

      created.on('connect', () => {
        isConnectedState = true;
        // Tự động vào lại các phòng đơn hàng đang mở sau khi kết nối lại
        openOrderRooms.forEach((orderId) => {
          created.emit('order:join', { orderId });
        });
        notify();
      });

      created.on('disconnect', () => {
        isConnectedState = false;
        notify();
      });

      created.on('connect_error', async (err: Error) => {
        isConnectedState = false;
        notify();
        const msg = err?.message || '';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('jwt')) {
          const newToken = await refreshAuthTokens();
          if (newToken && socketInstance === created) {
            created.connect();
          }
        }
      });

      created.on('error', async (payload: { message?: string }) => {
        const msg = payload?.message || '';
        if (msg.includes('khoá') || msg.includes('khóa') || msg.includes('Vai trò')) {
          useAuthStore.getState().logout();
          return;
        }
        if (msg.toLowerCase().includes('unauthorized')) {
          const newToken = await refreshAuthTokens();
          if (newToken && socketInstance === created) {
            created.connect();
          }
        }
      });

      socketInstance = created;
      notify();
    }

    const currentSocket = socketInstance;

    // Lắng nghe sự kiện cập nhật đơn hàng toàn cục
    const handleOrderEvent = (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.mine() });
    };

    currentSocket.on('order:created', handleOrderEvent);
    currentSocket.on('order:status', handleOrderEvent);
    currentSocket.on('order:driver_assigned', handleOrderEvent);
    currentSocket.on('order:payment', handleOrderEvent);

    return () => {
      currentSocket.off('order:created', handleOrderEvent);
      currentSocket.off('order:status', handleOrderEvent);
      currentSocket.off('order:driver_assigned', handleOrderEvent);
      currentSocket.off('order:payment', handleOrderEvent);
    };
  }, [accessToken, userId, queryClient]);

  const joinOrder = useCallback((orderId: string) => {
    if (!orderId) return;
    openOrderRooms.add(orderId);
    socketInstance?.emit('order:join', { orderId });
  }, []);

  const leaveOrder = useCallback((orderId: string) => {
    if (!orderId) return;
    openOrderRooms.delete(orderId);
    socketInstance?.emit('order:leave', { orderId });
  }, []);

  return {
    socket,
    isConnected,
    joinOrder,
    leaveOrder,
  };
}
