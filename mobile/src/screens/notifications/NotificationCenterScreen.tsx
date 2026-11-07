import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, Icon, IconName, LoadingSpinner, Text, useToast } from '../../components/ui';
import {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotificationsList,
} from '../../services/useNotifications';
import { useAuthStore } from '../../store/useAuthStore';
import { AppNotification, ChatChannel, Role } from '../../types/api';
import { formatNotificationTime, getDateCategory } from '../../utils/notificationFormat';

type FilterTab = 'all' | 'orders' | 'activity';

const VALID_CHAT_CHANNELS: readonly ChatChannel[] = [
  'CUSTOMER_DRIVER',
  'CUSTOMER_RESTAURANT',
  'RESTAURANT_DRIVER',
];

/** Suy luận vai trò người đối thoại từ kênh chat khi thông báo cũ chưa lưu sẵn recipientRole */
function inferChatRecipientRole(channel?: ChatChannel, currentUserRole?: Role): string | undefined {
  if (!channel) return undefined;
  if (channel === 'CUSTOMER_RESTAURANT') {
    return currentUserRole === 'RESTAURANT_OWNER' ? 'Khách hàng' : 'Quán ăn';
  }
  if (channel === 'CUSTOMER_DRIVER') {
    return currentUserRole === 'DRIVER' ? 'Khách hàng' : 'Tài xế giao hàng';
  }
  if (channel === 'RESTAURANT_DRIVER') {
    return currentUserRole === 'DRIVER' ? 'Quán ăn' : 'Tài xế giao hàng';
  }
  return undefined;
}

/** Biểu tượng và màu nền tương ứng loại thông báo */
function getNotificationVisuals(type: string): { icon: IconName; bgColor: string; iconColor: string } {
  switch (type) {
    case 'order_chat':
      return { icon: 'chatbubble-ellipses', bgColor: 'bg-accent-50', iconColor: '#FF7A30' };
    case 'support_ticket':
      return { icon: 'headset', bgColor: 'bg-violet-soft', iconColor: '#6D28D9' };
    case 'order':
      return { icon: 'receipt', bgColor: 'bg-brand-50', iconColor: '#00A896' };
    case 'order_reminder':
      return { icon: 'alarm', bgColor: 'bg-warning-soft', iconColor: '#D97706' };
    case 'order_available':
      return { icon: 'bicycle', bgColor: 'bg-info-soft', iconColor: '#0284C7' };
    case 'review_reply':
      return { icon: 'chatbubbles', bgColor: 'bg-warning-soft', iconColor: '#D97706' };
    case 'driver_offline':
      return { icon: 'warning', bgColor: 'bg-danger-soft', iconColor: '#E11D48' };
    default:
      return { icon: 'notifications', bgColor: 'bg-canvas-subtle', iconColor: '#00A896' };
  }
}

export const NotificationCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [page] = useState(1);
  const { data, isLoading, refetch, isRefetching } = useNotificationsList(page, 50);
  const markAsReadMutation = useMarkNotificationAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();
  const deleteMutation = useDeleteNotification();

  const allNotifications = useMemo(() => data?.items ?? [], [data?.items]);
  const unreadCount = data?.unreadCount || 0;

  // Lọc theo danh mục đã chọn
  const filteredNotifications = useMemo(() => {
    if (filterTab === 'orders') {
      return allNotifications.filter((i) => i.type === 'order' || i.type === 'order_available');
    }
    if (filterTab === 'activity') {
      return allNotifications.filter((i) => i.type !== 'order' && i.type !== 'order_available');
    }
    return allNotifications;
  }, [allNotifications, filterTab]);

  // Gom nhóm danh sách theo mốc thời gian
  const groupedData = useMemo(() => {
    const groups: { title: string; items: AppNotification[] }[] = [];
    const categoryOrder = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Cũ hơn'];
    const map = new Map<string, AppNotification[]>();

    filteredNotifications.forEach((item: AppNotification) => {
      const cat = getDateCategory(item.createdAt);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });

    categoryOrder.forEach((cat) => {
      const items = map.get(cat);
      if (items && items.length > 0) {
        groups.push({ title: cat, items });
      }
    });

    return groups;
  }, [filteredNotifications]);

  // Điều hướng sâu theo ngữ cảnh thông báo và vai trò (ưu tiên kiểm tra đúng item.type trước)
  const handleItemPress = (item: AppNotification) => {
    if (!item.readAt) {
      markAsReadMutation.mutate(item.id);
    }

    const orderId = (item.data?.orderId as string) || undefined;
    const rawChannel = item.data?.channel as ChatChannel | undefined;
    const channel = rawChannel && VALID_CHAT_CHANNELS.includes(rawChannel) ? rawChannel : undefined;

    // 1. Tin nhắn chat trong đơn hàng -> mở thẳng phòng Chat của cuộc trò chuyện đó
    if (item.type === 'order_chat') {
      if (orderId && channel && user?.role !== 'ADMIN') {
        const fallbackSender = item.title.replace(/^Tin nhắn mới từ\s+/i, '').trim();
        const recipientName =
          (typeof item.data?.recipientName === 'string' && item.data.recipientName.trim()) ||
          fallbackSender ||
          undefined;
        const recipientRole =
          (typeof item.data?.recipientRole === 'string' && item.data.recipientRole.trim()) ||
          inferChatRecipientRole(channel, user?.role);

        navigation.navigate('Chat', {
          orderId,
          channel,
          recipientName,
          recipientRole,
        });
        return;
      }

      // Dự phòng cho thông báo cũ không có channel: mở Hộp thư tin nhắn theo vai trò
      switch (user?.role) {
        case 'RESTAURANT_OWNER':
          navigation.navigate('OwnerTabs', { screen: 'OwnerInboxTab' });
          return;
        case 'DRIVER':
          navigation.navigate('DriverTabs', { screen: 'DriverInboxTab' });
          return;
        case 'CUSTOMER':
          navigation.navigate('Inbox');
          return;
        default:
          break;
      }
    }

    // 2. Phản hồi phiếu hỗ trợ CSKH / tặng voucher bồi thường -> mở chi tiết phiếu hỗ trợ
    if (item.type === 'support_ticket') {
      if (user?.role === 'ADMIN') {
        navigation.navigate('AdminSupportTickets');
        return;
      }
      const ticketId = (item.data?.ticketId as string) || undefined;
      const ticketCode = (item.data?.ticketCode as string) || undefined;
      if (ticketId) {
        navigation.navigate('SupportTicketDetail', { ticketId, code: ticketCode });
        return;
      }
      navigation.navigate('SupportTicketList');
      return;
    }

    // 3. Phản hồi đánh giá từ nhà hàng -> kiểm tra trước orderId để không bị nhảy nhầm sang OrderTracking
    if (item.type === 'review_reply') {
      if (user?.role === 'RESTAURANT_OWNER') {
        navigation.navigate('OwnerReviews');
        return;
      }
      const restaurantId = (item.data?.restaurantId as string) || undefined;
      const restaurantName = (item.data?.restaurantName as string) || undefined;
      if (restaurantId) {
        navigation.navigate('RestaurantReviews', { restaurantId, restaurantName });
        return;
      }
      if (orderId) {
        navigation.navigate('OrderTracking', { orderId });
        return;
      }
    }

    // 4. Thông báo chuyến giao mới gần tài xế -> mở tab Săn chuyến (DriverAvailableTab)
    if (item.type === 'order_available' && user?.role === 'DRIVER') {
      navigation.navigate('DriverTabs', { screen: 'DriverAvailableTab' });
      return;
    }

    // 5. Cập nhật trạng thái đơn hàng / nhắc xác nhận đơn
    // React Navigation 7: màn Thông báo nằm ngoài khung tab → phải ghi rõ khung cha (OwnerTabs / DriverTabs / AdminTabs)
    if (orderId) {
      switch (user?.role) {
        case 'RESTAURANT_OWNER':
          navigation.navigate('OwnerTabs', { screen: 'OwnerOrdersTab' });
          return;
        case 'DRIVER':
          navigation.navigate('DriverDeliveryDetail', { orderId });
          return;
        case 'ADMIN':
          navigation.navigate('AdminTabs', { screen: 'AdminOrdersTab', params: { orderId } });
          return;
        case 'CUSTOMER':
        default:
          navigation.navigate('OrderTracking', { orderId });
          return;
      }
    }

    // 6. Cảnh báo tự động chuyển ngoại tuyến cho tài xế
    if (item.type === 'driver_offline' && user?.role === 'DRIVER') {
      navigation.navigate('DriverTabs', { screen: 'DriverProfileTab' });
    }
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0 || markAllAsReadMutation.isPending) return;
    markAllAsReadMutation.mutate(undefined, {
      onSuccess: () => {
        toast('Đã đánh dấu đọc tất cả thông báo', 'success');
      },
    });
  };

  const handleDeleteItem = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast('Đã xoá thông báo', 'default');
      },
      onError: () => {
        toast('Không thể xoá thông báo. Thử lại sau.', 'error');
      },
    });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
      {/* Header thanh lịch */}
      <View className="flex-row items-center justify-between border-b border-line px-4 py-3.5 bg-surface">
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => navigation.goBack()}
            hitSlop={8}
            className="p-1 -ml-1 active:opacity-60"
          >
            <Icon name="arrow-back" size="lg" tone="default" />
          </Pressable>
          <Text variant="title" weight="bold">
            Thông báo
          </Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đánh dấu đã đọc tất cả"
            onPress={handleMarkAllRead}
            disabled={markAllAsReadMutation.isPending}
            className="flex-row items-center gap-1.5 rounded-full bg-canvas-subtle px-3 py-1.5 active:opacity-70"
          >
            <Icon name="checkmark-done" size="sm" tone="brand" />
            <Text variant="caption" weight="medium" tone="brand">
              Đọc tất cả
            </Text>
          </Pressable>
        )}
      </View>

      {/* Thanh tab lọc danh mục chuẩn các app lớn */}
      <View className="flex-row border-b border-line/60 bg-surface px-4 py-2 gap-2">
        {(
          [
            { key: 'all', label: 'Tất cả' },
            { key: 'orders', label: 'Đơn hàng' },
            { key: 'activity', label: 'Hoạt động & Hệ thống' },
          ] as const
        ).map((tab) => {
          const isActive = filterTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilterTab(tab.key)}
              className={`rounded-full px-3.5 py-1.5 active:opacity-75 ${
                isActive ? 'bg-brand-500' : 'bg-canvas-subtle border border-line/40'
              }`}
            >
              <Text
                variant="caption"
                weight={isActive ? 'bold' : 'medium'}
                tone={isActive ? 'inverse' : 'secondary'}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Danh sách thông báo */}
      {isLoading ? (
        <LoadingSpinner message="Đang tải thông báo..." />
      ) : filteredNotifications.length === 0 ? (
        <View className="flex-1 justify-center p-6">
          <EmptyState
            icon="notifications-outline"
            title={filterTab === 'all' ? 'Chưa có thông báo nào' : 'Không có thông báo trong mục này'}
            description="Các cập nhật về đơn hàng, ưu đãi và hoạt động hệ thống sẽ được gửi đến đây."
          />
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(group) => group.title}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor="#00A896"
              colors={['#00A896']}
            />
          }
          contentContainerClassName="pb-8"
          renderItem={({ item: group }) => (
            <View className="mt-4">
              {/* Tiêu đề nhóm ngày */}
              <View className="px-4 pb-2">
                <Text variant="caption" weight="bold" tone="secondary" className="uppercase tracking-wider">
                  {group.title}
                </Text>
              </View>

              {/* Các thẻ thông báo trong nhóm */}
              {group.items.map((item) => {
                const isUnread = !item.readAt;
                const visuals = getNotificationVisuals(item.type);

                return (
                  // Vùng mở thông báo và nút xoá là hai nút NGANG HÀNG: trên web Pressable có vai trò "button"
                  // thành thẻ <button>, lồng <button> trong <button> là HTML không hợp lệ (React báo lỗi).
                  <View
                    key={item.id}
                    className={`flex-row items-start border-b border-line/40 ${isUnread ? 'bg-brand-50/40' : 'bg-surface'}`}
                  >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.body}`}
                    onPress={() => handleItemPress(item)}
                    className="flex-1 flex-row items-start gap-3.5 py-3.5 pl-4 active:bg-canvas-subtle"
                  >
                    {/* Icon đại diện có màu nền */}
                    <View
                      className={`h-11 w-11 items-center justify-center rounded-2xl ${visuals.bgColor}`}
                    >
                      <Icon name={visuals.icon} size="md" color={visuals.iconColor} />
                    </View>

                    {/* Nội dung thông báo */}
                    <View className="flex-1 pt-0.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <View className="flex-1 flex-row items-center gap-1.5">
                          <Text
                            variant="body"
                            weight={isUnread ? 'bold' : 'medium'}
                            numberOfLines={1}
                            className="shrink text-ink"
                          >
                            {item.title}
                          </Text>
                          {isUnread &&
                            item.type === 'order_chat' &&
                            typeof item.data?.unreadCount === 'number' &&
                            item.data.unreadCount > 1 && (
                              <View className="rounded-full bg-accent-500 px-1.5 py-0.5">
                                <Text variant="micro" weight="bold" tone="inverse">
                                  {item.data.unreadCount}
                                </Text>
                              </View>
                            )}
                        </View>
                        <Text variant="micro" tone="muted">
                          {formatNotificationTime(item.createdAt)}
                        </Text>
                      </View>

                      <Text
                        variant="caption"
                        tone={isUnread ? 'default' : 'secondary'}
                        numberOfLines={3}
                        className="mt-1 leading-relaxed"
                      >
                        {item.body}
                      </Text>
                    </View>

                  </Pressable>

                    {/* Nút xoá & Chấm tròn chưa đọc */}
                    <View className="items-end gap-2 py-3.5 pl-2 pr-4">
                      {isUnread && (
                        <View className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Xoá thông báo ${item.title}`}
                        onPress={() => handleDeleteItem(item.id)}
                        hitSlop={8}
                        className="p-1 opacity-40 active:opacity-100"
                      >
                        <Icon name="close" size="xs" tone="muted" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};
