import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { CartCheckItemPayload, cartApi, CartLineCheck } from '../api/cart';
import { lineKeyOf, useCartStore } from '../store/useCartStore';
import { useRestaurantStockLive } from './useSocket';

/**
 * Kiểm tra giỏ với máy chủ như GrabFood / ShopeeFood: khi mở giỏ, khi vào Thanh toán, khi quay lại app
 * và ngay khi quán báo hết món (realtime). Trả kết quả theo từng dòng để màn hình đánh dấu.
 */
export function useCartCheck(enabled = true) {
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);

  const payload: CartCheckItemPayload[] = useMemo(
    () =>
      items.map((i) => ({
        lineKey: lineKeyOf(i),
        menuItemId: i.menuItem.id,
        quantity: i.quantity,
        sizeId: i.sizeId,
        toppingIds: i.toppingIds?.length ? i.toppingIds : undefined,
        level: i.level,
        unitPrice: i.unitPrice,
      })),
    [items],
  );

  const restaurantId = restaurant?.id ?? null;
  const query = useQuery({
    queryKey: ['cart-check', restaurantId, payload],
    queryFn: () => cartApi.check(restaurantId!, payload),
    enabled: enabled && !!restaurantId && payload.length > 0,
    staleTime: 15_000,
    // Đổi số lượng không làm nhấp nháy: giữ kết quả cũ trong lúc kiểm tra lại
    placeholderData: keepPreviousData,
  });

  useRestaurantStockLive(enabled ? restaurantId : null);

  // Quay lại app (từ nền) thì kiểm tra lại: món có thể đã hết trong lúc khách rời đi
  const { refetch } = query;
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => sub.remove();
  }, [enabled, refetch]);

  const byKey = useMemo(() => {
    const map = new Map<string, CartLineCheck>();
    query.data?.lines.forEach((l) => map.set(l.lineKey, l));
    return map;
  }, [query.data]);

  const blockingKeys = useMemo(() => query.data?.lines.filter((l) => l.blocking).map((l) => l.lineKey) ?? [], [query.data]);
  const newPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    query.data?.lines.forEach((l) => {
      if (l.status === 'PRICE_CHANGED' && l.unitPrice != null) prices[l.lineKey] = l.unitPrice;
    });
    return prices;
  }, [query.data]);

  return {
    result: query.data,
    byKey,
    blockingKeys,
    newPrices,
    isChecking: query.isFetching,
    refetch: query.refetch,
  };
}
