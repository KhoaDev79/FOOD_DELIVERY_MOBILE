import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NoticeCard } from '../../components/modules/partner/PartnerKit';
import {
  AppImage,
  Button,
  Icon,
  IconName,
  IconTone,
  LoadingSpinner,
  OrderStatusBadge,
  Text,
  useToast,
} from '../../components/ui';
import {
  useBotHandover,
  useBotMessages,
  useBotWelcome,
  useSendBotMessage,
  useSubmitBotFeedback,
} from '../../services/useHelp';
import { palette } from '../../theme';
import { BotActionCard, BotReplyResult } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ChatMessage = BotReplyResult & { failed?: boolean; local?: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

const WELCOME_TOPICS: { label: string; icon: IconName; box: string; tone: IconTone }[] = [
  { label: 'Tìm giúp tôi quán bún bò', icon: 'restaurant-outline', box: 'bg-brand-50', tone: 'brand' },
  { label: 'Đơn của tôi đang ở đâu?', icon: 'bicycle-outline', box: 'bg-info-soft', tone: 'info' },
  { label: 'Phí ship tính thế nào?', icon: 'cash-outline', box: 'bg-success-soft', tone: 'success' },
  { label: 'Tôi muốn huỷ đơn', icon: 'close-circle-outline', box: 'bg-danger-soft', tone: 'danger' },
  { label: 'Món bị thiếu hoặc sai', icon: 'fast-food-outline', box: 'bg-warning-soft', tone: 'warning' },
  { label: 'Gặp nhân viên CSKH', icon: 'headset-outline', box: 'bg-violet-soft', tone: 'violet' },
];

const BotAvatar: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => (
  <View
    className={`items-center justify-center rounded-full bg-brand-500 ${size === 'lg' ? 'h-16 w-16' : 'h-8 w-8'}`}
  >
    <Icon name="sparkles" size={size === 'lg' ? 30 : 15} tone="inverse" />
  </View>
);

/** Ba chấm nhấp nháy "đang soạn". Mỗi Animated.View chỉ nhận 1 style động (tránh lỗi iOS). */
const TypingDots: React.FC = () => {
  const [values] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    const anims = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [values]);

  return (
    <View className="flex-row items-end gap-2">
      <BotAvatar />
      <View className="flex-row items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface px-4 py-3.5 shadow-card">
        {values.map((v, i) => (
          <Animated.View
            key={i}
            style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.brand['500'], opacity: v }}
          />
        ))}
      </View>
    </View>
  );
};

/** Thẻ hành động trong tin nhắn bot. */
const BotCard: React.FC<{
  card: BotActionCard;
  onPress: (card: BotActionCard) => void;
  handoverLoading?: boolean;
}> = ({ card, onPress, handoverLoading }) => {
  if (card.type === 'ORDER_STATUS') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(card)}
        className="gap-3 rounded-2xl bg-surface p-3 shadow-card active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <AppImage uri={card.imageUrl} className="h-12 w-12 rounded-xl" fallbackIcon="restaurant" />
          <View className="flex-1 gap-1">
            <Text variant="body" weight="bold" numberOfLines={1}>
              {card.title}
            </Text>
            {card.status ? (
              <OrderStatusBadge status={card.status} role="customer" />
            ) : (
              !!card.subtitle && (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {card.subtitle}
                </Text>
              )
            )}
          </View>
        </View>
        <View className="flex-row items-center justify-between border-t border-line-subtle pt-2.5">
          <Text variant="caption" weight="regular" tone="muted">
            {card.orderCode ? `Mã đơn #${card.orderCode}` : 'Đơn hàng'}
          </Text>
          <View className="flex-row items-center gap-0.5">
            <Text variant="caption" weight="bold" tone="brand">
              Theo dõi đơn
            </Text>
            <Icon name="chevron-forward" size={12} tone="brand" />
          </View>
        </View>
      </Pressable>
    );
  }

  if (card.type === 'RESTAURANT') {
    const isClosed = card.isOpen === false;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPress(card)}
        className="gap-2.5 rounded-2xl bg-surface p-3 shadow-card active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          <AppImage uri={card.imageUrl} className="h-14 w-14 rounded-xl" fallbackIcon="restaurant" />
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <Text variant="body" weight="bold" numberOfLines={1} className="flex-1">
                {card.title}
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${isClosed ? 'bg-canvas-muted' : 'bg-success-soft'}`}
              >
                <Text variant="micro" weight="bold" tone={isClosed ? 'muted' : 'success'}>
                  {isClosed ? 'Tạm đóng' : 'Đang mở'}
                </Text>
              </View>
            </View>
            {!!card.matchedDish && (
              <View className="flex-row items-center gap-1">
                <Icon name="fast-food-outline" size={12} tone="brand" />
                <Text variant="caption" weight="semibold" tone="brand" numberOfLines={1} className="flex-1">
                  {card.matchedDish}
                </Text>
              </View>
            )}
            <View className="flex-row items-center gap-2">
              {typeof card.rating === 'number' && card.rating > 0 && (
                <View className="flex-row items-center gap-0.5">
                  <Icon name="star" size={12} tone="warning" />
                  <Text variant="micro" weight="semibold" tone="secondary">
                    {card.rating.toFixed(1)}
                  </Text>
                </View>
              )}
              {typeof card.distanceKm === 'number' && (
                <View className="flex-row items-center gap-0.5">
                  <Icon name="location-outline" size={12} tone="muted" />
                  <Text variant="micro" weight="regular" tone="muted">
                    {card.distanceKm.toFixed(1)} km
                  </Text>
                </View>
              )}
              {!card.matchedDish && !!card.subtitle && (
                <Text variant="micro" weight="regular" tone="muted" numberOfLines={1} className="flex-1">
                  {card.subtitle}
                </Text>
              )}
            </View>
          </View>
        </View>
        <View className="flex-row items-center justify-between border-t border-line-subtle pt-2">
          <Text variant="micro" weight="regular" tone="muted">
            {card.priceText ? `Giá món: ${card.priceText}` : 'Chạm để mở thực đơn quán'}
          </Text>
          <View className="flex-row items-center gap-0.5">
            <Text variant="caption" weight="bold" tone="brand">
              Xem quán & đặt món
            </Text>
            <Icon name="chevron-forward" size={12} tone="brand" />
          </View>
        </View>
      </Pressable>
    );
  }

  if (card.type === 'HANDOVER' || card.type === 'CONTACT_SUPPORT') {
    return (
      <View className="gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-50">
            <Icon name="headset-outline" size="md" tone="accent" />
          </View>
          <View className="flex-1">
            <Text variant="body" weight="bold">
              Chuyển cho nhân viên CSKH
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              {card.subtitle || 'Nhân viên sẽ trả lời trong mục Yêu cầu hỗ trợ'}
            </Text>
          </View>
        </View>
        <Button
          label="Gửi cho nhân viên"
          size="md"
          leftIcon="send-outline"
          loading={handoverLoading}
          onPress={() => onPress(card)}
        />
      </View>
    );
  }

  const isIssue = card.type === 'START_ISSUE';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(card)}
      className="flex-row items-center gap-3 rounded-2xl bg-surface p-3 shadow-card active:opacity-80"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${isIssue ? 'bg-warning-soft' : 'bg-info-soft'}`}
      >
        <Icon
          name={isIssue ? 'alert-circle-outline' : 'document-text-outline'}
          size="md"
          tone={isIssue ? 'warning' : 'info'}
        />
      </View>
      <View className="flex-1">
        <Text variant="caption" weight="bold" numberOfLines={2}>
          {card.title}
        </Text>
        <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
          {isIssue ? card.subtitle || 'Chọn vấn đề và gửi ảnh minh chứng' : 'Xem bài viết hướng dẫn'}
        </Text>
      </View>
      <Icon name="chevron-forward" size="sm" tone="muted" />
    </Pressable>
  );
};

export const SupportChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  // null = chưa thao tác gì: hiển thị cuộc trò chuyện gần nhất lấy từ server
  const [localMessages, setLocalMessages] = useState<ChatMessage[] | null>(null);
  // undefined = dùng hội thoại gần nhất; null = bắt đầu hội thoại mới
  const [convOverride, setConvOverride] = useState<string | null | undefined>(undefined);
  const [inputText, setInputText] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [handoverKey, setHandoverKey] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const seq = useRef(0);

  const historyQuery = useBotMessages();
  const { data: welcome } = useBotWelcome();
  const sendMutation = useSendBotMessage();
  const feedbackMutation = useSubmitBotFeedback();
  const handoverMutation = useBotHandover();

  const history = historyQuery.data;
  const messages: ChatMessage[] = localMessages ?? history ?? [];
  const conversationId =
    convOverride === undefined ? history?.[0]?.conversationId : convOverride ?? undefined;
  const rateLimited = limitHit || (welcome ? welcome.remainingToday <= 0 : false);

  const setMessages = (fn: (prev: ChatMessage[]) => ChatMessage[]) =>
    setLocalMessages((prev) => fn(prev ?? history ?? []));
  const setConversationId = (id: string) => setConvOverride(id);
  const nextId = (prefix: string) => `${prefix}-${++seq.current}`;

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const send = async (raw?: string, retryId?: string) => {
    const text = (raw ?? inputText).trim();
    if (!text || sendMutation.isPending || rateLimited) return;
    if (!raw) setInputText('');

    const localId = retryId ?? nextId('local');
    setMessages((prev) =>
      retryId
        ? prev.map((m) => (m.messageId === retryId ? { ...m, failed: false } : m))
        : [
            ...prev,
            {
              messageId: localId,
              conversationId: conversationId ?? '',
              role: 'user',
              content: text,
              createdAt: new Date().toISOString(),
              local: true,
            },
          ],
    );
    scrollToEnd();

    try {
      const res = await sendMutation.mutateAsync({ content: text, conversationId });
      if (res.conversationId && res.conversationId !== 'none') setConversationId(res.conversationId);
      if (res.isRateLimited) setLimitHit(true);
      setMessages((prev) => [...prev, res]);
      scrollToEnd();
    } catch {
      setMessages((prev) => prev.map((m) => (m.messageId === localId ? { ...m, failed: true } : m)));
      toast('Không gửi được tin nhắn. Chạm vào tin để gửi lại.', 'error');
    }
  };

  const startNewConversation = () => {
    setLocalMessages([]);
    setConvOverride(null);
    setInputText('');
  };

  const handleFeedback = (messageId: string, feedback: 'HELPFUL' | 'UNHELPFUL') => {
    feedbackMutation.mutate({ messageId, feedback });
    setMessages((prev) => prev.map((m) => (m.messageId === messageId ? { ...m, feedback } : m)));
  };

  const handover = async (card: BotActionCard | null, key: string) => {
    setHandoverKey(key);
    try {
      const ticket = await handoverMutation.mutateAsync({
        conversationId,
        orderId: card?.orderId,
        summary: card?.summary,
      });
      setMessages((prev) => [
        ...prev,
        {
          messageId: nextId('system'),
          conversationId: conversationId ?? '',
          role: 'assistant',
          content: `Mình đã gửi yêu cầu ${ticket.code} cho nhân viên CSKH. Bạn sẽ nhận thông báo khi có phản hồi nhé!`,
          source: 'SCRIPT',
          local: true,
        },
      ]);
      navigation.navigate('SupportTicketDetail', { ticketId: ticket.id, code: ticket.code });
    } catch {
      toast('Chưa gửi được yêu cầu, vui lòng thử lại.', 'error');
    } finally {
      setHandoverKey(null);
    }
  };

  const handleCardPress = (card: BotActionCard, key: string) => {
    switch (card.type) {
      case 'ORDER_STATUS':
        if (card.orderId) navigation.navigate('OrderTracking', { orderId: card.orderId });
        break;
      case 'RESTAURANT':
        if (card.restaurantId) {
          navigation.navigate('RestaurantDetail', {
            restaurantId: card.restaurantId,
            openDishId: card.dishId,
          });
        }
        break;
      case 'FAQ_ARTICLE':
        if (card.articleId) navigation.navigate('HelpArticle', { articleId: card.articleId, title: card.title });
        break;
      case 'START_ISSUE':
        navigation.navigate('OrderIssue', { orderId: card.orderId, preselectedIssue: card.issueType });
        break;
      case 'HANDOVER':
      case 'CONTACT_SUPPORT':
        handover(card, key);
        break;
    }
  };

  const lastBotIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  })();
  const lastIsBot = lastBotIndex === messages.length - 1;

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    if (item.role === 'user') {
      return (
        <Pressable
          disabled={!item.failed}
          onPress={() => send(item.content, item.messageId)}
          className="max-w-[80%] items-end self-end"
        >
          <View className={`rounded-2xl rounded-br-md px-4 py-2.5 ${item.failed ? 'bg-danger-soft' : 'bg-brand-500'}`}>
            <Text variant="body" weight="regular" tone={item.failed ? 'danger' : 'inverse'}>
              {item.content}
            </Text>
          </View>
          {item.failed && (
            <View className="mt-1 flex-row items-center gap-1">
              <Icon name="alert-circle" size={12} tone="danger" />
              <Text variant="micro" tone="danger">
                Chưa gửi được · Chạm để gửi lại
              </Text>
            </View>
          )}
        </Pressable>
      );
    }

    const canRate = UUID_RE.test(item.messageId) && !item.local;
    const showQuickReplies = index === lastBotIndex && lastIsBot && !rateLimited && !!item.quickReplies?.length;

    return (
      <View className="flex-row items-start gap-2">
        <BotAvatar />
        <View className="max-w-[85%] flex-1 gap-2">
          <View className="self-start rounded-2xl rounded-tl-md bg-surface px-4 py-3 shadow-card">
            <Text variant="body" weight="regular" className="leading-6">
              {item.content}
            </Text>
          </View>

          {item.cards?.map((card, cIdx) => {
            const key = `${item.messageId}-${cIdx}`;
            return (
              <BotCard
                key={key}
                card={card}
                onPress={(c) => handleCardPress(c, key)}
                handoverLoading={handoverKey === key}
              />
            );
          })}

          {(canRate || item.source === 'SCRIPT') && (
            <View className="flex-row items-center gap-3 px-1">
              {item.source === 'SCRIPT' && welcome?.mode === 'AI' && !item.local && (
                <Text variant="micro" weight="regular" tone="muted">
                  Đang dùng trợ lý cơ bản
                </Text>
              )}
              {canRate && (
                <View className="flex-row items-center gap-1">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Câu trả lời hữu ích"
                    hitSlop={6}
                    onPress={() => handleFeedback(item.messageId, 'HELPFUL')}
                    className={`rounded-full p-1.5 ${item.feedback === 'HELPFUL' ? 'bg-success-soft' : ''}`}
                  >
                    <Icon
                      name={item.feedback === 'HELPFUL' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={14}
                      tone={item.feedback === 'HELPFUL' ? 'success' : 'muted'}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Câu trả lời chưa hữu ích"
                    hitSlop={6}
                    onPress={() => handleFeedback(item.messageId, 'UNHELPFUL')}
                    className={`rounded-full p-1.5 ${item.feedback === 'UNHELPFUL' ? 'bg-danger-soft' : ''}`}
                  >
                    <Icon
                      name={item.feedback === 'UNHELPFUL' ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={14}
                      tone={item.feedback === 'UNHELPFUL' ? 'danger' : 'muted'}
                    />
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {showQuickReplies && (
            <View className="flex-row flex-wrap gap-2 pt-1">
              {item.quickReplies!.map((qr) => (
                <Pressable
                  key={qr}
                  accessibilityRole="button"
                  disabled={sendMutation.isPending}
                  onPress={() => send(qr)}
                  className="rounded-full border border-brand-200 bg-surface px-3.5 py-2 active:bg-brand-50"
                >
                  <Text variant="caption" weight="semibold" tone="brand">
                    {qr}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const WelcomeView = (
    <View className="items-center gap-4 pt-4">
      <BotAvatar size="lg" />
      <View className="items-center gap-1">
        <Text variant="title" weight="bold">
          Trợ lý ZomZom
        </Text>
        <Text variant="body" weight="regular" tone="secondary" className="text-center">
          {welcome?.greeting ??
            'Mình có thể kiểm tra đơn hàng, giải thích phí ship, hướng dẫn huỷ đơn hoặc chuyển bạn tới nhân viên CSKH.'}
        </Text>
      </View>
      <View className="w-full flex-row flex-wrap justify-between gap-y-2.5 pt-2">
        {WELCOME_TOPICS.map((t) => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            disabled={sendMutation.isPending || rateLimited}
            onPress={() => send(t.label)}
            className="w-[48.5%] flex-row items-center gap-2.5 rounded-2xl bg-surface p-3 shadow-card active:opacity-80"
          >
            <View className={`h-9 w-9 items-center justify-center rounded-xl ${t.box}`}>
              <Icon name={t.icon} size="sm" tone={t.tone} />
            </View>
            <Text variant="caption" weight="semibold" className="flex-1" numberOfLines={2}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const remaining = welcome?.remainingToday;
  const canSend = Boolean(inputText.trim()) && !sendMutation.isPending && !rateLimited;

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />

      {/* Đầu trang */}
      <View style={{ paddingTop: insets.top }} className="border-b border-line-subtle bg-surface">
        <View className="w-full max-w-[720px] flex-row items-center gap-3 self-center px-3 py-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={() => navigation.goBack()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-canvas-subtle"
          >
            <Icon name="arrow-back" size="lg" />
          </Pressable>
          <View>
            <BotAvatar />
            <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" />
          </View>
          <View className="flex-1">
            <Text variant="body" weight="bold">
              Trợ lý ZomZom
            </Text>
            <Text variant="micro" weight="regular" tone="secondary" numberOfLines={1}>
              {welcome?.mode === 'BASIC' ? 'Trực tuyến · Trợ lý cơ bản' : 'Trực tuyến · Trả lời tự động 24/7'}
            </Text>
          </View>
          {messages.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bắt đầu cuộc trò chuyện mới"
              onPress={startNewConversation}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-canvas-subtle"
            >
              <Icon name="create-outline" size="md" tone="secondary" />
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {historyQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.messageId}
            renderItem={renderMessage}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, gap: 16, flexGrow: 1 }}
            ListEmptyComponent={WelcomeView}
            ListFooterComponent={sendMutation.isPending ? <TypingDots /> : undefined}
          />
        )}

        {/* Ô nhập */}
        <View style={{ paddingBottom: Math.max(insets.bottom, 10) }} className="border-t border-line-subtle bg-surface">
          <View className="w-full max-w-[720px] gap-2 self-center px-3 pt-2.5">
            {rateLimited ? (
              <NoticeCard
                tone="warning"
                icon="time-outline"
                title="Bạn đã dùng hết lượt hỏi trợ lý hôm nay"
                message="Nhân viên CSKH vẫn có thể hỗ trợ bạn qua yêu cầu hỗ trợ."
                actionLabel="Gửi yêu cầu"
                onPress={() => handover(null, 'rate-limit')}
              />
            ) : (
              <View className="flex-row items-end gap-2">
                <TextInput
                  placeholder="Nhập câu hỏi của bạn…"
                  placeholderTextColor={palette.ink.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={() => send()}
                  submitBehavior="submit"
                  returnKeyType="send"
                  multiline
                  maxLength={500}
                  accessibilityLabel="Nội dung tin nhắn"
                  className="max-h-28 min-h-[44px] flex-1 rounded-3xl bg-canvas-subtle px-4 py-3 font-body text-body text-ink"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gửi tin nhắn"
                  disabled={!canSend}
                  onPress={() => send()}
                  className={`h-11 w-11 items-center justify-center rounded-full ${canSend ? 'bg-brand-500' : 'bg-line-subtle'}`}
                >
                  <Icon name="send" size={18} tone={canSend ? 'inverse' : 'muted'} />
                </Pressable>
              </View>
            )}
            <Text variant="micro" weight="regular" tone="muted" className="text-center">
              {typeof remaining === 'number' && remaining > 0 && remaining <= 5
                ? `Còn ${remaining} lượt hỏi hôm nay · `
                : ''}
              Trợ lý tự động có thể chưa chính xác, hãy kiểm tra trong chi tiết đơn.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};
