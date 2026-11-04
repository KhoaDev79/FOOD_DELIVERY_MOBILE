import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  EmptyState,
  Icon,
  LoadingSpinner,
  Text,
} from '../../components/ui';
import { useMyTickets } from '../../services/useHelp';
import { SupportTicket, SupportTicketStatus } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime } from '../../utils/format';

export const SupportTicketListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  const { data, isLoading, refetch, isRefetching } = useMyTickets(activeTab);
  const tickets = data?.items || [];

  const getStatusBadge = (status: SupportTicketStatus) => {
    switch (status) {
      case 'NEW':
        return { label: 'Mới tiếp nhận', tone: 'brand' as const };
      case 'IN_PROGRESS':
        return { label: 'Đang xử lý', tone: 'brand' as const };
      case 'WAITING_CUSTOMER':
        return { label: 'Chờ bạn phản hồi', tone: 'warning' as const };
      case 'RESOLVED':
        return { label: 'Đã giải quyết', tone: 'success' as const };
      case 'CLOSED':
        return { label: 'Đã đóng', tone: 'neutral' as const };
      default:
        return { label: status, tone: 'neutral' as const };
    }
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="border-b border-line bg-surface px-4 py-3"
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => navigation.goBack()}
            className="p-1 -ml-1 active:opacity-70"
          >
            <Icon name="arrow-back" size={24} tone="default" />
          </Pressable>

          <Text variant="headline" weight="bold">
            Phiếu hỗ trợ của tôi
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo phiếu mới"
            onPress={() => navigation.navigate('OrderIssue')}
            className="p-1 -mr-1 active:opacity-70"
          >
            <Icon name="add-circle-outline" size={24} tone="brand" />
          </Pressable>
        </View>

        {/* 2 Tabs: Đang mở / Đã đóng */}
        <View className="mt-3 flex-row rounded-xl bg-canvas-subtle p-1">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'open' }}
            onPress={() => setActiveTab('open')}
            className={`flex-1 items-center justify-center rounded-lg py-2 ${
              activeTab === 'open' ? 'bg-surface shadow-card' : 'shadow-none'
            }`}
          >
            <Text
              variant="body"
              weight={activeTab === 'open' ? 'bold' : 'medium'}
              tone={activeTab === 'open' ? 'brand' : 'secondary'}
            >
              Đang mở
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'closed' }}
            onPress={() => setActiveTab('closed')}
            className={`flex-1 items-center justify-center rounded-lg py-2 ${
              activeTab === 'closed' ? 'bg-surface shadow-card' : 'shadow-none'
            }`}
          >
            <Text
              variant="body"
              weight={activeTab === 'closed' ? 'bold' : 'medium'}
              tone={activeTab === 'closed' ? 'brand' : 'secondary'}
            >
              Đã đóng
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Danh sách phiếu hỗ trợ */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner message="Đang tải danh sách phiếu hỗ trợ..." />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 pb-12 gap-3"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} />}
          ListEmptyComponent={
            <EmptyState
              icon="ticket-outline"
              title={activeTab === 'open' ? 'Không có yêu cầu đang mở' : 'Không có yêu cầu nào đã đóng'}
              description={
                activeTab === 'open'
                  ? 'Khi bạn gửi yêu cầu hỗ trợ hoặc báo sự cố đơn hàng, các phiếu sẽ hiển thị tại đây để tiện theo dõi.'
                  : 'Các yêu cầu sau khi được giải quyết hoặc hết hạn sẽ được lưu tại mục này.'
              }
              actionLabel="Báo vấn đề đơn hàng"
              onAction={() => navigation.navigate('OrderIssue')}
            />
          }
          renderItem={({ item }: { item: SupportTicket }) => {
            const statusConfig = getStatusBadge(item.status);
            const isWaitingUser = item.status === 'WAITING_CUSTOMER';

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Phiếu ${item.code}`}
                onPress={() =>
                  navigation.navigate('SupportTicketDetail', {
                    ticketId: item.id,
                    code: item.code,
                  })
                }
                className={`rounded-2xl border bg-surface p-4 shadow-card active:opacity-75 ${
                  isWaitingUser ? 'border-warning/60 bg-warning-soft/20' : 'border-line'
                }`}
              >
                {/* Header phiếu: Mã code + Badge trạng thái */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <Text variant="caption" weight="bold" tone="brand">
                      #{item.code}
                    </Text>
                    {item.priority === 'URGENT' && <Badge label="Khẩn cấp" tone="danger" size="sm" />}
                  </View>

                  <Badge label={statusConfig.label} tone={statusConfig.tone} size="sm" />
                </View>

                {/* Tiêu đề & Đơn hàng liên quan */}
                <Text variant="body" weight="semibold" numberOfLines={2} className="mt-2 text-ink">
                  {item.subject}
                </Text>

                {item.order && (
                  <View className="mt-2 flex-row items-center gap-1.5 rounded-lg bg-canvas-subtle px-2.5 py-1.5">
                    <Icon name="storefront-outline" size={14} tone="secondary" />
                    <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
                      {item.order.restaurant.name}
                    </Text>
                  </View>
                )}

                {/* Tin nhắn gần nhất */}
                {item.lastMessage && (
                  <Text variant="caption" tone="muted" numberOfLines={1} className="mt-2.5">
                    {item.lastMessage.senderRole === 'ADMIN' ? 'CSKH: ' : 'Bạn: '}
                    {item.lastMessage.content}
                  </Text>
                )}

                {/* Footer: Thời gian cập nhật */}
                <View className="mt-3 flex-row items-center justify-between border-t border-line-subtle pt-2.5">
                  <Text variant="micro" tone="muted">
                    {formatDateTime(item.updatedAt)}
                  </Text>

                  <View className="flex-row items-center gap-1">
                    <Text variant="caption" weight="medium" tone="brand">
                      Chi tiết
                    </Text>
                    <Icon name="chevron-forward" size={14} tone="brand" />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
};
