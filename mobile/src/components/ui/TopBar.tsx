import React from 'react';
import { View } from 'react-native';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface TopBarProps {
  title?: string;
  /** center: tiêu đề giữa (ảnh mẫu 2); large: tiêu đề lớn dưới hàng nút (ảnh mẫu 8, 9). */
  titleAlign?: 'center' | 'large';
  leading?: 'back' | 'close' | 'none';
  onLeadingPress?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  titleAlign = 'center',
  leading = 'back',
  onLeadingPress,
  trailing,
  className,
}) => {
  const leadingButton =
    leading !== 'none' && onLeadingPress ? (
      <IconButton
        icon={leading === 'close' ? 'close' : 'arrow-back'}
        accessibilityLabel={leading === 'close' ? 'Đóng' : 'Quay lại'}
        variant="ghost"
        onPress={onLeadingPress}
      />
    ) : null;

  if (titleAlign === 'large') {
    return (
      <View className={cn('bg-canvas px-4 pb-2', className)}>
        <View className="h-topbar flex-row items-center justify-between">
          <View className="-ml-2">{leadingButton}</View>
          <View className="flex-row items-center gap-2">{trailing}</View>
        </View>
        {!!title && (
          <Text variant="display" accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className={cn('h-topbar flex-row items-center bg-canvas px-2', className)}>
      <View className="w-12 items-start">{leadingButton}</View>
      <Text variant="headline" accessibilityRole="header" numberOfLines={1} className="flex-1 text-center">
        {title}
      </Text>
      <View className="min-w-12 flex-row items-center justify-end">{trailing}</View>
    </View>
  );
};
