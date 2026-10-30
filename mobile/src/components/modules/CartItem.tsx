import { memo } from 'react';
import { View } from 'react-native';
import { CartLineItem } from '../../store/useCartStore';
import { formatVND } from '../../utils/format';
import { AppImage, QuantityStepper, Text } from '../ui';

interface CartItemProps {
  item: CartLineItem;
  /** Đổi số lượng; 0 nghĩa là xoá dòng (theo quy tắc của store). */
  onChangeQuantity: (quantity: number) => void;
}

/** Một dòng món trong giỏ: ảnh, tên, tuỳ chọn đã chọn, ghi chú, đơn giá và bộ chọn số lượng. */
export const CartItem = memo<CartItemProps>(({ item, onChangeQuantity }) => {
  const unit = item.unitPrice || item.menuItem.price;
  const options = [item.size && `Size ${item.size}`, ...(item.toppings ?? []), item.spiciness].filter(Boolean);
  return (
    <View className="flex-row gap-3 rounded-lg bg-surface p-3 shadow-card">
      <AppImage uri={item.menuItem.imageUrl} className="h-20 w-20 rounded-md" fallbackIcon="fast-food-outline" />
      <View className="flex-1 justify-between gap-1">
        <View className="gap-0.5">
          <Text variant="body-lg" weight="semibold" numberOfLines={2}>
            {item.menuItem.name}
          </Text>
          {options.length > 0 && (
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
              {options.join(' · ')}
            </Text>
          )}
          {!!item.note && (
            <Text variant="caption" weight="regular" tone="muted" numberOfLines={2}>
              Ghi chú: {item.note}
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="body-lg" weight="bold" tone="brand">
            {formatVND(unit * item.quantity)}
          </Text>
          <QuantityStepper value={item.quantity} onChange={onChangeQuantity} size="sm" max={50} />
        </View>
      </View>
    </View>
  );
});
CartItem.displayName = 'CartItem';
