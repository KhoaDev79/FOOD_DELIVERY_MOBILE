import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { useNow } from '../../../hooks/useNow';
import { MenuItem } from '../../../types/api';
import { getDishAvailabilityStatus } from '../../../utils/dishAvailability';
import { formatVND } from '../../../utils/format';
import { discountPercent, linePrice, originalLinePrice } from '../../../utils/menuPricing';
import { AppImage, Badge, cn, IconButton, Text } from '../../ui';

/** Giá hiện tại + giá gốc gạch ngang khi có giảm giá (đúng giá backend sẽ tính). */
export const DishPrice: React.FC<{ item: MenuItem; size?: 'md' | 'lg' }> = ({ item, size = 'md' }) => {
  const now = linePrice(item);
  const before = originalLinePrice(item);
  return (
    <View className="flex-row items-baseline gap-1.5">
      <Text variant={size === 'lg' ? 'title' : 'body-lg'} weight="bold" tone="brand">
        {formatVND(now)}
      </Text>
      {before > now && (
        <Text variant="caption" weight="regular" tone="muted" className="line-through">
          {formatVND(before)}
        </Text>
      )}
    </View>
  );
};

interface Props {
  item: MenuItem;
  /** Quán đang mở thì mới cho thêm món. */
  canOrder: boolean;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}

/** Dòng món trong thực đơn quán: ảnh, nhãn giảm giá, tên, mô tả, giá, nút "+" (phần tử ngang hàng). */
export const DishRow = memo<Props>(({ item, canOrder, onOpen, onAdd }) => {
  const now = useNow();
  const off = discountPercent(item);
  const available = item.isAvailable;
  const availability = getDishAvailabilityStatus(item, now);
  const isAvailableNow = available && availability.isAvailableNow;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[
          item.name,
          formatVND(linePrice(item)),
          !available && 'tạm hết',
          !isAvailableNow && availability.tag,
        ]
          .filter(Boolean)
          .join(', ')}
        onPress={() => onOpen(item)}
        disabled={!available}
        className={cn(
          'flex-row gap-3 rounded-lg bg-surface p-3 shadow-card hover:bg-brand-50 active:bg-brand-50',
          (!available || !isAvailableNow) && 'opacity-70',
        )}
      >
        <AppImage uri={item.imageUrl} className="h-24 w-24 rounded-md" fallbackIcon="fast-food-outline">
          {off > 0 && <Badge label={`-${off}%`} tone="discount" size="sm" className="absolute left-1.5 top-1.5" />}
          {!available ? (
            <View className="absolute inset-0 items-center justify-center bg-scrim">
              <Badge label="Tạm hết" tone="neutral" size="sm" />
            </View>
          ) : !isAvailableNow && availability.tag ? (
            <View className="absolute inset-0 items-center justify-center bg-scrim px-1">
              <Badge label={availability.tag} tone="warning" size="sm" />
            </View>
          ) : null}
        </AppImage>
        <View className="flex-1 justify-center gap-1 pr-10">
          <Text variant="body-lg" weight="semibold" numberOfLines={2}>
            {item.name}
          </Text>
          {!!item.description && (
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          {availability.isTimedDish && (
            <Text
              variant="micro"
              weight="medium"
              tone={isAvailableNow ? 'muted' : 'accent'}
              numberOfLines={1}
            >
              {isAvailableNow ? `Khung giờ: ${availability.servingTimeLabel}` : `⏰ ${availability.tag}`}
            </Text>
          )}
          <DishPrice item={item} />
        </View>
      </Pressable>
      {isAvailableNow && canOrder && (
        <IconButton
          icon="add"
          variant="brand"
          size="sm"
          accessibilityLabel={`Thêm ${item.name}`}
          className="absolute bottom-3 right-3"
          onPress={() => onAdd(item)}
        />
      )}
    </View>
  );
});
DishRow.displayName = 'DishRow';
