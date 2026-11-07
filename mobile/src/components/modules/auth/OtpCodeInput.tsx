import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { palette } from '../../../theme';
import { cn, Text } from '../../ui';

const LENGTH = 6;

/** Ô mã đang chờ nhập: viền xanh + quầng sáng */
const ACTIVE_BOX = {
  borderColor: palette.brand['500'],
  backgroundColor: palette.surface,
  shadowColor: palette.brand['500'],
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 3,
} as const;

/**
 * Ô nhập mã OTP 6 số kiểu các app lớn: 6 ô vuông, ô đang nhập viền màu thương hiệu.
 * Thực chất là 1 TextInput trong suốt phủ lên trên, nên dán mã, tự điền mã (iOS đọc từ Mail)
 * và xoá lùi đều hoạt động như ô nhập thường.
 */
export const OtpCodeInput: React.FC<{
  value: string;
  onChange: (code: string) => void;
  /** Gọi khi đã đủ 6 số (tự gửi, không cần bấm nút) */
  onComplete?: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
}> = ({ value, onChange, onComplete, error, disabled }) => {
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(true);
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);

  // Nhập sai: rung ngang hàng ô như các app ngân hàng / ví
  useEffect(() => {
    if (!error || reduceMotion) return;
    const step = { duration: 55 };
    shake.value = withSequence(
      withTiming(-9, step),
      withTiming(9, step),
      withTiming(-7, step),
      withTiming(7, step),
      withTiming(-3, step),
      withTiming(0, step),
    );
  }, [error, reduceMotion, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH && digits !== value) onComplete?.(digits);
  };

  return (
    <Pressable accessible={false} onPress={() => inputRef.current?.focus()} className="relative w-full">
      {/* iOS: Animated.View chỉ nhận style hoạt hình; bố cục hàng đặt ở View con */}
      <Animated.View style={shakeStyle}>
        <View className="w-full flex-row justify-between gap-2">
          {Array.from({ length: LENGTH }, (_, i) => {
            const digit = value[i];
            const active = focused && !disabled && i === Math.min(value.length, LENGTH - 1);
            return (
              <View
                key={i}
                className={cn(
                  'h-14 flex-1 items-center justify-center rounded-[14px] border-[1.5px]',
                  // Ô đang nhập (con trỏ) đổi bằng style, không đổi class: đổi class lúc đang nhập làm NativeWind
                  // dựng lại thành phần trên điện thoại → mất tiêu điểm / bàn phím đóng mở liên tục
                  error ? 'border-danger bg-danger-soft' : digit ? 'border-brand-300 bg-brand-50' : 'border-line bg-surface',
                )}
                // NGOẠI LỆ style: ô đang nhập, xem ghi chú ở trên
                style={active && !error ? ACTIVE_BOX : undefined}
              >
                {digit ? (
                  <Text variant="title" weight="bold" tone={error ? 'danger' : 'default'}>
                    {digit}
                  </Text>
                ) : (
                  active && <View className="h-6 w-0.5 rounded-full bg-brand-600" />
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={LENGTH}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        accessibilityLabel="Mã xác nhận 6 số"
        caretHidden
        // Phủ kín 6 ô nhưng trong suốt: bấm vào đâu cũng mở bàn phím số
        className="absolute inset-0 text-transparent opacity-0"
      />
    </Pressable>
  );
};
