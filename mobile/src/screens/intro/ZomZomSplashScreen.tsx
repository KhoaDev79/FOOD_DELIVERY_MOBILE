import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gradient } from '../../components/ui';
import { palette } from '../../theme';
import { SplashLogo } from './SplashLogo';

// Bề rộng thanh tải (w-44), dùng để tính vị trí trượt của thanh và xe.
const TRACK_WIDTH = 176;

interface ZomZomSplashScreenProps {
  onFinish: () => void;
}

export const ZomZomSplashScreen: React.FC<ZomZomSplashScreenProps> = ({ onFinish }) => {
  const [loadingText, setLoadingText] = useState('Đang chuẩn bị thực đơn…');
  const progressWidth = useSharedValue(0);
  const scooterTranslateY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Hiệu ứng xe nhún bồng bềnh nhẹ nhàng
    scooterTranslateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    // Hiệu ứng vòng sóng xung quanh nút tiếp tục
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 900, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      true,
    );

    // Thanh tiến trình loading 0 -> 100% trong 2.5s
    progressWidth.value = withTiming(100, {
      duration: 2500,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    const t1 = setTimeout(() => {
      setLoadingText('Đang nạp thực đơn nóng hổi…');
    }, 800);

    const t2 = setTimeout(() => {
      setLoadingText('Sẵn sàng thưởng thức cùng ZomZom!');
    }, 1700);

    const t3 = setTimeout(() => {
      onFinish();
    }, 2600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish, progressWidth, pulseScale, scooterTranslateY]);

  // Hiển thị: thanh đã nạp trượt vào theo đúng giá trị tiến trình có sẵn (không tính giá trị mới).
  // Mọi giá trị nằm trong một style hoạt hình duy nhất để chạy đúng trên iOS (xem ghi chú ở JSX).
  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: TRACK_WIDTH,
    height: 6,
    backgroundColor: palette.surface,
    transform: [{ translateX: (progressWidth.value / 100 - 1) * TRACK_WIDTH }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 0.35,
  }));

  // Chỉ để trang trí: xe chạy theo đúng giá trị tiến trình đang có, không tính giá trị mới.
  // top 4: bánh xe (đáy hình ở y=19/24, cách đáy biểu tượng 28 điểm ~6 điểm) chạm mặt trên của thanh.
  const animatedRiderStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 4,
    left: -14,
    transform: [{ translateX: (progressWidth.value / 100) * TRACK_WIDTH }],
  }));

  // Tôn trọng cài đặt giảm chuyển động: tắt vòng sóng và hiệu ứng nảy của logo.
  const reduceMotion = useReducedMotion();

  // Ghi chú: Animated.View đã đăng ký với NativeWind (src/theme/interop.ts). Trên iOS, phần tĩnh
  // trong mảng style bị bỏ, nên mỗi Animated.View ở đây chỉ nhận MỘT style hoạt hình;
  // hình dạng đặt ở View con bằng className.
  return (
    <Gradient preset="splash" className="flex-1 overflow-hidden bg-brand-800">
      <StatusBar style="light" />

      {/* Quầng sáng sau logo, chỉ trang trí */}
      <Gradient preset="splashGlow" aria-hidden pointerEvents="none" className="absolute inset-0" />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* Logo, tên và khẩu hiệu ở giữa, phía sau là các vòng tròn đồng tâm */}
        <View className="flex-1 items-center justify-center">
          <View aria-hidden pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="absolute h-[620px] w-[620px] rounded-full border border-white/5" />
            <View className="absolute h-[440px] w-[440px] rounded-full border border-white/10" />
            <View className="absolute h-[290px] w-[290px] rounded-full border border-white/15" />
            {!reduceMotion && (
              <View className="absolute">
                <Animated.View style={animatedPulseStyle}>
                  <View className="h-[290px] w-[290px] rounded-full border-2 border-white" />
                </Animated.View>
              </View>
            )}
            {/* Chấm trang trí rải quanh các vòng */}
            <View className="absolute h-[440px] w-[440px]">
              <View className="absolute left-[64px] top-[58px] h-2.5 w-2.5 rounded-full bg-intro-orange" />
              <View className="absolute right-[34px] top-[170px] h-2 w-2 rounded-full bg-white/60" />
              <View className="absolute bottom-[66px] right-[92px] h-3 w-3 rounded-full bg-intro-orange" />
              <View className="absolute bottom-[150px] left-[22px] h-2 w-2 rounded-full bg-brand-200" />
            </View>
          </View>

          <Animated.View
            entering={FadeInDown.duration(700).reduceMotion(ReduceMotion.System)}
            className="items-center"
          >
            <SplashLogo reduced={reduceMotion} />

            <Text className="font-body-semibold text-body-lg text-brand-50">
              Món ngon, giao tận cửa
            </Text>
          </Animated.View>
        </View>

        {/* Thanh tải gọn: xe giao hàng chạy dọc theo phần đã nạp */}
        <Animated.View
          entering={FadeIn.delay(300).duration(600).reduceMotion(ReduceMotion.System)}
          className="items-center pb-12"
        >
          <View aria-hidden className="w-44">
            {/* Hàng riêng cho xe, nằm ngay trên thanh */}
            <View className="h-[26px]">
              <Animated.View style={animatedRiderStyle}>
                <MaterialCommunityIcons name="moped" size={28} color={palette.intro.orange} />
              </Animated.View>
            </View>
            <View className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <Animated.View style={animatedProgressStyle} />
            </View>
          </View>

          <Text
            accessibilityLiveRegion="polite"
            className="mt-2.5 font-body-medium text-caption text-brand-50"
          >
            {loadingText}
          </Text>
        </Animated.View>
      </SafeAreaView>
    </Gradient>
  );
};
