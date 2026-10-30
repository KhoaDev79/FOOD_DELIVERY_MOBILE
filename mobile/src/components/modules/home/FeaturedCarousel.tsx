import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { AppImage, Gradient, Icon, Text } from '../../ui';
import { Restaurant } from '../../../types/api';
import { formatDistance } from '../../../utils/format';

const GAP = 12;
const AUTO_MS = 4000;
const SIDE_SCALE = 0.86;

const FeaturedCard: React.FC<{
  restaurant: Restaurant;
  index: number;
  width: number;
  step: number;
  scrollX: SharedValue<number>;
  reduced: boolean;
  onPress: (r: Restaurant) => void;
}> = ({ restaurant: r, index, width, step, scrollX, reduced, onPress }) => {
  // NGOẠI LỆ style: độ phóng to phụ thuộc vị trí cuộn (giá trị hoạt hình).
  const animated = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ scale: 1 }] };
    const scale = interpolate(
      scrollX.value,
      [(index - 1) * step, index * step, (index + 1) * step],
      [SIDE_SCALE, 1, SIDE_SCALE],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });
  const rating = r.rating.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const distance = formatDistance(r.distanceKm);

  return (
    // NGOẠI LỆ style: chiều rộng thẻ tính từ chiều rộng khung (giá trị động).
    <Animated.View style={[{ width }, animated]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${r.name}, ${rating} sao${distance ? `, cách ${distance}` : ''}`}
        onPress={() => onPress(r)}
        className="overflow-hidden rounded-xl bg-surface shadow-card active:opacity-90"
      >
        <AppImage uri={r.imageUrl} className="aspect-square w-full" fallbackIcon="restaurant-outline">
          {!r.isOpen && (
            <View className="absolute inset-0 items-center justify-center bg-scrim">
              <Text variant="caption" tone="inverse">
                Đã đóng cửa
              </Text>
            </View>
          )}
        </AppImage>
        <View className="min-h-20 gap-1 px-3 pb-3 pt-3">
          <Text variant="body-lg" weight="medium" numberOfLines={2}>
            {r.name}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon name="star" size="xs" tone="rating" />
            <Text variant="caption" weight="medium">
              {rating}
            </Text>
            {distance && (
              <Text variant="caption" weight="regular" tone="secondary">
                · {distance}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

/**
 * Khối "Quán được yêu thích" theo bố cục ảnh mẫu "Giật Deal Sốc":
 * khung bo 24 nền kem, tiêu đề có icon, thẻ ở giữa phóng to, thẻ hai bên nhỏ lại (không có viền chấm tròn).
 * Dữ liệu: các quán điểm cao nhất (không hứa khuyến mãi).
 */
export const FeaturedCarousel: React.FC<{
  title: string;
  restaurants: Restaurant[];
  onPress: (r: Restaurant) => void;
}> = ({ title, restaurants, onPress }) => {
  const reduced = useReducedMotion();
  const scrollX = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();
  const [frameW, setFrameW] = useState(0);
  const centered = useRef(false);
  const dragging = useRef(false);
  const [index, setIndex] = useState(0);

  const cardW = Math.round(frameW * 0.5);
  const step = cardW + GAP;
  const sidePad = Math.max(0, (frameW - cardW) / 2);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  // Mở đầu với thẻ thứ hai ở giữa (như mẫu) khi có từ 3 quán.
  useEffect(() => {
    if (!frameW || centered.current || restaurants.length < 3) return;
    centered.current = true;
    requestAnimationFrame(() => ref.current?.scrollTo({ x: step, animated: false }));
    setIndex(1);
  }, [frameW, step, restaurants.length, ref]);

  // Tự chuyển như banner: mỗi 4 giây, dừng khi người dùng đang kéo, hết thì quay lại thẻ đầu.
  // Không tự chuyển khi hệ điều hành bật "giảm chuyển động".
  useEffect(() => {
    if (reduced || !frameW || restaurants.length < 2) return;
    const t = setInterval(() => {
      if (dragging.current) return;
      const next = (index + 1) % restaurants.length;
      ref.current?.scrollTo({ x: next * step, animated: true });
      setIndex(next);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [index, reduced, frameW, step, restaurants.length, ref]);

  if (restaurants.length === 0) return null;

  return (
    <View className="px-4">
      <Gradient preset="dealFrame" className="overflow-hidden rounded-2xl pb-5 pt-5">
        <View className="mb-3 flex-row items-center gap-2 px-5">
          <Icon name="flame" size="md" tone="accent" />
          <Text variant="title" accessibilityRole="header" numberOfLines={1} className="flex-1">
            {title}
          </Text>
        </View>
        <View onLayout={(e: LayoutChangeEvent) => setFrameW(e.nativeEvent.layout.width)}>
          {frameW > 0 && (
            <Animated.ScrollView
              ref={ref}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              disableIntervalMomentum
              onScroll={onScroll}
              onScrollBeginDrag={() => {
                dragging.current = true;
              }}
              onMomentumScrollEnd={(e) => {
                dragging.current = false;
                const i = Math.round(e.nativeEvent.contentOffset.x / step);
                setIndex(Math.max(0, Math.min(restaurants.length - 1, i)));
              }}
              scrollEventThrottle={16}
              // NGOẠI LỆ style: lề hai bên để thẻ đầu/cuối nằm giữa khung, tính từ chiều rộng đo được.
              contentContainerStyle={{ paddingHorizontal: sidePad, gap: GAP, alignItems: 'center' }}
            >
              {restaurants.map((r, i) => (
                <FeaturedCard
                  key={r.id}
                  restaurant={r}
                  index={i}
                  width={cardW}
                  step={step}
                  scrollX={scrollX}
                  reduced={reduced}
                  onPress={onPress}
                />
              ))}
            </Animated.ScrollView>
          )}
        </View>
      </Gradient>
    </View>
  );
};
