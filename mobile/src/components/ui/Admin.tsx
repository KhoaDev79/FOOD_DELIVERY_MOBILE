import React from 'react';
import { ScrollView, View } from 'react-native';
import { cn } from './cn';
import { FilterChip } from './Chip';
import { Icon, IconName, IconTone } from './Icon';
import { Text } from './Text';

/** Thẻ số liệu cho màn quản lý (Owner/Driver/Admin). Giá trị phải lấy từ API. */
export const StatCard: React.FC<{
  label: string;
  value: string;
  icon?: IconName;
  iconTone?: IconTone;
  caption?: string;
  className?: string;
}> = ({ label, value, icon, iconTone = 'brand', caption, className }) => (
  <View className={cn('min-w-36 flex-1 gap-2 rounded-lg bg-surface p-4 shadow-card', className)}>
    <View className="flex-row items-center justify-between">
      <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
        {label}
      </Text>
      {icon && (
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
          <Icon name={icon} size="sm" tone={iconTone} />
        </View>
      )}
    </View>
    <Text variant="title" weight="bold" numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {!!caption && (
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {caption}
      </Text>
    )}
  </View>
);

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

/** Thanh lọc cuộn ngang. */
export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cn('flex-grow-0', className)}
      contentContainerClassName="gap-2 px-4 py-2"
    >
      {options.map((o) => (
        <FilterChip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}
