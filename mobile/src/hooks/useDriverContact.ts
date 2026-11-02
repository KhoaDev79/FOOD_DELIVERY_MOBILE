import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Linking } from 'react-native';
import { ordersApi } from '../api/orders';
import { useToast } from '../components/ui';
import { queryKeys } from '../constants/queryKeys';
import { OrderStatus } from '../types/api';

/**
 * Gọi điện cho khách/quán từ các màn của tài xế.
 * Khi đang giao (PICKED_UP), mỗi lần gọi khách được ghi nhận làm "lần liên hệ" — điều kiện để
 * báo giao thất bại — giống hệt nút gọi ở màn chi tiết chuyến.
 */
export function useDriverContact() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const callCustomer = useCallback(
    async (order: { id: string; status: OrderStatus; customer?: { phone?: string | null } | null }) => {
      const phone = order.customer?.phone;
      if (!phone) {
        toast('Chưa có số điện thoại của khách cho đơn này.', 'default');
        return;
      }
      if (order.status === 'PICKED_UP') {
        try {
          await ordersApi.recordContactAttempt(order.id);
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(order.id) });
        } catch {
          // Giới hạn 30 giây giữa hai lần ghi nhận: vẫn mở trình gọi điện bình thường
        }
      }
      Linking.openURL(`tel:${phone}`);
    },
    [toast, queryClient],
  );

  const callRestaurant = useCallback(
    (phone?: string | null) => {
      if (!phone) {
        toast('Quán chưa cập nhật số điện thoại liên hệ.', 'default');
        return;
      }
      Linking.openURL(`tel:${phone}`);
    },
    [toast],
  );

  return { callCustomer, callRestaurant };
}
