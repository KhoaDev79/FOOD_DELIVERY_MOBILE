import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppImage, Badge, cn, Icon, IconButton, Text } from '../../ui';
import { NearbyDish } from '../../../types/api';
import { formatVND } from '../../../utils/format';

interface Props {
  dish: NearbyDish;
  onPress: (d: NearbyDish) => void;
  onAdd: (d: NearbyDish) => void;
  className?: string;
}

/**
 * Thẻ món (ảnh mẫu 3 – khối "Bữa Ăn 29K"): ảnh vuông, nút "+", tên quán, tên món, giá.
 * Giá hiển thị là `price` – đúng giá backend dùng khi tạo đơn.
 */
export const DishCard = memo<Props>(({ dish, onPress, onAdd, className }) => {
  const open = dish.restaurant.isOpen;
  return (
    // Nút "+" là phần tử ngang hàng (không lồng trong nút của thẻ) để không tạo nút lồng nút.
    <View className={cn('w-40', className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dish.name}, ${formatVND(dish.price)}, quán ${dish.restaurant.name}`}
        onPress={() => onPress(dish)}
        className="gap-1.5 active:opacity-80"
      >
        <AppImage uri={dish.imageUrl} className="h-40 w-40 rounded-lg" fallbackIcon="fast-food-outline">
          {!open && (
            <View className="absolute inset-0 items-center justify-center bg-scrim">
              <Badge label="Quán đã đóng" tone="neutral" />
            </View>
          )}
        </AppImage>
        <View className="mt-0.5 flex-row items-center gap-1">
          <Icon name="storefront-outline" size="xs" tone="muted" />
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
            {dish.restaurant.name}
          </Text>
        </View>
        <Text variant="body-lg" numberOfLines={2} className="min-h-11">
          {dish.name}
        </Text>
        <Text variant="price">{formatVND(dish.price)}</Text>
      </Pressable>
      {open && (
        <IconButton
          icon="add"
          accessibilityLabel={`Thêm ${dish.name} vào giỏ`}
          variant="surface"
          className="absolute right-2 top-28"
          onPress={() => onAdd(dish)}
        />
      )}
    </View>
  );
});
DishCard.displayName = 'DishCard';
