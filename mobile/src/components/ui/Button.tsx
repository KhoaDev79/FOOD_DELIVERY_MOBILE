import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, View } from 'react-native';
import { palette } from '../../theme';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { Text, TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 active:bg-brand-600',
  secondary: 'bg-brand-50 border border-brand-100 active:bg-brand-100',
  outline: 'bg-surface border border-line active:bg-canvas-subtle',
  ghost: 'bg-transparent active:bg-brand-50',
  danger: 'bg-danger active:opacity-80',
};

const LABEL_TONE: Record<ButtonVariant, TextTone> = {
  primary: 'inverse',
  secondary: 'brand',
  outline: 'default',
  ghost: 'brand',
  danger: 'inverse',
};

const ICON_TONE: Record<ButtonVariant, IconTone> = {
  primary: 'inverse',
  secondary: 'brand',
  outline: 'default',
  ghost: 'brand',
  danger: 'inverse',
};

const SPINNER: Record<ButtonVariant, string> = {
  primary: palette.ink.inverse,
  secondary: palette.brand['600'],
  outline: palette.ink.DEFAULT,
  ghost: palette.brand['600'],
  danger: palette.ink.inverse,
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-button-sm px-3 rounded-sm gap-1',
  md: 'h-button-md px-4 rounded-md gap-2',
  lg: 'h-button-lg px-5 rounded-md gap-2',
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: IconName;
  rightIcon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  size = 'lg',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : undefined}
      className={cn(
        'flex-row items-center justify-center',
        SIZE[size],
        CONTAINER[variant],
        fullWidth && 'self-stretch',
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER[variant]} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {leftIcon && <Icon name={leftIcon} size={size === 'sm' ? 'sm' : 'md'} tone={ICON_TONE[variant]} />}
          <Text
            variant={size === 'lg' ? 'body-lg' : size === 'md' ? 'body' : 'caption'}
            weight="semibold"
            tone={LABEL_TONE[variant]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon && <Icon name={rightIcon} size={size === 'sm' ? 'sm' : 'md'} tone={ICON_TONE[variant]} />}
        </View>
      )}
    </Pressable>
  );
};
