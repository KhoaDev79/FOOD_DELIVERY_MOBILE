import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppImage, cn, Gradient, Skeleton, Text } from '../../ui';
import { Banner } from '../../../types/api';

const GAP = 12;
const SIDE = 16;
const AUTO_MS = 4000;
const RATIO = 2.4; // rộng : cao, gần banner ảnh mẫu 3

interface Props {
  banners: Banner[];
  onPress?: (b: Banner) => void;
  /** Banner có hành động mở được hay không; banner không bấm được thì là ảnh thường. */
  canPress?: (b: Banner) => boolean;
}

/**
 * Carousel banner tự chuyển (ảnh mẫu 1, 3).
 * - Tự chuyển mỗi 4 giây, dừng khi người dùng đang kéo; quay lại banner đầu khi hết.
 * - Không tự chuyển khi hệ điều hành bật "giảm chuyển động".
 * NGOẠI LỆ style: kích thước từng banner phụ thuộc chiều rộng màn hình (useWindowDimensions),
 * là giá trị động nên đặt qua style; phần còn lại dùng className.
 */
export const BannerCarousel: React.FC<Props> = ({ banners, onPress, canPress }) => {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);
  const dragging = useRef(false);

  const slideW = Math.min(width, 520) - SIDE * 2;
  const slideH = Math.round(slideW / RATIO);
  const step = slideW + GAP;

  const goTo = useCallback(
    (i: number) => {
      listRef.current?.scrollToOffset({ offset: i * step, animated: !reduced });
      setIndex(i);
    },
    [step, reduced],
  );

  useEffect(() => {
    if (reduced || banners.length < 2) return;
    const t = setInterval(() => {
      if (!dragging.current) goTo((index + 1) % banners.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [index, banners.length, reduced, goTo]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    setIndex(Math.max(0, Math.min(banners.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
  };

  if (banners.length === 0) return null;

  return (
    <View accessibilityRole="adjustable" accessibilityLabel="Banner khuyến mãi">
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerClassName="gap-3 px-4"
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        renderItem={({ item, index: i }) => {
          const pressable = !!onPress && (canPress ? canPress(item) : true);
          return (
            <Pressable
              accessibilityRole={pressable ? 'button' : 'image'}
              accessibilityLabel={`${item.title}. Banner ${i + 1} trên ${banners.length}`}
              disabled={!pressable}
              onPress={() => onPress?.(item)}
              className="overflow-hidden rounded-lg active:opacity-90"
              style={{ width: slideW, height: slideH }}
            >
              <AppImage uri={item.imageUrl} className="absolute inset-0" fallbackIcon="pricetags-outline" />
              {/* Lớp tối phía dưới để chữ luôn đọc được trên ảnh */}
              <Gradient preset="imageScrim" className="absolute bottom-0 left-0 right-0 h-3/5 justify-end px-4 pb-8">
                <Text variant="headline" weight="bold" tone="inverse" numberOfLines={2}>
                  {item.title}
                </Text>
              </Gradient>
            </Pressable>
          );
        }}
      />
      {/* Chấm chỉ trang nằm trong ảnh, ở giữa mép dưới banner đang hiển thị */}
      {banners.length > 1 && (
        <View
          pointerEvents="none"
          className="absolute bottom-3 left-4 right-4 flex-row items-center justify-center gap-1.5"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {banners.map((b, i) => (
            <View
              key={b.id}
              className={cn('h-1.5 rounded-full', i === index ? 'w-5 bg-surface' : 'w-1.5 bg-surface opacity-50')}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const BannerSkeleton: React.FC = () => (
  <View className="px-4">
    <Skeleton className="h-36 w-full rounded-lg" />
  </View>
);
