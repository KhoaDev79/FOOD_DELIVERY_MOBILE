import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Logo màn khởi động: ô chữ Z nảy lên rồi đáp xuống (nén nhẹ khi chạm đất),
// sau đó từng chữ "ZomZom" nhảy lần lượt như làn sóng. Chỉ để trang trí, không có logic.
// Khi hệ điều hành bật giảm chuyển động (reduced = true) thì đứng yên.
//
// Quy ước để chạy đúng trên iOS: mỗi Animated.View chỉ nhận MỘT style hoạt hình (không dùng
// mảng style, không className); hình dạng nằm ở View con bằng className.

const CYCLE = 1600; // một nhịp nảy của logo và làn sóng chữ (ms)
const UP = Easing.out(Easing.quad);
const DOWN = Easing.in(Easing.quad);
const LETTERS = ['Z', 'o', 'm', 'Z', 'o', 'm'];

const useBounceLoop = (reduced: boolean) => {
  const lift = useSharedValue(0); // 0 = trên mặt đất, 1 = đỉnh nảy
  const squash = useSharedValue(0); // 1 = đang nén khi chạm đất

  useEffect(() => {
    if (reduced) return;
    lift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: UP }),
        withTiming(0, { duration: 300, easing: DOWN }),
        withTiming(0, { duration: CYCLE - 600 }),
      ),
      -1,
    );
    squash.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 600 }),
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 200, easing: UP }),
        withTiming(0, { duration: CYCLE - 890 }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(lift);
      cancelAnimation(squash);
    };
  }, [lift, reduced, squash]);

  return { lift, squash };
};

/** Một chữ trong "ZomZom": nhảy lên theo lượt, lệch nhịp với chữ bên cạnh. */
const BouncingLetter: React.FC<{ char: string; index: number; reduced: boolean }> = ({ char, index, reduced }) => {
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.value = withDelay(
      560 + index * 70,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 220, easing: UP }),
          withTiming(0, { duration: 260, easing: Easing.bounce }),
          withTiming(0, { duration: CYCLE - 480 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(y);
  }, [index, reduced, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 * y.value }, { rotate: `${(index % 2 ? 4 : -4) * y.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Text className="font-display text-[44px] leading-[70px] text-white">{char}</Text>
    </Animated.View>
  );
};

const LogoTile: React.FC<{ lift: SharedValue<number>; squash: SharedValue<number> }> = ({ lift, squash }) => {
  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -16 * lift.value },
      { scaleX: 1 + 0.08 * squash.value },
      { scaleY: 1 - 0.08 * squash.value },
      { rotate: `${-6 * lift.value}deg` },
    ],
  }));
  // Chấm cam nảy cao hơn ô một chút cho vui mắt.
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * lift.value }, { scale: 1 + 0.25 * lift.value }],
  }));
  // Bóng dưới ô: thu nhỏ và mờ đi khi ô bay lên.
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lift.value, [0, 1], [1, 0.45]),
    transform: [{ scaleX: interpolate(lift.value, [0, 1], [1, 0.6]) }],
  }));

  return (
    <View className="items-center">
      <Animated.View style={tileStyle}>
        <View className="h-24 w-24 items-center justify-center rounded-[28px] border-4 border-white/20 bg-intro-teal shadow-float">
          {/* Chiều cao dòng = chiều cao tự nhiên của Baloo 2 (1,6 × cỡ chữ) để chữ Z nằm đúng giữa ô. */}
          <Text className="font-display text-[64px] leading-[102px] text-intro-on-teal">Z</Text>
          <View className="absolute right-[17px] top-[19px]">
            <Animated.View style={dotStyle}>
              <View className="h-3.5 w-3.5 rounded-full bg-intro-orange" />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
      <View className="mt-3">
        <Animated.View style={shadowStyle}>
          <View className="h-2 w-16 rounded-full bg-black/20" />
        </Animated.View>
      </View>
    </View>
  );
};

export const SplashLogo: React.FC<{ reduced: boolean }> = ({ reduced }) => {
  const { lift, squash } = useBounceLoop(reduced);

  return (
    <View className="items-center">
      <View aria-hidden>
        <LogoTile lift={lift} squash={squash} />
      </View>

      {/* Trình đọc màn hình đọc cả chữ "ZomZom"; từng chữ lẻ bị ẩn. */}
      <View accessible accessibilityRole="header" accessibilityLabel="ZomZom" className="mt-2 flex-row">
        {LETTERS.map((char, i) => (
          <View key={i} aria-hidden>
            <BouncingLetter char={char} index={i} reduced={reduced} />
          </View>
        ))}
      </View>
    </View>
  );
};
