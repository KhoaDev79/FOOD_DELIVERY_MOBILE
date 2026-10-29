import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';

let socketInstance: Socket | null = null;

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket'],
        reconnectionAttempts: 5,
      });
    }

    socketRef.current = socketInstance;

    // Lắng nghe sự kiện cập nhật đơn hàng toàn cục
    const handleOrderEvent = (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.mine() });
    };

    socketInstance.on('order:created', handleOrderEvent);
    socketInstance.on('order:status', handleOrderEvent);
    socketInstance.on('order:driver_assigned', handleOrderEvent);
    socketInstance.on('order:payment', handleOrderEvent);

    return () => {
      socketInstance?.off('order:created', handleOrderEvent);
      socketInstance?.off('order:status', handleOrderEvent);
      socketInstance?.off('order:driver_assigned', handleOrderEvent);
      socketInstance?.off('order:payment', handleOrderEvent);
    };
  }, [accessToken, queryClient]);

  const joinOrder = (orderId: string) => {
    socketRef.current?.emit('order:join', { orderId });
  };

  const leaveOrder = (orderId: string) => {
    socketRef.current?.emit('order:leave', { orderId });
  };

  return {
    socket: socketRef.current,
    joinOrder,
    leaveOrder,
  };
}

