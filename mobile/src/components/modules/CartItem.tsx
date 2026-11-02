import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { CartLineItem } from '../../store/useCartStore';
import { formatVND } from '../../utils/format';
import { hasChoices, linePrice, originalLinePrice } from '../../utils/menuPricing';
import { Money } from './partner/PartnerKit';
import { AppImage, Icon, QuantityStepper, Text } from '../ui';

interface CartItemProps {
  item: CartLineItem;
  /** Đổi số lượng; 0 nghĩa là xoá dòng (theo quy tắc của store). */
  onChangeQuantity: (quantity: number) => void;
  /** Mở bảng chọn để đổi size, topping hoặc thêm tuỳ chọn nếu chưa chọn */
  onEditOptions?: (item: CartLineItem) => void;
}

/** Một dòng món trong giỏ: ảnh, tên, tuỳ chọn đã chọn, ghi chú, thành tiền và bộ chọn số lượng. */
export const CartItem = memo<CartItemProps>(({ item, onChangeQuantity, onEditOptions }) => {
  const unit = item.unitPrice || linePrice(item.menuItem, item);
  const original = originalLinePrice(item.menuItem, item);
  const options = [item.size, ...(item.toppings ?? []), item.spiciness].filter(Boolean);
  const customizable = hasChoices(item.menuItem);

  return (
    <View className="flex-row gap-3 rounded-2xl bg-surface p-3 shadow-card">
      <AppImage uri={item.menuItem.imageUrl} className="h-20 w-20 rounded-xl" fallbackIcon="fast-food-outline" />
      <View className="flex-1 justify-between gap-1.5">
        <View className="gap-0.5">
          <Text variant="body" weight="bold" numberOfLines={2}>
            {item.menuItem.name}
          </Text>
          {options.length > 0 && (
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
              {options.join(' · ')}
            </Text>
          )}
          {!!item.note && (
            <Text variant="caption" weight="regular" tone="muted" numberOfLines={1}>
              Ghi chú: {item.note}
            </Text>
          )}
          {customizable && onEditOptions && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Đổi tuỳ chọn cho ${item.menuItem.name}`}
              onPress={() => onEditOptions(item)}
              hitSlop={8}
              className="mt-0.5 flex-row items-center gap-0.5 self-start active:opacity-70"
            >
              <Text variant="caption" weight="semibold" tone="brand">
                {options.length > 0 ? 'Đổi tuỳ chọn' : 'Thêm size, topping'}
              </Text>
              <Icon name="chevron-forward" size={13} tone="brand" />
            </Pressable>
          )}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <View>
            <Money amount={unit * item.quantity} variant="body-lg" tone="brand" />
            {original > unit && (
              <Text variant="micro" weight="regular" tone="muted" className="line-through">
                {formatVND(original * item.quantity)}
              </Text>
            )}
          </View>
          <QuantityStepper value={item.quantity} onChange={onChangeQuantity} size="sm" max={50} />
        </View>
      </View>
    </View>
  );
});
CartItem.displayName = 'CartItem';
