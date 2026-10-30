import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from './Button';
import { cn } from './cn';
import { Gradient } from './Gradient';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** card: thẻ gradient như ảnh mẫu 8; plain: giữa màn như ảnh mẫu 9. */
  variant?: 'plain' | 'card';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  message,
  actionLabel,
  onAction,
  variant = 'plain',
  className,
}) => {
  const displayDesc = description || message;
  const body = (
    <View className="items-center gap-3 px-6 py-8">
      <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-50">
        <Icon name={icon} size={44} tone="brand" />
      </View>
      <Text variant="headline" className="text-center">
        {title}
      </Text>
      {!!displayDesc && (
        <Text variant="body-lg" tone="secondary" className="text-center">
          {displayDesc}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} variant="secondary" size="md" onPress={onAction} className="mt-2 px-6" />
      )}
    </View>
  );
  if (variant === 'card') {
    return (
      <Gradient preset="empty" className={cn('overflow-hidden rounded-xl', className)}>
        {body}
      </Gradient>
    );
  }
  return <View className={cn('items-center justify-center', className)}>{body}</View>;
};

export const ErrorState: React.FC<{ message?: string; onRetry: () => void; className?: string }> = ({
  message = 'Không tải được dữ liệu. Vui lòng kiểm tra kết nối mạng và thử lại.',
  onRetry,
  className,
}) => (
  <View className={cn('items-center gap-3 px-6 py-10', className)} accessibilityLiveRegion="polite">
    <View className="h-20 w-20 items-center justify-center rounded-full bg-danger-soft">
      <Icon name="cloud-offline-outline" size={36} tone="danger" />
    </View>
    <Text variant="headline" className="text-center">
      Đã xảy ra lỗi
    </Text>
    <Text variant="body" tone="secondary" className="text-center">
      {message}
    </Text>
    <Button label="Thử lại" leftIcon="refresh" variant="primary" size="md" onPress={onRetry} className="mt-1 px-6" />
  </View>
);

export const LoadingSpinner: React.FC<{ message?: string; className?: string }> = ({
  message,
  className,
}) => (
  <View className={cn('flex-1 items-center justify-center p-6', className)}>
    <ActivityIndicator size="large" color="#1EB9CE" />
    {message && (
      <Text variant="body" tone="secondary" className="mt-3 text-center">
        {message}
      </Text>
    )}
  </View>
);
