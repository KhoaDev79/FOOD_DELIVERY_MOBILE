import React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ChoiceRowProps {
  label: string;
  /** Phần bên phải, ví dụ "+8.000 ₫". */
  meta?: string;
  selected: boolean;
  /** radio: chọn một; checkbox: chọn nhiều. */
  kind: 'radio' | 'checkbox';
  disabled?: boolean;
  onPress: () => void;
}

/** Dòng lựa chọn trong bảng tuỳ chọn món: vùng chạm cả dòng, tối thiểu 44 điểm. */
export const ChoiceRow: React.FC<ChoiceRowProps> = ({ label, meta, selected, kind, disabled, onPress }) => (
  <Pressable
    accessibilityRole={kind}
    accessibilityState={{ checked: selected, disabled: !!disabled }}
    accessibilityLabel={meta ? `${label}, ${meta}` : label}
    disabled={disabled}
    onPress={onPress}
    className={cn('min-h-touch flex-row items-center gap-3 py-2 active:opacity-70', disabled && 'opacity-40')}
  >
    <View
      className={cn(
        'h-5 w-5 items-center justify-center border-2',
        kind === 'radio' ? 'rounded-full' : 'rounded-[6px]',
        selected ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
      )}
    >
      {selected &&
        (kind === 'radio' ? (
          <View className="h-2 w-2 rounded-full bg-surface" />
        ) : (
          <Icon name="checkmark" size={12} tone="inverse" />
        ))}
    </View>
    <Text variant="body-lg" weight={selected ? 'medium' : 'regular'} className="flex-1" numberOfLines={2}>
      {label}
    </Text>
    {!!meta && (
      <Text variant="body" tone={selected ? 'brand' : 'secondary'}>
        {meta}
      </Text>
    )}
  </Pressable>
);

/** Nhóm lựa chọn có tiêu đề và nhãn "Bắt buộc"/"Tuỳ chọn". */
export const ChoiceGroup: React.FC<{ title: string; hint?: string; required?: boolean; children: React.ReactNode }> = ({
  title,
  hint,
  required,
  children,
}) => (
  <View className="gap-1 border-t border-line-subtle pt-4">
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      <View className={cn('rounded-full px-2 py-0.5', required ? 'bg-accent-50' : 'bg-canvas-subtle')}>
        <Text variant="micro" tone={required ? 'accent' : 'secondary'}>
          {required ? 'Bắt buộc' : 'Tuỳ chọn'}
        </Text>
      </View>
    </View>
    {!!hint && (
      <Text variant="caption" weight="regular" tone="muted">
        {hint}
      </Text>
    )}
    <View className="mt-1">{children}</View>
  </View>
);
