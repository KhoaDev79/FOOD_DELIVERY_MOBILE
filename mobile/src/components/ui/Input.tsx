import React, { forwardRef, useState } from 'react';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { palette } from '../../theme';
import { cn } from './cn';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type TextInputRef = React.ComponentRef<typeof TextInput>;

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
    { label, error, hint, leftIcon, password, prefix, valid, variant = 'filled', editable = true, className, onFocus, onBlur, ...rest },
    ref,
  ) => {
    const outlined = variant === 'outlined';
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(true);

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
              ? 'h-search-lg flex-row items-center gap-2.5 rounded-lg border-[1.5px] px-3.5'
              : 'h-button-lg flex-row items-center gap-2 rounded-md border px-3',
            error
              ? 'border-danger bg-danger-soft'
              : focused
                ? outlined
                  ? 'border-brand-500 bg-surface shadow-glow'
                  : 'border-brand-500 bg-surface'
                : outlined
                  ? 'border-line bg-surface'
                  : 'border-transparent bg-canvas-subtle',
            !editable && 'opacity-60',
          )}
        >
          {leftIcon && <Icon name={leftIcon} size="md" tone={error ? 'danger' : focused ? 'brand' : 'muted'} />}
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
            className="h-full flex-1 font-body text-body-lg text-ink web:outline-none"
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
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
