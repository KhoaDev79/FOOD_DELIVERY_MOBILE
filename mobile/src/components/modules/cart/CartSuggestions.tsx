import { keepPreviousData, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { restaurantsApi } from '../../../api/restaurants';
import { CartRestaurant, useCartStore } from '../../../store/useCartStore';
import { MenuSuggestion } from '../../../types/api';
import { formatVND } from '../../../utils/format';
import { discountPercent, effectiveBasePrice, hasChoices } from '../../../utils/menuPricing';
import { AppImage, cn, Icon, Text, useToast } from '../../ui';
import { DishOptionSheet } from '../restaurant/DishOptionSheet';

/**
 * Gợi ý món thêm vào giỏ, dùng ở Giỏ hàng và Xác nhận đơn.
 * Tiêu đề theo đúng nguồn số liệu: chỉ ghi "Thường được đặt cùng" khi có dữ liệu mua chung thật.
 * Không có gợi ý nào thì ẩn hẳn.
 */
export const CartSuggestions: React.FC<{
  restaurant: CartRestaurant;
  /** embedded: nằm trong một thẻ có sẵn (Xác nhận đơn) nên không vẽ nền/khung riêng. */
  embedded?: boolean;
}> = ({ restaurant, embedded }) => {
  const toast = useToast();
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const addCustomItem = useCartStore((s) => s.addCustomItem);
  const [optionItem, setOptionItem] = useState<MenuSuggestion | null>(null);

  const cartIds = [...new Set(items.map((i) => i.menuItem.id))].sort();
  const { data } = useQuery({
    queryKey: ['restaurants', restaurant.id, 'suggestions', cartIds],
    queryFn: () => restaurantsApi.getSuggestions(restaurant.id, cartIds),
    staleTime: 5 * 60 * 1000,
    // Giữ danh sách cũ trong lúc tải lại sau khi thêm món, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  // Bỏ ngay món vừa thêm vào giỏ (không chờ tải lại)
  const suggestions = (data?.items ?? []).filter((s) => !cartIds.includes(s.id));
  if (suggestions.length === 0) return null;

  const title = suggestions.some((s) => s.reason === 'BOUGHT_TOGETHER')
    ? 'Thường được đặt cùng'
    : suggestions.some((s) => s.reason === 'BEST_SELLER')
      ? 'Món bán chạy của quán'
      : 'Thêm món khác của quán';

  const quickAdd = (s: MenuSuggestion) => {
    if (hasChoices(s)) {
      setOptionItem(s);
      return;
    }
    if (addItem(restaurant, s, 1) === 'ADDED') toast(`Đã thêm ${s.name}`, 'success');
  };

  return (
    <View
      className={cn(
        'gap-2.5',
        embedded ? 'border-t border-line-subtle pt-3' : 'rounded-2xl bg-surface p-3 shadow-card',
      )}
    >
      <View className="flex-row items-center gap-1.5 px-0.5">
        <Icon name="sparkles" size="sm" tone="accent" />
        <Text variant="body" weight="bold">
          {title}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 pr-2">
        {suggestions.map((s) => {
          const pct = discountPercent(s);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Thêm ${s.name}, ${formatVND(effectiveBasePrice(s))}`}
              onPress={() => quickAdd(s)}
              className="w-32 overflow-hidden rounded-2xl border border-line-subtle bg-surface active:opacity-90"
            >
              <View>
                <AppImage uri={s.imageUrl} className="h-24 w-full" fallbackIcon="fast-food-outline" />
                {s.reason === 'BEST_SELLER' && (
                  <View className="absolute left-1.5 top-1.5 flex-row items-center gap-0.5 rounded-md bg-accent-500 px-1.5 py-0.5">
                    <Icon name="flame" size={10} tone="inverse" />
                    <Text variant="micro" weight="bold" tone="inverse">
                      Bán chạy
                    </Text>
                  </View>
                )}
                {pct > 0 && (
                  <View className="absolute right-1.5 top-1.5 rounded-md bg-danger px-1.5 py-0.5">
                    <Text variant="micro" weight="bold" tone="inverse">
                      -{pct}%
                    </Text>
                  </View>
                )}
                {/* Nút + nổi ở góc ảnh */}
                <View className="absolute bottom-1.5 right-1.5 h-8 w-8 items-center justify-center rounded-full bg-brand-500 shadow-raised">
                  <Icon name="add" size="sm" tone="inverse" />
                </View>
              </View>
              <View className="gap-0.5 p-2">
                <Text variant="caption" weight="semibold" numberOfLines={2} className="min-h-[36px]">
                  {s.name}
                </Text>
                <Text variant="caption" weight="bold" tone="brand">
                  {formatVND(effectiveBasePrice(s))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {optionItem && (
        <DishOptionSheet
          item={optionItem}
          canOrder
          confirmLabel="Thêm vào giỏ"
          onClose={() => setOptionItem(null)}
          onConfirm={(dish, sel) => {
            addCustomItem(restaurant, dish, sel.quantity, {
              sizeId: sel.sizeId,
              size: sel.sizeLabel,
              toppingIds: sel.toppingIds,
              toppings: sel.toppingLabels,
              level: sel.level,
              spiciness: sel.level,
              note: sel.note,
            });
            setOptionItem(null);
            toast(`Đã thêm ${dish.name}`, 'success');
          }}
        />
      )}
    </View>
  );
};
