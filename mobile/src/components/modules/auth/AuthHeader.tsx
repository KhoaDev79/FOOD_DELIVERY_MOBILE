import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text as RNText,
  ScrollView,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn, Gradient, Icon, IconName, Text } from '../../ui';
import { palette } from '../../../theme';
import { PasswordStrength } from '../../../utils/password';

/** Cột nội dung tối đa 440px, canh giữa: điện thoại dùng hết bề ngang, máy tính không bị kéo giãn. */
const COLUMN = 'w-full max-w-[440px] self-center';

/**
 * Bong bóng món ăn trôi lên xuống nhẹ ở góc header.
 * iOS: Animated.View chỉ nhận MỘT style hoạt hình; vị trí và hình dạng đặt ở View ngoài / View trong bằng className.
 */
const FloatingFood: React.FC<{ emoji: string; position: string; size: number; delay: number; distance?: number }> = ({
  emoji,
  position,
  size,
  delay,
  distance = 7,
}) => {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const half = { duration: 1700 + delay / 2, easing: Easing.inOut(Easing.sin) };
    offset.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(-distance, half), withTiming(0, half)), -1, false),
    );
  }, [delay, distance, offset, reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View className={cn('absolute', position)}>
      <Animated.View style={floatStyle}>
        <View
          style={{ width: size, height: size }}
          className="items-center justify-center rounded-full border border-white/25 bg-white/15"
        >
          <RNText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</RNText>
        </View>
      </Animated.View>
    </View>
  );
};

/**
 * Đầu trang màn xác thực: gradient xanh ngọc, logo ZomZom, tiêu đề, các món ăn trôi ở góc phải.
 * Thấp hơn bản cũ để form hiện ngay trong màn hình đầu tiên.
 */
export const AuthHeader: React.FC<{ title: string; subtitle: string; onBack?: () => void }> = ({
  title,
  subtitle,
  onBack,
}) => (
  <Gradient preset="authHero" className="overflow-hidden pb-16">
    {/* Trang trí: vòng tròn mờ góc phải, quầng cam góc trái dưới */}
    <View aria-hidden pointerEvents="none" className="absolute -right-20 -top-24 h-[260px] w-[260px] rounded-full border border-white/10" />
    <View aria-hidden pointerEvents="none" className="absolute -bottom-20 -left-10 h-[180px] w-[180px] rounded-full bg-accent-500/20" />

    <SafeAreaView edges={['top']}>
      <View className={cn(COLUMN, 'px-6')}>
        {/* Món ăn trôi: chỉ nằm ở 2 hàng trên (nút quay lại, logo) để không đè lên tiêu đề */}
        <View aria-hidden pointerEvents="none" className="absolute right-4 top-0 h-[104px] w-[168px]">
          <FloatingFood emoji="🍜" size={54} position="right-1 top-1" delay={0} />
          <FloatingFood emoji="🧋" size={40} position="right-[72px] top-[52px]" delay={500} distance={6} />
          <FloatingFood emoji="🍕" size={44} position="right-[112px] top-0" delay={900} />
          <FloatingFood emoji="🍔" size={34} position="right-[2px] top-[68px]" delay={1300} distance={5} />
        </View>

        <View className="h-touch flex-row items-center">
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={onBack}
              hitSlop={4}
              className="-ml-1 h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-75"
            >
              <Icon name="arrow-back" size={20} tone="inverse" />
            </Pressable>
          )}
        </View>

        <View className="gap-3 pt-2">
          {/* Logo + tên thương hiệu */}
          <View className="flex-row items-center gap-2" aria-hidden>
            <View className="h-9 w-9 items-center justify-center rounded-[11px] border-2 border-white/25 bg-intro-teal">
              <RNText className="font-display text-[22px] leading-[36px] text-intro-on-teal">Z</RNText>
              <View className="absolute right-[5px] top-[6px] h-1.5 w-1.5 rounded-full bg-intro-orange" />
            </View>
            <RNText className="font-display text-[19px] leading-[30px] text-white">ZomZom</RNText>
          </View>

          <View className="gap-0.5">
            <RNText accessibilityRole="header" className="font-display text-[28px] leading-[40px] text-white">
              {title}
            </RNText>
            <Text variant="body" tone="inverse" className="opacity-85">
              {subtitle}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  </Gradient>
);

/**
 * Khung chung của màn xác thực: header + thẻ trắng nổi (bo góc, bóng) đè lên header, trượt lên khi mở màn.
 * Phần chân (link chuyển màn) nằm ngay dưới thẻ, không bị đẩy xuống đáy tạo khoảng trống lớn.
 * `contentKey` đổi (vd sang bước khác) thì nội dung thẻ chạy lại hiệu ứng xuất hiện.
 */
export const AuthShell: React.FC<{
  title: string;
  subtitle: string;
  onBack?: () => void;
  footer?: React.ReactNode;
  contentKey?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, onBack, footer, contentKey, children }) => (
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-canvas-subtle">
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-grow"
      keyboardShouldPersistTaps="handled"
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      <AuthHeader title={title} subtitle={subtitle} onBack={onBack} />
      {/* SafeAreaView tự ghi đè padding bằng vùng an toàn → đặt khoảng đệm ở View con */}
      <SafeAreaView edges={['bottom']} className={cn(COLUMN, '-mt-10 flex-1')}>
        <View className="px-4 pb-6">
          <Animated.View
            key={contentKey}
            entering={FadeInDown.duration(380).reduceMotion(ReduceMotion.System)}
            className="rounded-3xl bg-surface px-5 pb-6 pt-6 shadow-float"
          >
            {children}
          </Animated.View>
          {footer ? <View className="pt-5">{footer}</View> : null}
        </View>
      </SafeAreaView>
    </ScrollView>
  </KeyboardAvoidingView>
);

/** Nút chính màn xác thực: gradient xanh ngọc đậm (chữ trắng đủ tương phản), cao 56, bo tròn, có bóng. */
export const AuthSubmitButton: React.FC<{ label: string; loading?: boolean; disabled?: boolean; onPress: () => void }> = ({
  label,
  loading,
  disabled,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: loading || disabled, busy: loading }}
    disabled={loading || disabled}
    onPress={onPress}
    className={cn(
      'h-14 flex-row items-center justify-center gap-2 overflow-hidden rounded-full shadow-glow active:opacity-90',
      (loading || disabled) && 'opacity-70',
    )}
  >
    <Gradient preset="authButton" pointerEvents="none" className="absolute inset-0" />
    {loading ? (
      <ActivityIndicator color={palette.ink.inverse} />
    ) : (
      <>
        <Text variant="body-lg" weight="bold" tone="inverse">
          {label}
        </Text>
        <Icon name="arrow-forward" size={20} tone="inverse" />
      </>
    )}
  </Pressable>
);

/** "Chưa có tài khoản? Đăng ký ngay" dưới thẻ form. */
export const AuthSwitchLink: React.FC<{ question: string; action: string; onPress: () => void }> = ({
  question,
  action,
  onPress,
}) => (
  <View className="flex-row flex-wrap items-center justify-center">
    <Text variant="body" tone="secondary">
      {question}{' '}
    </Text>
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12} className="min-h-touch justify-center">
      <Text variant="body" weight="bold" tone="brand">
        {action}
      </Text>
    </Pressable>
  </View>
);

/** Dòng nhỏ có biểu tượng (gợi ý, cam kết bảo mật...) trong thẻ form. */
export const AuthNote: React.FC<{ icon: IconName; children: React.ReactNode; tone?: 'neutral' | 'brand' }> = ({
  icon,
  children,
  tone = 'neutral',
}) => (
  <View
    className={cn(
      'flex-row items-start gap-2.5 rounded-2xl px-3.5 py-3',
      tone === 'brand' ? 'bg-brand-50' : 'bg-canvas-subtle',
    )}
  >
    <Icon name={icon} size="sm" tone={tone === 'brand' ? 'brand' : 'muted'} />
    <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
      {children}
    </Text>
  </View>
);

const STRENGTH_BAR = ['bg-line', 'bg-danger', 'bg-warning', 'bg-success'];
const STRENGTH_TEXT = ['muted', 'danger', 'warning', 'success'] as const;

/** Thanh 3 vạch báo độ mạnh mật khẩu + gợi ý ngắn. */
export const PasswordStrengthBar: React.FC<{ strength: PasswordStrength }> = ({ strength }) => {
  if (!strength.level) return null;
  return (
    <View className="-mt-2 gap-1.5" accessibilityLabel={`Độ mạnh mật khẩu: ${strength.label}`}>
      <View className="flex-row gap-1.5">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className={cn('h-1.5 flex-1 rounded-full', i <= strength.level ? STRENGTH_BAR[strength.level] : 'bg-line-subtle')}
          />
        ))}
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="caption" weight="semibold" tone={STRENGTH_TEXT[strength.level]}>
          Độ mạnh: {strength.label}
        </Text>
        {!!strength.tip && (
          <Text variant="caption" weight="regular" tone="muted" className="flex-1 text-right" numberOfLines={1}>
            {strength.tip}
          </Text>
        )}
      </View>
    </View>
  );
};

export interface DemoAccount {
  label: string;
  username: string;
  icon: IconName;
  box: string;
  color: string;
}

/**
 * Đăng nhập nhanh bằng tài khoản mẫu. Chỉ dùng khi phát triển (màn gọi đặt trong __DEV__).
 * Thẻ trắng viền đứt + lưới 2 cột; mỗi nút cao bằng nhau, biểu tượng và chữ căn trái để các cột thẳng hàng.
 */
export const DevQuickLogin: React.FC<{ accounts: DemoAccount[]; disabled?: boolean; onPick: (username: string) => void }> = ({
  accounts,
  disabled,
  onPick,
}) => (
  <View className="gap-3 rounded-3xl border border-dashed border-line bg-surface p-4">
    <View className="flex-row items-center gap-2">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-canvas-subtle">
        <Icon name="flask-outline" size={13} tone="muted" />
      </View>
      <Text variant="caption" weight="semibold" tone="secondary" className="flex-1">
        Tài khoản demo
      </Text>
      <Text variant="micro" weight="medium" tone="muted">
        Chỉ hiện khi phát triển
      </Text>
    </View>
    <View className="flex-row flex-wrap justify-between gap-y-2.5">
      {accounts.map((acc) => (
        <Pressable
          key={acc.username}
          accessibilityRole="button"
          accessibilityLabel={`Đăng nhập nhanh bằng tài khoản ${acc.label}`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onPick(acc.username)}
          className="h-12 w-[48.5%] flex-row items-center gap-2.5 rounded-2xl border border-line-subtle bg-canvas-subtle px-3 active:opacity-75"
        >
          <View className={cn('h-7 w-7 items-center justify-center rounded-full', acc.box)}>
            <Icon name={acc.icon} size={15} color={acc.color} />
          </View>
          <Text variant="body" weight="semibold" className="flex-1" numberOfLines={1}>
            {acc.label}
          </Text>
          <Icon name="chevron-forward" size={14} tone="muted" />
        </Pressable>
      ))}
    </View>
  </View>
);

/** Khung báo lỗi ngay trong form (thay cho hộp thoại Alert): nền đỏ nhạt, biểu tượng trong vòng tròn. */
export const FormErrorBanner: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <View accessibilityLiveRegion="polite" className="flex-row items-start gap-3 rounded-2xl bg-danger-soft px-3.5 py-3">
    <View className="h-8 w-8 items-center justify-center rounded-full bg-surface">
      <Icon name="alert-circle" size={18} tone="danger" />
    </View>
    <View className="flex-1 gap-0.5">
      <Text variant="body" weight="bold">
        {title}
      </Text>
      <Text variant="caption" weight="regular" tone="secondary">
        {message}
      </Text>
    </View>
  </View>
);
