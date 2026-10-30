import React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { Text, TextTone } from './Text';

export type ChipTone = 'voucher' | 'freeship' | 'neutral' | 'success' | 'danger';

const BOX: Record<ChipTone, string> = {
  voucher: 'bg-accent-50',
  freeship: 'bg-brand-50',
  neutral: 'bg-canvas-subtle',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
};
const TONE: Record<ChipTone, TextTone> = {
  voucher: 'accent',
  freeship: 'brand',
  neutral: 'secondary',
  success: 'success',
  danger: 'danger',
};
const ICON_TONE: Record<ChipTone, IconTone> = {
  voucher: 'accent',
  freeship: 'brand',
  neutral: 'secondary',
  success: 'success',
  danger: 'danger',
};

/** Chip thông tin (ảnh mẫu 5, 6): voucher cam, freeship xanh. */
export const InfoChip: React.FC<{ label: string; tone?: ChipTone; icon?: IconName; className?: string }> = ({
  label,
  tone = 'neutral',
  icon,
  className,
}) => (
  <View className={cn('h-6 flex-row items-center gap-1 self-start rounded-sm px-2', BOX[tone], className)}>
    {icon && <Icon name={icon} size="xs" tone={ICON_TONE[tone]} />}
    <Text variant="caption" weight="medium" tone={TONE[tone]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Chip lọc (ảnh mẫu 7): trắng bo tròn có bóng, có trạng thái chọn. */
export const FilterChip: React.FC<{
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress: () => void;
  className?: string;
}> = ({ label, selected = false, icon, onPress, className }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    hitSlop={6}
    className={cn(
      'h-chip flex-row items-center gap-1.5 rounded-full border px-3 shadow-card active:opacity-80',
      selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
      className,
    )}
  >
    {icon && <Icon name={icon} size="sm" tone={selected ? 'brand' : 'secondary'} />}
    <Text
      variant="caption"
      weight={selected ? 'semibold' : 'medium'}
      tone={selected ? 'brand' : 'default'}
      numberOfLines={1}
    >
      {label}
    </Text>
  </Pressable>
);
