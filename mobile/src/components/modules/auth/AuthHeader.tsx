import React from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gradient, Icon, Text } from '../../ui';

/**
 * Đầu trang của Đăng nhập / Đăng ký: gọn (~22% màn hình) để form nằm cao, dễ thấy nút chính
 * khi bàn phím bật. Logo chữ Z cùng kiểu màn khởi động, đặt cạnh tên ZomZom.
 */
export const AuthHeader: React.FC<{ title: string; subtitle: string; onBack?: () => void }> = ({
  title,
  subtitle,
  onBack,
}) => (
  <Gradient preset="splash" className="overflow-hidden bg-brand-800 pb-12">
    {/* Vòng tròn trang trí mờ ở góc phải */}
    <View aria-hidden pointerEvents="none" className="absolute -right-24 -top-16">
      <View className="h-[300px] w-[300px] items-center justify-center rounded-full border border-white/10">
        <View className="h-[200px] w-[200px] rounded-full border border-white/10" />
      </View>
    </View>

    <SafeAreaView edges={['top']}>
      <View className="h-touch flex-row items-center px-4">
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={onBack}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-75"
          >
            <Icon name="arrow-back" size={20} tone="inverse" />
          </Pressable>
        )}
      </View>

      <View className="gap-3 px-6 pt-1">
        {/* Logo + tên thương hiệu */}
        <View className="flex-row items-center gap-2.5" aria-hidden>
          <View className="h-11 w-11 items-center justify-center rounded-[14px] border-2 border-white/25 bg-intro-teal">
            <RNText className="font-display text-[28px] leading-[45px] text-intro-on-teal">Z</RNText>
            <View className="absolute right-[7px] top-[8px] h-2 w-2 rounded-full bg-intro-orange" />
          </View>
          <RNText className="font-display text-[22px] leading-[34px] text-white">ZomZom</RNText>
        </View>

        <View className="gap-1">
          <RNText accessibilityRole="header" className="font-display text-[28px] leading-[42px] text-white">
            {title}
          </RNText>
          <Text variant="body" tone="inverse" className="opacity-80">
            {subtitle}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  </Gradient>
);

/** Khung báo lỗi ngay trong form (thay cho hộp thoại Alert). */
export const FormErrorBanner: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <View
    accessibilityLiveRegion="polite"
    className="flex-row items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3"
  >
    <Icon name="alert-circle" size="md" tone="danger" />
    <View className="flex-1 gap-0.5">
      <Text variant="body" weight="semibold" tone="danger">
        {title}
      </Text>
      <Text variant="caption" weight="regular" tone="secondary">
        {message}
      </Text>
    </View>
  </View>
);
