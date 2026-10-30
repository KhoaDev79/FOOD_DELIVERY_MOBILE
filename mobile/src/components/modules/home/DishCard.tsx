import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppImage, Badge, cn, Icon, IconButton, Text } from '../../ui';
import { NearbyDish } from '../../../types/api';
import { formatDistance, formatVND } from '../../../utils/format';
import { discountPercent, linePrice, originalLinePrice } from '../../../utils/menuPricing';

/**
 * Ô món nhỏ cho lưới 2 hàng (ảnh mẫu "Gợi ý dành cho …"): ảnh vuông bo 16, nhãn giá đè góc dưới trái
 * trên nền tối mờ, tên món 2 dòng, dòng khoảng cách + tên quán.
 * Món không có điểm đánh giá riêng nên nhãn trên ảnh là giá (không mượn điểm của quán).
 */
export const DishTile = memo<{ dish: NearbyDish; onPress: (d: NearbyDish) => void; className?: string }>(
  ({ dish, onPress, className }) => {
    const distance = formatDistance(dish.restaurant.distanceKm);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${dish.name}, ${formatVND(linePrice(dish))}, quán ${dish.restaurant.name}${distance ? `, cách ${distance}` : ''}`}
        onPress={() => onPress(dish)}
        className={cn('w-32 gap-1.5 active:opacity-80', className)}
      >
        <AppImage uri={dish.imageUrl} className="h-32 w-32 rounded-lg" fallbackIcon="fast-food-outline">
          <Badge label={formatVND(linePrice(dish))} tone="scrim" size="sm" className="absolute bottom-1.5 left-1.5" />
          {!dish.restaurant.isOpen && (
            <View className="absolute inset-0 items-center justify-center bg-scrim">
              <Badge label="Quán đã đóng" tone="neutral" />
            </View>
          )}
        </AppImage>
        <Text variant="body" weight="medium" numberOfLines={2} className="min-h-10">
          {dish.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon name="navigate-outline" size="xs" tone="muted" />
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
            {[distance, dish.restaurant.name].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Pressable>
    );
  },
);
DishTile.displayName = 'DishTile';

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
  const r = dish.restaurant;
  const open = r.isOpen;
  const distance = formatDistance(r.distanceKm);
  const rating =
    r.rating > 0 ? r.rating.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  return (
    <View className={cn('w-40', className)}>
      {/* Khung ảnh vuông và nút "+" nằm gọn bên trong góc dưới phải của ảnh */}
      <View className="relative h-40 w-40 overflow-hidden rounded-lg">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[
            dish.name,
            formatVND(linePrice(dish)),
            `quán ${r.name}`,
            rating && `quán ${rating} sao`,
            distance && `cách ${distance}`,
          ]
            .filter(Boolean)
            .join(', ')}
          onPress={() => onPress(dish)}
          className="h-full w-full active:opacity-80"
        >
          <AppImage uri={dish.imageUrl} className="h-full w-full" fallbackIcon="fast-food-outline">
            {/* Nhãn giảm giá như ảnh mẫu "Bữa Ăn 29K" – chỉ khi backend thật sự áp giá giảm */}
            {discountPercent(dish) > 0 && (
              <Badge
                label={`Giảm ${discountPercent(dish)}%`}
                tone="discount"
                size="sm"
                className="absolute left-0 top-0 rounded-none rounded-br-md"
              />
            )}
            {!open && (
              <View className="absolute inset-0 items-center justify-center bg-scrim">
                <Badge label="Quán đã đóng" tone="neutral" />
              </View>
            )}
          </AppImage>
        </Pressable>
        {open && (
          <IconButton
            icon="add"
            accessibilityLabel={`Thêm ${dish.name} vào giỏ`}
            variant="glass"
            size="sm"
            className="absolute bottom-2 right-2"
            style={{ position: 'absolute', bottom: 8, right: 8 }}
            onPress={() => onAdd(dish)}
          />
        )}
      </View>

      <Pressable onPress={() => onPress(dish)} className="mt-1 gap-1 active:opacity-80">
        <View className="flex-row items-center gap-1">
          <Icon name="storefront-outline" size="xs" tone="muted" />
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
            {r.name}
          </Text>
        </View>
        <Text variant="body-lg" numberOfLines={2} className="min-h-11">
          {dish.name}
        </Text>
        {/* Điểm là của quán (món chưa có đánh giá riêng), đặt cạnh khoảng cách tới quán. */}
        {(rating || distance) && (
          <View className="flex-row items-center gap-2">
            {rating && (
              <View className="flex-row items-center gap-0.5">
                <Icon name="star" size={12} tone="rating" />
                <Text variant="caption" weight="medium">
                  {rating}
                </Text>
              </View>
            )}
            {distance && (
              <View className="flex-row items-center gap-0.5">
                <Icon name="navigate-outline" size={12} tone="brand" />
                <Text variant="caption" weight="regular" tone="secondary">
                  {distance}
                </Text>
              </View>
            )}
          </View>
        )}
        <View className="flex-row items-baseline gap-1.5">
          <Text variant="body-lg" weight="semibold" tone="brand">
            {formatVND(linePrice(dish))}
          </Text>
          {originalLinePrice(dish) > linePrice(dish) && (
            <Text variant="caption" weight="regular" tone="muted" className="line-through">
              {formatVND(originalLinePrice(dish))}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
});
DishCard.displayName = 'DishCard';
