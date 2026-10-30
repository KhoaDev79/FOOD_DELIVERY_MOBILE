import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { cn } from './cn';

/**
 * Khối chờ nhấp nháy nhẹ. NGOẠI LỆ style: độ mờ là giá trị hoạt hình (Reanimated),
 * không biểu diễn được bằng className. Tắt nhấp nháy khi người dùng bật "giảm chuyển động".
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(withTiming(0.5, { duration: 450, reduceMotion: ReduceMotion.System }), -1, true);
  }, [opacity, reduced]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View className={cn('rounded-md bg-line-subtle', className)} style={animated} />;
};

/** Khung chờ cho thẻ quán ngang (ảnh mẫu 6). */
export const RestaurantRowSkeleton: React.FC = () => (
  <View className="flex-row gap-3 rounded-lg bg-surface p-3">
    <Skeleton className="h-28 w-28 rounded-md" />
    <View className="flex-1 gap-2 py-1">
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="mt-auto h-3 w-2/5" />
      <Skeleton className="h-5 w-1/2" />
    </View>
  </View>
);

/** Khung chờ cho thẻ dọc vuông (ảnh mẫu 3, 5). */
export const TileSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <View className={cn('w-40 gap-2', className)}>
    <Skeleton className="h-40 w-40 rounded-lg" />
    <Skeleton className="h-4 w-4/5" />
    <Skeleton className="h-3 w-1/2" />
  </View>
);
