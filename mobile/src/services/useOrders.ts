import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateOrderPayload, ordersApi } from '../api/orders';
import { queryKeys } from '../constants/queryKeys';
import { useSocketConnected } from '../hooks/useSocket';
import { useAuthStore } from '../store/useAuthStore';

export function useMyOrders(status?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.orders.mine(status),
    queryFn: () => ordersApi.getMine({ status, limit: 30 }),
    enabled: isAuthenticated,
  });
}

export function useOrderDetail(orderId: string) {
  const socketConnected = useSocketConnected();
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => ordersApi.getDetail(orderId),
    enabled: Boolean(orderId),
    refetchInterval: socketConnected ? false : 10000, // Chỉ polling dự phòng khi WebSocket mất kết nối
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: CreateOrderPayload; idempotencyKey?: string }) =>
      ordersApi.create(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

