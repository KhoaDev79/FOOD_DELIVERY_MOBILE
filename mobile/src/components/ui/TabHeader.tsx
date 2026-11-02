import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from './cn';
import { Gradient } from './Gradient';
import { Text } from './Text';

export interface TabHeaderProps {
  title: string;
  /** Số dòng tối đa của tiêu đề (mặc định 1). Dùng 2 khi tiêu đề chứa tên người dùng có thể dài. */
  titleLines?: number;
  subtitle?: React.ReactNode;
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
export const TabHeader: React.FC<TabHeaderProps> = ({ title, titleLines = 1, subtitle, trailing, children, className }) => (
  <Gradient preset="tabHeader" className={cn('overflow-hidden rounded-b-2xl', className)}>
    <SafeAreaView edges={['top']}>
      <View className="gap-3 px-4 pb-5 pt-3">
        <View className="gap-2">
          <View className="min-h-touch flex-row items-center justify-between gap-3">
            <Text variant="display" tone="inverse" accessibilityRole="header" numberOfLines={titleLines} className="flex-1">
              {title}
            </Text>
            {trailing}
          </View>
          {!!subtitle && (
            typeof subtitle === 'string' ? (
              <Text variant="body" tone="inverse" className="opacity-80" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )
          )}
        </View>
        {children}
      </View>
    </SafeAreaView>
  </Gradient>
);
