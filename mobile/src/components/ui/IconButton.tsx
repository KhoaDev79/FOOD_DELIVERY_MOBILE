import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';

export type IconButtonVariant = 'surface' | 'subtle' | 'brand' | 'ghost' | 'scrim' | 'glass';
export type IconButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<IconButtonVariant, string> = {
  surface: 'bg-surface shadow-raised active:bg-canvas-subtle',
  subtle: 'bg-canvas-subtle active:bg-line',
  brand: 'bg-brand-500 shadow-glow active:bg-brand-600',
  ghost: 'bg-transparent active:bg-canvas-subtle',
  scrim: 'bg-scrim active:opacity-80',
  /** Nền trắng trong suốt, viền mờ – nút đè trên ảnh mà không che ảnh. */
  glass: 'bg-surface/70 border border-surface/80 shadow-card active:bg-surface/90',
};

const TONE: Record<IconButtonVariant, IconTone> = {
  surface: 'default',
  subtle: 'default',
  brand: 'inverse',
  ghost: 'default',
  scrim: 'inverse',
  glass: 'default',
};

const SIZE: Record<IconButtonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: IconName;
  /** Bắt buộc: nút chỉ có icon phải có nhãn cho trình đọc màn hình. */
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tone?: IconTone;
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'surface',
  size = 'md',
  tone,
  disabled,
  className,
  ...rest
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    // Vùng chạm tối thiểu 44 điểm cho nút nhỏ.
    hitSlop={size === 'sm' ? 6 : size === 'md' ? 2 : undefined}
    className={cn(
      'items-center justify-center rounded-full',
      SIZE[size],
      VARIANT[variant],
      disabled && 'opacity-40',
      className,
    )}
    {...rest}
  >
    <Icon name={icon} size={size === 'sm' ? 'sm' : size === 'md' ? 'md' : 'lg'} tone={tone ?? TONE[variant]} />
  </Pressable>
);
