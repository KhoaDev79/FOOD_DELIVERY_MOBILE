import React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 99,
  size = 'md',
  disabled = false,
  className,
}) => {
  const btn = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;
  return (
    <View className={cn('flex-row items-center gap-3', className)} accessibilityLabel={`Số lượng ${value}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Giảm số lượng"
        accessibilityState={{ disabled: !canDec }}
        disabled={!canDec}
        hitSlop={8}
        onPress={() => onChange(value - 1)}
        className={cn(
          'items-center justify-center rounded-full border active:opacity-70',
          btn,
          canDec ? 'border-brand-500 bg-surface' : 'border-line bg-canvas-subtle',
        )}
      >
        <Icon
          name={value - 1 <= 0 && min === 0 ? 'trash-outline' : 'remove'}
          size="sm"
          tone={canDec ? 'brand' : 'muted'}
        />
      </Pressable>
      <Text variant="body-lg" weight="semibold" className="min-w-6 text-center">
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tăng số lượng"
        accessibilityState={{ disabled: !canInc }}
        disabled={!canInc}
        hitSlop={8}
        onPress={() => onChange(value + 1)}
        className={cn(
          'items-center justify-center rounded-full active:opacity-80',
          btn,
          canInc ? 'bg-brand-500' : 'bg-line',
        )}
      >
        <Icon name="add" size="sm" tone="inverse" />
      </Pressable>
    </View>
  );
};
