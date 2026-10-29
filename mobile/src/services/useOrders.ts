import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreateOrderPayload, ordersApi } from '../api/orders';
import { queryKeys } from '../constants/queryKeys';

export function useMyOrders(status?: string) {
  return useQuery({
    queryKey: queryKeys.orders.mine(status),
    queryFn: () => ordersApi.getMine({ status, limit: 30 }),
  });
}

export function useOrderDetail(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => ordersApi.getDetail(orderId),
    enabled: Boolean(orderId),
    refetchInterval: 10000, // Polling dự phòng khi WebSocket bị ngắt
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => ordersApi.create(payload),
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

