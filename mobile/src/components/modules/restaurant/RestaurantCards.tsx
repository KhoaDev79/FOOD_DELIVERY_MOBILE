import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppImage, Badge, cn, Icon, InfoChip, Text } from '../../ui';
import { Restaurant } from '../../../types/api';
import { calculateDeliveryFee, estimateDeliveryTime } from '../../../utils/fee';
import { formatDistance, formatVND } from '../../../utils/format';

/** Mọi thông tin trên thẻ đều lấy từ dữ liệu quán hoặc tính từ khoảng cách. */
const useMeta = (r: Restaurant) => {
  const distance = formatDistance(r.distanceKm);
  const time = r.distanceKm !== undefined ? estimateDeliveryTime(r.distanceKm) : null;
  const fee = r.distanceKm !== undefined ? calculateDeliveryFee(r.distanceKm).fee : null;
  const rating =
    r.rating > 0 ? r.rating.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  const hours = r.openTime && r.closeTime ? `giờ mở cửa ${r.openTime} đến ${r.closeTime}` : null;
  const a11y = [
    r.name,
    rating && `${rating} sao`,
    distance,
    time && `giao khoảng ${time}`,
    hours,
    !r.isOpen && 'đã đóng cửa',
  ]
    .filter(Boolean)
    .join(', ');
  return { distance, time, fee, rating, a11y };
};

const ClosedOverlay: React.FC = () => (
  <View className="absolute inset-0 items-center justify-center bg-scrim">
    <Badge label="Đã đóng cửa" tone="neutral" />
  </View>
);

interface CardProps {
  restaurant: Restaurant;
  onPress: (r: Restaurant) => void;
  className?: string;
}

/** Ô vuông có điểm đánh giá đè lên ảnh (ảnh mẫu 3, 4 – khối "Gợi ý"). */
export const RestaurantTile = memo<CardProps>(({ restaurant: r, onPress, className }) => {
  const m = useMeta(r);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.a11y}
      onPress={() => onPress(r)}
      className={cn('w-32 gap-2 active:opacity-80', className)}
    >
      <AppImage uri={r.imageUrl} className="h-32 w-32 rounded-lg">
        {m.rating && <Badge label={m.rating} icon="star" tone="scrim" className="absolute bottom-2 left-2" />}
        {!r.isOpen && <ClosedOverlay />}
      </AppImage>
      <View className="gap-0.5">
        <Text variant="body" weight="medium" numberOfLines={2}>
          {r.name}
        </Text>
        {m.distance && (
          <View className="flex-row items-center gap-1">
            <Icon name="navigate-outline" size="xs" tone="muted" />
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
              {m.distance}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});
RestaurantTile.displayName = 'RestaurantTile';

/** Thẻ dọc ảnh vuông lớn + hàng chip (ảnh mẫu 5). */
export const RestaurantCardVertical = memo<CardProps>(({ restaurant: r, onPress, className }) => {
  const m = useMeta(r);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.a11y}
      onPress={() => onPress(r)}
      className={cn('w-40 gap-2 active:opacity-80', className)}
    >
      <AppImage uri={r.imageUrl} className="h-40 w-40 rounded-lg">
        {m.time && <Badge label={m.time} icon="time-outline" tone="brand" className="absolute bottom-2 left-2" />}
        {!r.isOpen && <ClosedOverlay />}
      </AppImage>
      <Text variant="body-lg" weight="medium" numberOfLines={2}>
        {r.name}
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        {m.rating && (
          <View className="flex-row items-center gap-1">
            <Icon name="star" size="xs" tone="rating" />
            <Text variant="caption" weight="medium">
              {m.rating}
            </Text>
          </View>
        )}
        {m.distance && (
          <Text variant="caption" weight="regular" tone="secondary">
            {m.distance}
          </Text>
        )}
      </View>
      {m.fee !== null && <InfoChip label={`Ship ${formatVND(m.fee)}`} tone="freeship" icon="cube-outline" />}
    </Pressable>
  );
});
RestaurantCardVertical.displayName = 'RestaurantCardVertical';

/** Thẻ ngang thumbnail + thông tin (ảnh mẫu 6, 7 – "Quán gần tôi"). */
export const RestaurantRow = memo<CardProps>(({ restaurant: r, onPress, className }) => {
  const m = useMeta(r);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={m.a11y}
      onPress={() => onPress(r)}
      // Viền xanh nhạt; rê chuột (web) hoặc chạm (điện thoại) thì viền và nền chuyển xanh ngọc.
      className={cn(
        'flex-row gap-3 rounded-lg border border-brand-100 bg-surface p-3 shadow-card',
        'hover:border-brand-400 hover:bg-brand-50 active:border-brand-500 active:bg-brand-100',
        className,
      )}
    >
      <AppImage uri={r.imageUrl} className="h-28 w-28 rounded-md">
        {!r.isOpen && <ClosedOverlay />}
      </AppImage>
      <View className="flex-1 justify-center gap-2">
        <Text variant="body-lg" weight="semibold" numberOfLines={2}>
          {r.name}
        </Text>
        <View className="gap-1.5">
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {m.rating && (
              <View className="flex-row items-center gap-1">
                <Icon name="star" size="xs" tone="rating" />
                <Text variant="caption" weight="medium">
                  {m.rating}
                </Text>
              </View>
            )}
            {m.distance && (
              <View className="flex-row items-center gap-1">
                <Icon name="navigate-outline" size="xs" tone="brand" />
                <Text variant="caption" weight="regular" tone="secondary">
                  {m.distance}
                </Text>
              </View>
            )}
            {m.time && (
              <View className="flex-row items-center gap-1" accessibilityLabel={`Giao khoảng ${m.time}`}>
                <Icon name="bicycle-outline" size="xs" tone="brand" />
                <Text variant="caption" weight="regular" tone="secondary">
                  {m.time}
                </Text>
              </View>
            )}
          </View>
          {/* Khung giờ hoạt động của quán (openTime – closeTime từ API) */}
          {r.openTime && r.closeTime && (
            <View className="flex-row items-center gap-1">
              <Icon name="time-outline" size="xs" tone={r.isOpen ? 'success' : 'danger'} />
              <Text variant="caption" weight="medium" tone={r.isOpen ? 'success' : 'danger'}>
                {r.isOpen ? 'Mở cửa' : 'Đã đóng'}
              </Text>
              <Text variant="caption" weight="regular" tone="secondary">
                · {r.openTime} - {r.closeTime}
              </Text>
            </View>
          )}
          {m.fee !== null && <InfoChip label={`Ship ${formatVND(m.fee)}`} tone="freeship" icon="cube-outline" />}
        </View>
      </View>
    </Pressable>
  );
});
RestaurantRow.displayName = 'RestaurantRow';
