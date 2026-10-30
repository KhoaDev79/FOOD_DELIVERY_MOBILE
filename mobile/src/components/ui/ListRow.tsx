import React from 'react';
import { Pressable, View } from 'react-native';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Icon đặt trong vòng tròn xám 44 điểm (ảnh mẫu 2, dòng hành động). */
  icon?: IconName;
  iconTone?: IconTone;
  /** Nội dung tuỳ biến bên trái thay cho icon. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Hiện mũi tên phải khi có onPress và không có trailing. */
  showChevron?: boolean;
  onPress?: () => void;
  destructive?: boolean;
  titleLines?: number;
  subtitleLines?: number;
  className?: string;
  accessibilityLabel?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  icon,
  iconTone = 'default',
  leading,
  trailing,
  showChevron = true,
  onPress,
  destructive,
  titleLines = 2,
  subtitleLines = 2,
  className,
  accessibilityLabel,
}) => {
  const content = (
    <>
      {leading ??
        (icon && (
          <View className="h-touch w-touch items-center justify-center rounded-full bg-canvas-subtle">
            <Icon name={icon} size="md" tone={destructive ? 'danger' : iconTone} />
          </View>
        ))}
      <View className="flex-1 gap-0.5">
        <Text variant="body-lg" tone={destructive ? 'danger' : 'default'} numberOfLines={titleLines}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="body" tone="secondary" numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing ?? (onPress && showChevron ? <Icon name="chevron-forward" size="md" tone="muted" /> : null)}
    </>
  );
  const classes = cn('min-h-touch flex-row items-center gap-3 py-3', className);
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
        onPress={onPress}
        className={cn(classes, 'active:opacity-70')}
      >
        {content}
      </Pressable>
    );
  }
  return <View className={classes}>{content}</View>;
};

export const Divider: React.FC<{ className?: string; inset?: boolean }> = ({ className, inset }) => (
  <View className={cn('h-px bg-line-subtle', inset && 'ml-14', className)} />
);
