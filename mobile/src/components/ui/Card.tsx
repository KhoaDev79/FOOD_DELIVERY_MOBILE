import React from 'react';
import { Pressable, View, ViewProps } from 'react-native';
import { cn } from './cn';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  /** flat: không bóng, có viền mảnh. */
  variant?: 'elevated' | 'flat';
  padded?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

export const Card: React.FC<CardProps> = ({
  onPress,
  variant = 'elevated',
  padded = true,
  className,
  children,
  accessibilityLabel,
  ...rest
}) => {
  const classes = cn(
    'rounded-lg bg-surface',
    variant === 'elevated' ? 'shadow-card' : 'border border-line-subtle',
    padded && 'p-3',
    className,
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={cn(classes, 'active:opacity-90')}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} {...rest}>
      {children}
    </View>
  );
};
