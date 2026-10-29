import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

let socketInstance: Socket | null = null;
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

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const socket = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    if (!accessToken) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        notify();
      }
      return;
    }

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });
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
  }, [accessToken, queryClient]);

  const joinOrder = useCallback((orderId: string) => {
    socketInstance?.emit('order:join', { orderId });
  }, []);

  const leaveOrder = useCallback((orderId: string) => {
    socketInstance?.emit('order:leave', { orderId });
  }, []);

  return {
    socket,
    joinOrder,
    leaveOrder,
  };
}
