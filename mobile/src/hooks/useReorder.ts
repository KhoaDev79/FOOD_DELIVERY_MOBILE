import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ordersApi } from '../api/orders';
import { restaurantsApi } from '../api/restaurants';
import { useToast } from '../components/ui';
import { CartRestaurant, useCartStore } from '../store/useCartStore';
import { MenuItem, OrderSummary } from '../types/api';
import { parseOptions } from '../utils/menuPricing';

/**
 * "Đặt lại" một đơn cũ: thêm lại các món vào giỏ rồi mở giỏ hàng.
 * - Luôn lấy thực đơn HIỆN TẠI của quán: giá mới, món đã hết/đã xoá thì bỏ qua và báo cho khách.
 * - Tuỳ chọn cũ (size/topping/mức) chỉ giữ khi quán vẫn còn lựa chọn đó; không thì dùng mặc định.
 * - Giỏ đang có món của quán khác thì hỏi trước khi thay (conflict != null).
 */
export function useReorder() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ order: OrderSummary; cartRestaurantName: string } | null>(null);

  const run = async (order: OrderSummary, replaceCart = false) => {
    setConflict(null);
    setLoadingId(order.id);
    try {
      const [detail, restaurant] = await Promise.all([
        ordersApi.getDetail(order.id),
        restaurantsApi.getDetail(order.restaurant.id),
      ]);

      if (!restaurant.isOpen) {
        toast(`${restaurant.name} đang đóng cửa, bạn quay lại sau nhé.`, 'error');
        return;
      }

      const cart = useCartStore.getState();
      if (cart.restaurant && cart.restaurant.id !== restaurant.id && cart.items.length > 0) {
        if (!replaceCart) {
          setConflict({ order, cartRestaurantName: cart.restaurant.name });
          return;
        }
        cart.clearCart();
      }

      const menu = new Map<string, MenuItem>();
      for (const m of [
        ...(restaurant.categories ?? []).flatMap((c) => c.menuItems ?? []),
        ...(restaurant.uncategorizedItems ?? []),
      ]) {
        menu.set(m.id, m);
      }

      const cartRestaurant: CartRestaurant = {
        id: restaurant.id,
        name: restaurant.name,
        imageUrl: restaurant.imageUrl,
        latitude: restaurant.latitude,
        longitude: restaurant.longitude,
        address: restaurant.address,
        phone: restaurant.phone,
      };

      const skipped: string[] = [];
      let added = 0;
      for (const line of detail.items ?? []) {
        const item = menu.get(line.menuItemId);
        if (!item || !item.isAvailable) {
          skipped.push(line.name);
          continue;
        }
        const opts = parseOptions(item.options);
        const hasOptions = !!(opts.sizes || opts.toppings || opts.spiceLevels || opts.sugarLevels);
        if (!hasOptions) {
          useCartStore.getState().addItem(cartRestaurant, item, line.quantity, line.note ?? undefined);
        } else {
          const prev = line.options;
          const size = opts.sizes?.find((s) => s.id === prev?.size?.id) ?? opts.sizes?.[0];
          const toppings = (prev?.toppings ?? [])
            .map((t) => opts.toppings?.find((x) => x.id === t.id))
            .filter((t): t is NonNullable<typeof t> => !!t);
          const levels = opts.spiceLevels ?? opts.sugarLevels;
          const level = levels ? (prev?.level && levels.includes(prev.level) ? prev.level : levels[0]) : undefined;
          useCartStore.getState().addCustomItem(cartRestaurant, item, line.quantity, {
            sizeId: size?.id,
            size: size?.name,
            toppingIds: toppings.map((t) => t.id),
            toppings: toppings.map((t) => t.name),
            level,
            spiciness: level,
            note: line.note ?? undefined,
          });
        }
        added += line.quantity;
      }

      if (added === 0) {
        toast('Các món trong đơn này hiện đã hết hoặc không còn bán.', 'error');
        return;
      }
      toast(
        skipped.length
          ? `Đã thêm ${added} món vào giỏ. Tạm hết: ${skipped.join(', ')}`
          : `Đã thêm ${added} món vào giỏ`,
        'success',
      );
      navigation.navigate('Cart');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không thể đặt lại đơn này', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  return {
    reorder: (order: OrderSummary) => run(order),
    /** Khách đồng ý thay giỏ hiện tại bằng món của đơn này. */
    confirmReplace: () => conflict && run(conflict.order, true),
    cancelReplace: () => setConflict(null),
    conflict,
    loadingId,
  };
}
