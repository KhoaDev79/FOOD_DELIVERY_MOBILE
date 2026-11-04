import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ordersApi } from '../../api/orders';
import { ChatOrderCard } from '../../components/modules/chat/ChatOrderCard';
import {
  Badge,
  EmptyState,
  Icon,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { ChatChannel, OrderMessage, Role } from '../../types/api';
import { formatDateTime, orderCode } from '../../utils/format';

interface ChatParams {
  orderId: string;
  channel: ChatChannel;
  recipientName?: string;
  recipientRole?: string;
}

/** Gợi ý tin nhắn nhanh theo vai trò của người đang nhắn và người nhận. */
const QUICK_CHIPS: Record<ChatChannel, Partial<Record<Role, string[]>>> = {
  CUSTOMER_DRIVER: {
    CUSTOMER: ['Tôi đang đợi ở sảnh / trước nhà', 'Bạn gọi tôi khi tới nhé', 'Xin chờ tôi 2 phút nhé'],
    DRIVER: ['Tôi đang tới quán lấy món', 'Tôi đã lấy món, đang giao tới bạn', 'Tôi tới nơi rồi ạ'],
  },
  CUSTOMER_RESTAURANT: {
    CUSTOMER: ['Quán làm món giúp tôi ít cay nhé', 'Món của tôi sắp xong chưa ạ?', 'Cho tôi thêm muỗng đũa nhé'],
    RESTAURANT_OWNER: ['Quán đã nhận đơn của bạn', 'Món đang được chuẩn bị bạn nhé', 'Món sắp xong rồi ạ'],
  },
  RESTAURANT_DRIVER: {
    RESTAURANT_OWNER: ['Món đã sẵn sàng, bạn tới lấy nhé', 'Món cần thêm khoảng 5 phút', 'Bạn tới quầy thu ngân nhé'],
    DRIVER: ['Tôi đang tới quán', 'Tôi tới quán rồi ạ', 'Món xong chưa quán ơi?'],
  },
};

const ROLE_LABELS: Record<string, { label: string; tone: 'brand' | 'success' | 'warning' | 'neutral' }> = {
  CUSTOMER: { label: 'Khách hàng', tone: 'brand' },
  DRIVER: { label: 'Tài xế', tone: 'success' },
  RESTAURANT_OWNER: { label: 'Quán ăn', tone: 'warning' },
  ADMIN: { label: 'Quản trị viên', tone: 'neutral' },
};

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ Chat: ChatParams }, 'Chat'>>();
  const { orderId, channel, recipientName, recipientRole } = route.params;

  const toast = useToast();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { socket, isConnected } = useSocket();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const flatListRef = useRef<FlatList<OrderMessage>>(null);

  // 1. Tải lịch sử của ĐÚNG cuộc trò chuyện này (khoá cache gồm cả kênh)
  const { isLoading } = useQuery({
    queryKey: ['order-messages', orderId, channel],
    queryFn: async () => {
      const data = await ordersApi.getMessages(orderId, channel);
      setMessages(data);
      return data;
    },
    enabled: Boolean(orderId && channel),
  });

  // 2. Tin mới thời gian thực: server chỉ gửi tới 2 người của cuộc trò chuyện (phòng riêng của mỗi người),
  //    ở đây lọc thêm theo đơn + kênh vì một người có thể đang có nhiều cuộc trò chuyện.
  useEffect(() => {
    if (!orderId || !channel) return;

    // Đang mở cuộc trò chuyện thì coi như đã đọc (để lần đăng nhập sau không báo lại)
    const markRead = () => {
      ordersApi
        .markMessagesRead(orderId, channel)
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.chat.all }))
        .catch(() => {});
    };
    markRead();

    const handleNewMessage = (newMsg: OrderMessage) => {
      if (newMsg.orderId !== orderId || newMsg.channel !== channel) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      if (newMsg.senderId !== currentUser?.id) markRead();
    };

    socket?.on('order:message', handleNewMessage);
    return () => {
      socket?.off('order:message', handleNewMessage);
    };
  }, [orderId, channel, socket, currentUser?.id, queryClient]);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // 3. Gửi tin nhắn qua REST API (tự động broadcast qua socket và push notification)
  const sendMutation = useMutation({
    mutationFn: (content: string) => ordersApi.sendMessage(orderId, channel, content),
    onSuccess: (sentMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      setInputText('');
      queryClient.invalidateQueries({ queryKey: ['order-messages', orderId, channel] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Không thể gửi tin nhắn.', 'error');
    },
  });

  const canSend = inputText.trim().length > 0 && !sendMutation.isPending;
  const quickChips = (currentUser?.role && QUICK_CHIPS[channel]?.[currentUser.role]) || [];

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!canSend) return;
    sendMutation.mutate(trimmed);
  };

  const handleQuickChip = (text: string) => {
    setInputText(text);
  };

  const renderMessageItem = ({ item }: { item: OrderMessage }) => {
    const isMe = item.senderId === currentUser?.id;
    const roleInfo = ROLE_LABELS[item.senderRole] || { label: item.senderRole, tone: 'neutral' };

    return (
      <View className={`my-1.5 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
        <View
          className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-card ${
            isMe
              ? 'rounded-tr-sm bg-brand-500'
              : 'rounded-tl-sm border border-line-subtle bg-surface'
          }`}
        >
          {/* Header người gửi (nếu là người khác) */}
          {!isMe && (
            <View className="mb-1 flex-row items-center gap-1.5">
              <Text variant="caption" weight="bold" tone="default" numberOfLines={1}>
                {item.sender?.fullName || 'Thành viên'}
              </Text>
              <Badge label={roleInfo.label} tone={roleInfo.tone} size="sm" />
            </View>
          )}

          {/* Nội dung tin nhắn */}
          <Text variant="body" tone={isMe ? 'inverse' : 'default'}>
            {item.content}
          </Text>

          {/* Thời gian */}
          <Text
            variant="micro"
            tone={isMe ? 'inverse' : 'muted'}
            className={`mt-1 text-right ${isMe ? 'opacity-75' : ''}`}
          >
            {formatDateTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <StatusBar style="dark" />
      <TopBar
        title={
          recipientName
            ? `${recipientName} (${recipientRole || `#${orderCode(orderId)}`})`
            : `Đơn #${orderCode(orderId)}`
        }
        onLeadingPress={() => navigation.goBack()}
        trailing={
          <View className="flex-row items-center gap-1.5 pr-2">
            <View
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-success' : 'bg-ink-muted'
              }`}
            />
            <Text variant="micro" tone="muted">
              {isConnected ? 'Trực tuyến' : 'Ngoại tuyến'}
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Đơn hàng của cuộc trò chuyện: khách nào, mua gì, giao đâu */}
        <ChatOrderCard orderId={orderId} />
        {/* Danh sách tin nhắn */}
        {isLoading && messages.length === 0 ? (
          <LoadingSpinner message="Đang tải tin nhắn..." />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubbles-outline"
                title="Chưa có tin nhắn nào"
                description="Hãy bắt đầu cuộc trò chuyện với đối tác hoặc khách hàng trong đơn này."
              />
            }
          />
        )}

        {/* Gợi ý tin nhắn nhanh (theo vai trò của mình trong cuộc trò chuyện) */}
        {quickChips.length > 0 && (
          <View className="border-t border-line-subtle bg-surface px-3 py-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {quickChips.map((chip, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleQuickChip(chip)}
                  className="rounded-full border border-line-subtle bg-canvas-subtle px-3 py-1.5 active:bg-brand-50"
                >
                  <Text variant="caption" tone="secondary">
                    {chip}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Thanh nhập tin nhắn */}
        <View className="flex-row items-center gap-2 border-t border-line-subtle bg-surface p-3">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={palette.ink.muted}
            multiline
            maxLength={1000}
            className="max-h-24 min-h-[42px] flex-1 rounded-2xl border border-line bg-canvas-subtle px-4 py-2 font-body text-body text-ink"
          />
          {/* Lớp active: luôn có từ lần render đầu, chỉ đổi màu nền: NativeWind không phải remount nút */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            className={`h-11 w-11 items-center justify-center rounded-full active:opacity-80 ${
              canSend ? 'bg-brand-500' : 'bg-line'
            }`}
          >
            <Icon name="send" size="sm" tone={canSend ? 'inverse' : 'muted'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

