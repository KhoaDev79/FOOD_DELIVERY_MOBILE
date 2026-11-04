import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useUnreadNotificationsCount } from '../../../services/useNotifications';
// Import thẳng từng file (không qua ui/index) để tránh vòng import với TabHeader
import { Icon } from '../../ui/Icon';
import { Text } from '../../ui/Text';

export interface NotificationBellProps {
  /** Kiểu hiển thị icon: 'inverse' (trắng, cho nền gradient) hoặc 'default' (đen/xám cho nền sáng) */
  tone?: 'inverse' | 'default';
  /** Có bao bọc nền tròn mờ (phù hợp thanh header) */
  withBackground?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  tone = 'default',
  withBackground = false,
}) => {
  const navigation = useNavigation<any>();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  const handlePress = () => {
    navigation.navigate('NotificationCenter');
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Trung tâm thông báo${unreadCount > 0 ? `, có ${unreadCount} thông báo mới` : ''}`}
      onPress={handlePress}
      hitSlop={8}
      className={`relative h-10 w-10 items-center justify-center rounded-full active:opacity-70 ${
        withBackground ? (tone === 'inverse' ? 'bg-black/20' : 'bg-canvas-subtle') : ''
      }`}
    >
      <Icon
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size="md"
        tone={tone === 'inverse' ? 'inverse' : 'default'}
      />
      {displayCount !== null && (
        <View className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] items-center justify-center rounded-full bg-danger px-1 border-2 border-surface">
          <Text variant="micro" weight="bold" tone="inverse" style={{ fontSize: 9, lineHeight: 11 }}>
            {displayCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

