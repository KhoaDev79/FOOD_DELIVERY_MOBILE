import React from 'react';
import { View } from 'react-native';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: IconTone;
  /** Nút mũi tên tròn "Xem tất cả" (ảnh mẫu 3–6). */
  onSeeAll?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'brand',
  onSeeAll,
  className,
}) => (
  <View className={cn('flex-row items-center gap-3 px-4', className)}>
    <View className="flex-1 gap-0.5">
      <View className="flex-row items-center gap-1.5">
        {icon && <Icon name={icon} size="md" tone={iconTone} />}
        <Text variant="title" numberOfLines={1} accessibilityRole="header" className="flex-shrink">
          {title}
        </Text>
      </View>
      {!!subtitle && (
        <Text variant="body" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {onSeeAll && (
      <IconButton icon="arrow-forward" accessibilityLabel={`Xem tất cả ${title}`} variant="surface" onPress={onSeeAll} />
    )}
  </View>
);
