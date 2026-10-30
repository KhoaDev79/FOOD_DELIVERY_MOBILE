import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from './cn';
import { Gradient } from './Gradient';
import { Text } from './Text';

export interface TabHeaderProps {
  title: string;
  subtitle?: string;
  /** Nút/thành phần bên phải tiêu đề. */
  trailing?: React.ReactNode;
  /** Nội dung thêm dưới tiêu đề (thanh lọc, thẻ hồ sơ…). */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Đầu trang cho các tab khách hàng, cùng ngôn ngữ với Trang chủ:
 * gradient xanh ngọc đậm, tiêu đề lớn chữ trắng, bo góc dưới.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({ title, subtitle, trailing, children, className }) => (
  <Gradient preset="tabHeader" className={cn('overflow-hidden rounded-b-2xl', className)}>
    <SafeAreaView edges={['top']}>
      <View className="gap-3 px-4 pb-5 pt-3">
        <View className="min-h-touch flex-row items-center gap-3">
          <View className="flex-1">
            <Text variant="display" tone="inverse" accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text variant="body" tone="inverse" className="opacity-80" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          {trailing}
        </View>
        {children}
      </View>
    </SafeAreaView>
  </Gradient>
);
