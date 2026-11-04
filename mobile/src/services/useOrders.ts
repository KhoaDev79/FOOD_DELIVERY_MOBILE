import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CancelReason } from '../types/api';
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
    mutationFn: ({ orderId, reason, note }: { orderId: string; reason: CancelReason; note?: string }) =>
      ordersApi.cancel(orderId, reason, note),
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
}

/** Admin: đơn chờ hoàn tiền / đã hoàn */
export function useRefunds(status: 'pending' | 'done') {
  return useQuery({
    queryKey: ['admin', 'refunds', status],
    queryFn: () => ordersApi.listRefunds(status),
    staleTime: 15 * 1000,
  });
}

export function useConfirmRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) => ordersApi.confirmRefund(orderId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    },
  });
}
