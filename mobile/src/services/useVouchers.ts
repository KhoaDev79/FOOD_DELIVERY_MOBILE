import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VoucherManageStatus, vouchersApi } from '../api/vouchers';
import { queryKeys } from '../constants/queryKeys';
import { useAuthStore } from '../store/useAuthStore';
import { VoucherInput } from '../types/api';

/** Mã dùng được cho giỏ hàng (màn Thanh toán) */
export function useAvailableVouchers(
  params: { restaurantId?: string; subtotal: number; deliveryFee?: number },
  enabled = true,
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.vouchers.available(params),
    queryFn: () =>
      vouchersApi.available({
        restaurantId: params.restaurantId!,
        subtotal: params.subtotal,
        deliveryFee: params.deliveryFee,
      }),
    enabled: enabled && isAuthenticated && Boolean(params.restaurantId),
    staleTime: 30 * 1000,
  });
}

export function useVoucherWallet(tab: 'available' | 'history') {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.vouchers.wallet(tab),
    queryFn: () => vouchersApi.wallet(tab),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

export function useFeaturedVouchers() {
  return useQuery({
    queryKey: queryKeys.vouchers.featured,
    queryFn: () => vouchersApi.featured(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useManagedVouchers(
  restaurantId: string | undefined,
  params: { status?: VoucherManageStatus; kind?: string },
) {
  return useQuery({
    queryKey: queryKeys.vouchers.manage(restaurantId ?? 'admin', params),
    queryFn: () => vouchersApi.list(restaurantId, params),
    staleTime: 15 * 1000,
  });
}

export function useSaveVoucher(restaurantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<VoucherInput> }) =>
      id ? vouchersApi.update(restaurantId, id, data) : vouchersApi.create(restaurantId, data as VoucherInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vouchers.all });
    },
  });
}
