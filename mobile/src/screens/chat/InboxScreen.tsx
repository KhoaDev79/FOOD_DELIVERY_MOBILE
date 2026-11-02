import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../api/orders';
import {
  Avatar,
  CountBadge,
  EmptyState,
  FilterChip,
  Icon,
  IconName,
  LoadingSpinner,
  OrderStatusBadge,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  TopBar,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { ChatConversation, Role } from '../../types/api';
import { formatVND } from '../../utils/format';

type Side = ChatConversation['counterpart']['side'];
type Filter = 'ALL' | 'UNREAD' | Side;

const SIDE_LABEL: Record<Side, string> = {
  CUSTOMER: 'Khách hàng',
  RESTAURANT: 'Quán ăn',
  DRIVER: 'Tài xế',
};

const SIDE_ICON: Record<Side, IconName> = {
  CUSTOMER: 'person',
  RESTAURANT: 'storefront',
  DRIVER: 'bicycle',
};

/** Bộ lọc theo người bên kia, tuỳ vai trò của mình. */
const SIDE_FILTERS: Partial<Record<Role, Side[]>> = {
  CUSTOMER: ['RESTAURANT', 'DRIVER'],
  RESTAURANT_OWNER: ['CUSTOMER', 'DRIVER'],
  DRIVER: ['CUSTOMER', 'RESTAURANT'],
};

const EMPTY_HINT: Partial<Record<Role, string>> = {
  CUSTOMER: 'Nhắn tin với quán hoặc tài xế từ màn theo dõi đơn hàng, cuộc trò chuyện sẽ hiện ở đây.',
  RESTAURANT_OWNER: 'Khi khách hàng hoặc tài xế nhắn tin về một đơn của quán, cuộc trò chuyện sẽ hiện ở đây.',
  DRIVER: 'Khi khách hàng hoặc quán nhắn tin về chuyến giao của bạn, cuộc trò chuyện sẽ hiện ở đây.',
};

/** Hôm nay: "14:05"; hôm qua: "Hôm qua"; khác: "28/10". */
function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.getTime() >= startOfToday) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.getTime() >= startOfToday - 86_400_000) return 'Hôm qua';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const ConversationRow: React.FC<{ item: ChatConversation; viewerRole?: Role; onPress: () => void }> = ({
  item,
  viewerRole,
  onPress,
}) => {
  const { counterpart, order, lastMessage, unreadCount } = item;
  const unread = unreadCount > 0;
  const itemsText = order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
  const moreItems = order.itemCount - order.items.reduce((s, i) => s + i.quantity, 0);
  // Các bên khác của đơn (không lặp lại người đang trò chuyện, không ghi chính mình)
  const partiesText = [
    viewerRole !== 'CUSTOMER' && counterpart.side !== 'CUSTOMER' ? `Khách: ${order.customer.fullName}` : null,
    viewerRole !== 'RESTAURANT_OWNER' && counterpart.side !== 'RESTAURANT' ? `Quán: ${order.restaurant.name}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${counterpart.name}, ${SIDE_LABEL[counterpart.side]}, đơn ${order.code}${
        unread ? `, ${unreadCount} tin chưa đọc` : ''
      }. ${lastMessage.content}`}
      onPress={onPress}
      className="gap-2.5 border-b border-line-subtle bg-surface px-4 py-3 active:bg-canvas-subtle"
    >
      <View className="flex-row items-start gap-3">
        {/* Khung cố định kích thước ảnh (lg = 56pt) để huy hiệu vai trò luôn nằm góc dưới phải */}
        <View className="h-14 w-14">
          <Avatar uri={counterpart.avatarUrl} name={counterpart.name} size="lg" />
          <View className="absolute bottom-0 right-0 h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-500">
            <Icon name={SIDE_ICON[counterpart.side]} size="xs" tone="inverse" />
          </View>
        </View>

        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text variant="body" weight="bold" numberOfLines={1} className="flex-shrink">
              {counterpart.name}
            </Text>
            <Text variant="micro" tone="muted">
              {SIDE_LABEL[counterpart.side]}
            </Text>
            <View className="flex-1" />
            <Text variant="micro" tone={unread ? 'brand' : 'muted'} weight={unread ? 'bold' : 'regular'}>
              {formatChatTime(lastMessage.createdAt)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text
              variant="caption"
              tone={unread ? 'default' : 'secondary'}
              weight={unread ? 'semibold' : 'regular'}
              numberOfLines={1}
              className="flex-1"
            >
              {lastMessage.isMine ? `Bạn: ${lastMessage.content}` : lastMessage.content}
            </Text>
            <CountBadge count={unreadCount} />
          </View>
        </View>
      </View>

      {/* Đơn của cuộc trò chuyện: để biết rõ khách nào, đơn nào */}
      <View className="gap-1 rounded-md bg-canvas-subtle px-3 py-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Icon name="receipt-outline" size="xs" tone="muted" />
          <Text variant="caption" weight="semibold">
            Đơn #{order.code}
          </Text>
          <OrderStatusBadge status={order.status} />
        </View>
        {partiesText.length > 0 && (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {partiesText}
          </Text>
        )}
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {itemsText}
          {moreItems > 0 ? ` và ${moreItems} món khác` : ''} · {formatVND(order.total)}
        </Text>
        {viewerRole !== 'CUSTOMER' && (
          <Text variant="micro" tone="muted" numberOfLines={1}>
            Giao đến: {order.deliveryAddress}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

/**
 * Dòng gọn cho chủ quán và tài xế (kiểu Zalo/Messenger): avatar, tên, vai trò, tin cuối, giờ, số chưa đọc,
 * và một dòng mã đơn + trạng thái. Đối tác nhận nhiều cuộc trò chuyện nên cần xem được nhiều dòng một lúc.
 */
const CompactConversationRow: React.FC<{ item: ChatConversation; viewerRole?: Role; onPress: () => void }> = ({
  item,
  viewerRole,
  onPress,
}) => {
  const { counterpart, order, lastMessage, unreadCount } = item;
  const unread = unreadCount > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${counterpart.name}, ${SIDE_LABEL[counterpart.side]}, đơn ${order.code}${
        unread ? `, ${unreadCount} tin chưa đọc` : ''
      }. ${lastMessage.content}`}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 active:bg-canvas-subtle ${unread ? 'bg-brand-50/60' : 'bg-surface'}`}
    >
      {/* Khung đúng bằng ảnh (md = 40pt) để huy hiệu vai trò nằm đúng góc dưới phải */}
      <View className="h-10 w-10">
        <Avatar uri={counterpart.avatarUrl} name={counterpart.name} size="md" />
        <View
          className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-surface ${
            counterpart.side === 'DRIVER' ? 'bg-brand-500' : counterpart.side === 'RESTAURANT' ? 'bg-danger' : 'bg-accent-500'
          }`}
        >
          <Icon name={SIDE_ICON[counterpart.side]} size={10} tone="inverse" />
        </View>
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text variant="body" weight={unread ? 'bold' : 'semibold'} numberOfLines={1} className="flex-shrink">
            {counterpart.name}
          </Text>
          <View className="rounded-full bg-canvas-subtle px-1.5 py-0.5">
            <Text variant="micro" weight="medium" tone="muted">
              {SIDE_LABEL[counterpart.side]}
            </Text>
          </View>
          <View className="flex-1" />
          <Text variant="micro" tone={unread ? 'brand' : 'muted'} weight={unread ? 'bold' : 'regular'}>
            {formatChatTime(lastMessage.createdAt)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text
            variant="caption"
            tone={unread ? 'default' : 'secondary'}
            weight={unread ? 'semibold' : 'regular'}
            numberOfLines={1}
            className="flex-1"
          >
            {lastMessage.isMine ? `Bạn: ${lastMessage.content}` : lastMessage.content}
          </Text>
          <CountBadge count={unreadCount} />
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="receipt-outline" size={12} tone="muted" />
          <Text variant="micro" weight="medium" tone="muted" numberOfLines={1} className="flex-1">
            #{order.code} · {order.itemCount} món · {formatVND(order.total)}
          </Text>
          <OrderStatusBadge
            status={order.status}
            role={viewerRole === 'DRIVER' ? 'driver' : 'owner'}
          />
        </View>
      </View>
    </Pressable>
  );
};

/**
 * Hộp thư tin nhắn: mọi cuộc trò chuyện theo đơn của người dùng, mỗi dòng có người bên kia,
 * tin cuối, số tin chưa đọc và thông tin đơn.
 * - Khách hàng: mở từ trang Tài khoản (màn trong stack, có nút quay lại).
 * - Chủ quán, tài xế: là một tab trên thanh tab (route tên kết thúc bằng "Tab").
 */
export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const isTab = route.name.endsWith('Tab');
  const isFocused = useIsFocused();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: queryKeys.chat.conversations,
    queryFn: ({ pageParam }) => ordersApi.getConversations({ page: pageParam, limit: 30 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!user,
  });

  // Quay lại màn này (vd. sau khi đọc một cuộc trò chuyện) thì làm mới số chưa đọc
  useFocusEffect(
    useCallback(() => {
      if (user) query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]),
  );

  const all = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const unreadTotal = all.reduce((s, c) => s + c.unreadCount, 0);

  const visible = useMemo(() => {
    const needle = normalize(search.trim());
    return all.filter((c) => {
      if (filter === 'UNREAD' && c.unreadCount === 0) return false;
      if (filter !== 'ALL' && filter !== 'UNREAD' && c.counterpart.side !== filter) return false;
      if (!needle) return true;
      const haystack = normalize(
        [c.order.code, c.counterpart.name, c.order.customer.fullName, c.order.restaurant.name].join(' '),
      );
      return haystack.includes(needle.replace(/^#/, ''));
    });
  }, [all, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  };

  const openChat = (c: ChatConversation) =>
    navigation.navigate('Chat', {
      orderId: c.orderId,
      channel: c.channel,
      recipientName: c.counterpart.name,
      recipientRole: SIDE_LABEL[c.counterpart.side],
    });

  const filters = (
    <View className="gap-2.5 border-b border-line-subtle bg-surface px-4 pb-3 pt-2">
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onClear={() => setSearch('')}
        placeholder="Tìm theo mã đơn, tên khách, tên quán"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View className="flex-row flex-wrap gap-2">
        <FilterChip label="Tất cả" selected={filter === 'ALL'} onPress={() => setFilter('ALL')} />
        <FilterChip
          label={unreadTotal > 0 ? `Chưa đọc (${unreadTotal})` : 'Chưa đọc'}
          selected={filter === 'UNREAD'}
          onPress={() => setFilter('UNREAD')}
        />
        {(role ? SIDE_FILTERS[role] ?? [] : []).map((side) => (
          <FilterChip key={side} label={SIDE_LABEL[side]} selected={filter === side} onPress={() => setFilter(side)} />
        ))}
      </View>
    </View>
  );

  const body = query.isLoading ? (
    <LoadingSpinner message="Đang tải tin nhắn..." />
  ) : query.isError ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Không tải được tin nhắn"
      description="Vui lòng kiểm tra kết nối và thử lại."
      actionLabel="Thử lại"
      onAction={() => query.refetch()}
      className="flex-1"
    />
  ) : (
    <FlatList
      data={visible}
      keyExtractor={(c) => `${c.orderId}:${c.channel}`}
      renderItem={({ item }) =>
        role === 'RESTAURANT_OWNER' || role === 'DRIVER' ? (
          <CompactConversationRow item={item} viewerRole={role} onPress={() => openChat(item)} />
        ) : (
          <ConversationRow item={item} viewerRole={role} onPress={() => openChat(item)} />
        )
      }
      ItemSeparatorComponent={
        role === 'RESTAURANT_OWNER' || role === 'DRIVER'
          ? () => <View className="ml-[68px] h-px bg-line-subtle" />
          : undefined
      }
      ListHeaderComponent={filters}
      stickyHeaderIndices={[0]}
      contentContainerClassName={isTab ? TAB_BAR_CLEARANCE : 'pb-6'}
      contentContainerStyle={visible.length === 0 ? { flexGrow: 1 } : undefined}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator className="py-4" color={palette.brand['500']} /> : undefined
      }
      ListEmptyComponent={
        all.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Chưa có tin nhắn nào"
            description={(role && EMPTY_HINT[role]) || 'Các cuộc trò chuyện theo đơn hàng sẽ hiện ở đây.'}
            className="flex-1"
          />
        ) : (
          <EmptyState
            icon="search-outline"
            title="Không có cuộc trò chuyện phù hợp"
            description="Thử bỏ bộ lọc hoặc tìm bằng từ khoá khác."
            className="flex-1"
          />
        )
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />
      }
    />
  );

  if (isTab) {
    return (
      <View className="flex-1 bg-canvas-subtle">
        {isFocused && <StatusBar style="light" />}
        <TabHeader
          title="Tin nhắn"
          subtitle={unreadTotal > 0 ? `${unreadTotal} tin nhắn chưa đọc` : 'Trao đổi theo từng đơn hàng'}
        />
        {body}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} className="bg-canvas">
        <TopBar title="Tin nhắn" onLeadingPress={() => navigation.goBack()} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} className="flex-1">
        {body}
      </SafeAreaView>
    </View>
  );
};
