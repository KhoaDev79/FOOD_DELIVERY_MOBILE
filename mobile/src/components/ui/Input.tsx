import React, { forwardRef, useState } from 'react';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { palette } from '../../theme';
import { cn } from './cn';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type TextInputRef = React.ComponentRef<typeof TextInput>;

/** Chiều cao 1 dòng chữ cỡ body-lg (tokens: 16/22) */
const LINE_HEIGHT = 22;


export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: IconName;
  /** Bật nút ẩn/hiện cho ô mật khẩu. */
  password?: boolean;
  /** Phần đứng trước chữ nhập (vd. "🇻🇳 +84"), ngăn cách bằng vạch dọc. */
  prefix?: React.ReactNode;
  /** Hiện dấu ✓ xanh khi giá trị đã hợp lệ (và không có lỗi). */
  valid?: boolean;
  /**
   * filled (mặc định): nền xám, không viền. outlined: nền trắng, viền mảnh, cao hơn, nhãn đậm hơn
   * (dùng ở màn Đăng nhập / Đăng ký). Là prop riêng vì cn() không gộp được class trùng thuộc tính.
   */
  variant?: 'filled' | 'outlined';
  className?: string;
}

export const Input = forwardRef<TextInputRef, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      password,
      prefix,
      valid,
      variant = 'filled',
      editable = true,
      className,
      onFocus,
      onBlur,
      onContentSizeChange,
      style,
      ...rest
    },
    ref,
  ) => {
    const outlined = variant === 'outlined';
    // Ô nhiều dòng (mô tả, ghi chú): khung cao ~3 dòng; phần chữ chỉ cao đúng nội dung và được căn GIỮA khung,
    // nên dòng gợi ý "VD: ..." nằm giữa thay vì dính lên trên. Gõ nhiều dòng thì phần chữ (và khung) tự cao lên.
    const multiline = !!rest.multiline;
    const [contentHeight, setContentHeight] = useState(LINE_HEIGHT);
    const [hidden, setHidden] = useState(true);

    /*
     * Viền xanh lúc đang nhập = một lớp viền phủ sẵn trên khung, chỉ đổi độ mờ bằng Reanimated (chạy trên luồng
     * giao diện). KHÔNG dùng state React cho "đang nhập": mỗi lần render lại khi bấm vào ô, NativeWind trên điện thoại
     * có thể dựng lại khung → ô mất tiêu điểm (phải chạm 2 lần mới có bàn phím, hoặc treo / lỗi ngữ cảnh điều hướng).
     */
    const focus = useSharedValue(0);
    const borderWidth = outlined ? 1.5 : 1;
    const radius = outlined ? 16 : 12;
    const ringStyle = useAnimatedStyle(() => ({
      position: 'absolute',
      // Phủ đúng lên viền của khung (vị trí tuyệt đối tính từ bên trong viền)
      top: -borderWidth,
      left: -borderWidth,
      right: -borderWidth,
      bottom: -borderWidth,
      borderRadius: radius,
      borderWidth,
      borderColor: palette.brand['500'],
      opacity: focus.get(),
      ...(outlined
        ? {
            shadowColor: palette.brand['500'],
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3 * focus.get(),
            shadowRadius: 10,
          }
        : {}),
    }));

    return (
      <View className={cn('gap-1.5', className)}>
        {label && (
          <Text variant="caption" weight={outlined ? 'semibold' : 'medium'} tone={outlined ? 'default' : 'secondary'}>
            {label}
          </Text>
        )}
        <View
          className={cn(
            outlined
              ? 'flex-row gap-2.5 rounded-lg border-[1.5px] px-3.5'
              : 'flex-row gap-2 rounded-md border px-3',
            multiline ? 'min-h-[104px] items-center py-3' : outlined ? 'h-search-lg items-center' : 'h-button-lg items-center',
            // className không phụ thuộc trạng thái "đang nhập" (xem ghi chú ở ringStyle)
            error
              ? 'border-danger bg-danger-soft'
              : outlined
                ? 'border-line bg-surface'
                : 'border-transparent bg-canvas-subtle',
            !editable && 'opacity-60',
          )}
        >
          {/* Viền xanh lúc đang nhập (ẩn khi có lỗi: viền đỏ ưu tiên) */}
          {!error && <Animated.View pointerEvents="none" style={ringStyle} />}
          {leftIcon && <Icon name={leftIcon} size="md" tone={error ? 'danger' : 'muted'} />}
          {prefix && (
            <View className="flex-row items-center gap-2 border-r border-line pr-2">
              {typeof prefix === 'string' ? (
                <Text variant="body-lg" weight="semibold">
                  {prefix}
                </Text>
              ) : (
                prefix
              )}
            </View>
          )}
          <TextInput
            ref={ref}
            editable={editable}
            secureTextEntry={password ? hidden : rest.secureTextEntry}
            placeholderTextColor={palette.ink.muted}
            accessibilityLabel={rest.accessibilityLabel ?? label}
            maxFontSizeMultiplier={1.4}
            textAlignVertical={multiline ? 'center' : undefined}
            className={cn('flex-1 font-body text-body-lg text-ink web:outline-none', multiline ? 'p-0' : 'h-full')}
            // NGOẠI LỆ style: chiều cao ô nhiều dòng thay đổi theo nội dung, không viết được bằng className
            style={multiline ? [style, { height: Math.max(LINE_HEIGHT, contentHeight) }] : style}
            // Chỉ ô nhiều dòng mới cần đo chiều cao nội dung
            onContentSizeChange={
              multiline
                ? (e) => {
                    setContentHeight(Math.ceil(e.nativeEvent.contentSize.height));
                    onContentSizeChange?.(e);
                  }
                : onContentSizeChange
            }
            onFocus={(e) => {
              focus.set(withTiming(1, { duration: 120 }));
              onFocus?.(e);
            }}
            onBlur={(e) => {
              focus.set(withTiming(0, { duration: 120 }));
              onBlur?.(e);
            }}
            {...rest}
          />
          {valid && !error && (
            <Icon name="checkmark-circle" size="md" tone="success" accessibilityLabel="Hợp lệ" />
          )}
          {password && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
              hitSlop={12}
              onPress={() => setHidden((v) => !v)}
            >
              <Icon name={hidden ? 'eye-off-outline' : 'eye-outline'} size="md" tone="muted" />
            </Pressable>
          )}
        </View>
        {error ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : hint ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);
Input.displayName = 'Input';

/** Ô nhập gắn với react-hook-form. */
export function FormInput<T extends FieldValues>({
  control,
  name,
  ...props
}: Omit<InputProps, 'value' | 'onChangeText' | 'error'> & { control: Control<T>; name: FieldPath<T> }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value, ref }, fieldState: { error } }) => (
        <Input
          ref={ref}
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
          {...props}
        />
      )}
    />
  );
}
