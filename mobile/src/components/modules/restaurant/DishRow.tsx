import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { MenuItem } from '../../../types/api';
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
  const off = discountPercent(item);
  const available = item.isAvailable;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[item.name, formatVND(linePrice(item)), !available && 'tạm hết'].filter(Boolean).join(', ')}
        onPress={() => onOpen(item)}
        disabled={!available}
        className={cn(
          'flex-row gap-3 rounded-lg bg-surface p-3 shadow-card hover:bg-brand-50 active:bg-brand-50',
          !available && 'opacity-60',
        )}
      >
        <AppImage uri={item.imageUrl} className="h-24 w-24 rounded-md" fallbackIcon="fast-food-outline">
          {off > 0 && <Badge label={`-${off}%`} tone="discount" size="sm" className="absolute left-1.5 top-1.5" />}
          {!available && (
            <View className="absolute inset-0 items-center justify-center bg-scrim">
              <Badge label="Tạm hết" tone="neutral" size="sm" />
            </View>
          )}
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
          <DishPrice item={item} />
        </View>
      </Pressable>
      {available && canOrder && (
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
