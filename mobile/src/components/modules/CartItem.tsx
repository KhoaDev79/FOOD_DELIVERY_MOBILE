import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { CartLineItem } from '../../store/useCartStore';
import { formatVND } from '../../utils/format';
import { hasChoices } from '../../utils/menuPricing';
import { AppImage, Icon, QuantityStepper, Text } from '../ui';

interface CartItemProps {
  item: CartLineItem;
  /** Đổi số lượng; 0 nghĩa là xoá dòng (theo quy tắc của store). */
  onChangeQuantity: (quantity: number) => void;
  /** Mở bảng chọn để đổi size, topping hoặc thêm tuỳ chọn nếu chưa chọn */
  onEditOptions?: (item: CartLineItem) => void;
}

/** Một dòng món trong giỏ: ảnh, tên, tuỳ chọn đã chọn, ghi chú, đơn giá và bộ chọn số lượng. */
export const CartItem = memo<CartItemProps>(({ item, onChangeQuantity, onEditOptions }) => {
  const unit = item.unitPrice || item.menuItem.price;
  const options = [item.size && `Size ${item.size}`, ...(item.toppings ?? []), item.spiciness].filter(Boolean);
  const customizable = hasChoices(item.menuItem);

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
          {customizable && onEditOptions && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Đổi tuỳ chọn cho ${item.menuItem.name}`}
              onPress={() => onEditOptions(item)}
              hitSlop={8}
              className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-brand-50 px-2.5 py-1 active:opacity-70"
            >
              <Icon name="options-outline" size="xs" tone="brand" />
              <Text variant="caption" weight="medium" tone="brand">
                {options.length > 0 ? 'Đổi tuỳ chọn' : '+ Thêm topping, size'}
              </Text>
            </Pressable>
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
