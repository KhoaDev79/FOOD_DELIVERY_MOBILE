import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationBell } from '../modules/notifications/NotificationBell';
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
  /** Có hiện chuông thông báo ở góc phải không (mặc định: true). */
  showNotificationBell?: boolean;
  /** Nội dung thêm dưới tiêu đề (thanh lọc, thẻ hồ sơ…). */
  children?: React.ReactNode;
  /** Bản gọn cho màn danh sách quản trị: tiêu đề nhỏ hơn, dòng phụ cạnh tiêu đề, ít khoảng đệm. */
  compact?: boolean;
  className?: string;
}

/**
 * Đầu trang cho các tab người dùng / đối tác / quản trị:
 * gradient xanh ngọc đậm, tiêu đề lớn chữ trắng, bo góc dưới, tích hợp chuông thông báo.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  titleLines = 1,
  subtitle,
  trailing,
  showNotificationBell = true,
  children,
  compact,
  className,
}) => {
  const renderedTrailing = (
    <View className="flex-row items-center gap-2">
      {trailing}
      {showNotificationBell && <NotificationBell tone="inverse" withBackground />}
    </View>
  );

  return (
    <Gradient preset="tabHeader" className={cn('overflow-hidden rounded-b-2xl', className)}>
      <SafeAreaView edges={['top']}>
        {compact ? (
          <View className="gap-2.5 px-4 pb-3 pt-1">
            <View className="min-h-touch flex-row items-center gap-3">
              <View className="flex-1">
                <Text variant="title" weight="bold" tone="inverse" accessibilityRole="header" numberOfLines={titleLines}>
                  {title}
                </Text>
                {!!subtitle &&
                  (typeof subtitle === 'string' ? (
                    <Text variant="caption" weight="medium" tone="inverse" className="opacity-80" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : (
                    subtitle
                  ))}
              </View>
              {renderedTrailing}
            </View>
            {children}
          </View>
        ) : (
          <View className="gap-3 px-4 pb-5 pt-3">
            <View className="gap-2">
              <View className="min-h-touch flex-row items-center justify-between gap-3">
                <Text variant="display" tone="inverse" accessibilityRole="header" numberOfLines={titleLines} className="flex-1">
                  {title}
                </Text>
                {renderedTrailing}
              </View>
              {!!subtitle &&
                (typeof subtitle === 'string' ? (
                  <Text variant="body" tone="inverse" className="opacity-80" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : (
                  subtitle
                ))}
            </View>
            {children}
          </View>
        )}
      </SafeAreaView>
    </Gradient>
  );
};
