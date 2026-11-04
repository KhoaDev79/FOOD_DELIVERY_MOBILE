import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppImage,
  Button,
  Divider,
  EmptyState,
  Gradient,
  Icon,
  IconName,
  IconTone,
  OrderStatusBadge,
  Skeleton,
  Text,
} from '../../components/ui';
import {
  useHelpArticles,
  useHelpCategories,
  useOpenTicketsCount,
  usePopularHelpArticles,
} from '../../services/useHelp';
import { useMyOrders } from '../../services/useOrders';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { HelpArticle, HelpCategory, OrderStatus, OrderSummary as Order } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatDateTime, formatVND, orderCode } from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

/** Màu ô icon cho từng chủ đề (xoay vòng), giữ giao diện nhiều màu của app. */
const TOPIC_TONES: { box: string; tone: IconTone }[] = [
  { box: 'bg-brand-50', tone: 'brand' },
  { box: 'bg-warning-soft', tone: 'warning' },
  { box: 'bg-danger-soft', tone: 'danger' },
  { box: 'bg-violet-soft', tone: 'violet' },
  { box: 'bg-info-soft', tone: 'info' },
  { box: 'bg-success-soft', tone: 'success' },
];

const SectionTitle: React.FC<{ title: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <View className="flex-row items-center justify-between px-1">
    <Text variant="headline" weight="bold">
      {title}
    </Text>
    {!!actionLabel && (
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} className="active:opacity-70">
        <Text variant="caption" weight="semibold" tone="brand">
          {actionLabel}
        </Text>
      </Pressable>
    )}
  </View>
);

const ArticleRow: React.FC<{ article: HelpArticle; onPress: () => void; showMeta?: boolean }> = ({
  article,
  onPress,
  showMeta,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={article.title}
    onPress={onPress}
    className="flex-row items-center gap-3 px-4 py-3.5 active:bg-canvas-subtle"
  >
    <Icon name="document-text-outline" size="sm" tone="muted" />
    <View className="flex-1">
      <Text variant="body" weight="medium" numberOfLines={2}>
        {article.title}
      </Text>
      {showMeta && !!article.category && (
        <Text variant="micro" weight="regular" tone="muted" className="mt-0.5">
          {article.category.name}
        </Text>
      )}
    </View>
    <Icon name="chevron-forward" size="sm" tone="muted" />
  </Pressable>
);

const ArticleListSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <View className="gap-4 rounded-2xl bg-surface p-4 shadow-card">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-4 w-full" />
    ))}
  </View>
);

/** Thẻ đơn đang giao: lối vào hỗ trợ nhanh nhất (giống GrabFood / ShopeeFood). */
const ActiveOrderCard: React.FC<{ order: Order; onTrack: () => void; onIssue: () => void }> = ({
  order,
  onTrack,
  onIssue,
}) => (
  <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
    <View className="flex-row items-center gap-2">
      <View className="h-2 w-2 rounded-full bg-success" />
      <Text variant="caption" weight="bold" tone="success">
        Đơn đang thực hiện
      </Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onTrack} className="flex-row items-center gap-3 active:opacity-80">
      <AppImage uri={order.restaurant?.imageUrl} className="h-14 w-14 rounded-xl" fallbackIcon="restaurant" />
      <View className="flex-1 gap-1">
        <Text variant="body" weight="bold" numberOfLines={1}>
          {order.restaurant?.name || 'Nhà hàng'}
        </Text>
        <OrderStatusBadge status={order.status} role="customer" />
      </View>
      <Icon name="chevron-forward" size="sm" tone="muted" />
    </Pressable>
    <View className="flex-row gap-2">
      <Button label="Theo dõi đơn" variant="secondary" size="md" leftIcon="navigate-outline" onPress={onTrack} className="flex-1" />
      <Button label="Cần hỗ trợ" variant="primary" size="md" leftIcon="help-buoy-outline" onPress={onIssue} className="flex-1" />
    </View>
  </View>
);

/** Thẻ đơn gần đây dạng trượt ngang: chọn đơn để báo vấn đề. */
const RecentOrderCard: React.FC<{ order: Order; onPress: () => void }> = ({ order, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Báo vấn đề với đơn ${order.restaurant?.name ?? ''}`}
    onPress={onPress}
    className="w-60 gap-2.5 rounded-2xl bg-surface p-3 shadow-card active:opacity-80"
  >
    <View className="flex-row items-center gap-2.5">
      <AppImage uri={order.restaurant?.imageUrl} className="h-11 w-11 rounded-xl" fallbackIcon="restaurant" />
      <View className="flex-1">
        <Text variant="body" weight="semibold" numberOfLines={1}>
          {order.restaurant?.name || 'Nhà hàng'}
        </Text>
        <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
          #{orderCode(order.id)} · {formatDateTime(order.createdAt)}
        </Text>
      </View>
    </View>
    <View className="flex-row items-center justify-between">
      <OrderStatusBadge status={order.status} role="customer" />
      <Text variant="caption" weight="bold">
        {formatVND(order.total)}
      </Text>
    </View>
    <View className="flex-row items-center justify-center gap-1 rounded-xl bg-brand-50 py-2">
      <Icon name="alert-circle-outline" size="xs" tone="brand" />
      <Text variant="caption" weight="semibold" tone="brand">
        Báo vấn đề
      </Text>
    </View>
  </Pressable>
);

export const HelpCenterScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);

  // Chờ người dùng ngừng gõ 300ms rồi mới tìm, tránh gọi API mỗi phím
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isFiltering = Boolean(query) || Boolean(selectedCategory);

  const categoriesQuery = useHelpCategories('CUSTOMER');
  const popularQuery = usePopularHelpArticles();
  const { data: openTicketsCount = 0 } = useOpenTicketsCount();
  const articlesQuery = useHelpArticles(
    isFiltering ? { categoryId: selectedCategory?.id, q: query || undefined } : undefined,
  );
  const { data: ordersData, isLoading: loadingOrders } = useMyOrders();

  const { activeOrder, recentOrders } = useMemo(() => {
    const items = ordersData?.items ?? [];
    const active = items.find((o) => ACTIVE_STATUSES.includes(o.status));
    return {
      activeOrder: active,
      recentOrders: items.filter((o) => o.id !== active?.id).slice(0, 5),
    };
  }, [ordersData]);

  const firstName = user?.fullName ? user.fullName.trim().split(/\s+/).pop() : undefined;

  const openArticle = (a: HelpArticle) => navigation.navigate('HelpArticle', { articleId: a.id, title: a.title });
  const requireLogin = (go: () => void) => (isAuthenticated ? go() : navigation.navigate('Login'));
  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setSelectedCategory(null);
  };

  const faqFailed = categoriesQuery.isError && popularQuery.isError;

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="light" />

      {/* Đầu trang: lời chào + ô tìm kiếm */}
      <Gradient preset="tabHeader" style={{ paddingTop: insets.top }} className="overflow-hidden rounded-b-2xl px-4 pb-5">
        <View className="w-full max-w-[720px] self-center">
          <View className="flex-row items-center gap-2 py-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => navigation.goBack()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:opacity-75"
            >
              <Icon name="chevron-back" size="md" tone="inverse" />
            </Pressable>
            <Text variant="headline" weight="bold" tone="inverse" className="flex-1">
              Trung tâm trợ giúp
            </Text>
          </View>

          <Text variant="title" weight="bold" tone="inverse" className="mt-1">
            {firstName ? `Chào ${firstName}, ` : ''}bạn cần hỗ trợ gì?
          </Text>

          <View className="mt-3 flex-row items-center rounded-full bg-surface px-4 py-2.5">
            <Icon name="search" size="sm" tone="muted" />
            <TextInput
              className="flex-1 px-2.5 py-0 font-body text-body text-ink"
              placeholder="Tìm câu hỏi: phí ship, huỷ đơn, hoàn tiền…"
              placeholderTextColor={palette.ink.muted}
              value={searchInput}
              onChangeText={setSearchInput}
              returnKeyType="search"
              onSubmitEditing={() => setQuery(searchInput.trim())}
              accessibilityLabel="Tìm kiếm câu hỏi"
            />
            {!!searchInput && (
              <Pressable accessibilityRole="button" accessibilityLabel="Xoá tìm kiếm" onPress={clearFilters} hitSlop={8}>
                <Icon name="close-circle" size="sm" tone="muted" />
              </Pressable>
            )}
          </View>
        </View>
      </Gradient>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View className="w-full max-w-[720px] gap-6 self-center px-4 pt-4">
          {isFiltering ? (
            /* ================= KẾT QUẢ TÌM KIẾM / THEO CHỦ ĐỀ ================= */
            <View className="gap-3">
              {/* Lọc nhanh giữa các chủ đề */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedCategory(null)}
                  className={`rounded-full px-3.5 py-1.5 ${!selectedCategory ? 'bg-brand-500' : 'bg-surface'}`}
                >
                  <Text variant="caption" weight="semibold" tone={!selectedCategory ? 'inverse' : 'secondary'}>
                    Tất cả
                  </Text>
                </Pressable>
                {categoriesQuery.data?.map((cat) => {
                  const active = selectedCategory?.id === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedCategory(cat)}
                      className={`rounded-full px-3.5 py-1.5 ${active ? 'bg-brand-500' : 'bg-surface'}`}
                    >
                      <Text variant="caption" weight="semibold" tone={active ? 'inverse' : 'secondary'}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <SectionTitle
                title={query ? `Kết quả cho “${query}”` : selectedCategory?.name ?? 'Bài viết'}
                actionLabel="Quay lại"
                onAction={clearFilters}
              />

              {articlesQuery.isLoading ? (
                <ArticleListSkeleton />
              ) : articlesQuery.isError ? (
                <EmptyState
                  variant="card"
                  icon="cloud-offline-outline"
                  title="Không tải được bài viết"
                  description="Vui lòng kiểm tra kết nối mạng."
                  actionLabel="Thử lại"
                  onAction={() => articlesQuery.refetch()}
                />
              ) : articlesQuery.data && articlesQuery.data.length > 0 ? (
                <View className="overflow-hidden rounded-2xl bg-surface shadow-card">
                  {articlesQuery.data.map((a, idx) => (
                    <React.Fragment key={a.id}>
                      {idx > 0 && <Divider inset />}
                      <ArticleRow article={a} onPress={() => openArticle(a)} showMeta={!selectedCategory} />
                    </React.Fragment>
                  ))}
                </View>
              ) : (
                <EmptyState
                  variant="card"
                  icon="search-outline"
                  title="Chưa tìm thấy câu trả lời"
                  description="Thử từ khoá khác, hoặc hỏi Trợ lý ZomZom để được trả lời ngay."
                  actionLabel="Hỏi Trợ lý ZomZom"
                  onAction={() => requireLogin(() => navigation.navigate('SupportChat'))}
                />
              )}

              {!!articlesQuery.data?.length && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => requireLogin(() => navigation.navigate('SupportChat'))}
                  className="flex-row items-center justify-center gap-1.5 py-2 active:opacity-70"
                >
                  <Text variant="caption" tone="secondary">
                    Không thấy câu trả lời?
                  </Text>
                  <Text variant="caption" weight="bold" tone="brand">
                    Hỏi Trợ lý ZomZom
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            /* ================= TRANG CHÍNH ================= */
            <>
              {/* 1. Hỗ trợ theo đơn */}
              {!isAuthenticated ? (
                <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                    <Icon name="receipt-outline" size="md" tone="brand" />
                  </View>
                  <View className="flex-1">
                    <Text variant="body" weight="bold">
                      Cần hỗ trợ về đơn hàng?
                    </Text>
                    <Text variant="caption" weight="regular" tone="secondary">
                      Đăng nhập để chọn đơn và được xử lý nhanh hơn.
                    </Text>
                  </View>
                  <Button label="Đăng nhập" size="sm" onPress={() => navigation.navigate('Login')} />
                </View>
              ) : loadingOrders ? (
                <Skeleton className="h-32 w-full rounded-2xl" />
              ) : (
                <>
                  {activeOrder && (
                    <ActiveOrderCard
                      order={activeOrder}
                      onTrack={() => navigation.navigate('OrderTracking', { orderId: activeOrder.id })}
                      onIssue={() => navigation.navigate('OrderIssue', { orderId: activeOrder.id })}
                    />
                  )}

                  {recentOrders.length > 0 && (
                    <View className="gap-3">
                      <SectionTitle
                        title="Bạn cần hỗ trợ đơn nào?"
                        actionLabel="Tất cả đơn"
                        onAction={() => navigation.navigate('MainTabs', { screen: 'OrdersTab' })}
                      />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerClassName="gap-3 px-0.5 pb-1"
                      >
                        {recentOrders.map((o) => (
                          <RecentOrderCard
                            key={o.id}
                            order={o}
                            onPress={() => navigation.navigate('OrderIssue', { orderId: o.id })}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {faqFailed ? (
                <EmptyState
                  variant="card"
                  icon="cloud-offline-outline"
                  title="Không tải được nội dung trợ giúp"
                  description="Vui lòng kiểm tra kết nối mạng rồi thử lại."
                  actionLabel="Thử lại"
                  onAction={() => {
                    categoriesQuery.refetch();
                    popularQuery.refetch();
                  }}
                />
              ) : (
                <>
                  {/* 2. Chủ đề */}
                  <View className="gap-3">
                    <SectionTitle title="Chủ đề hỗ trợ" />
                    {categoriesQuery.isLoading ? (
                      <View className="flex-row flex-wrap gap-3">
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-24 w-[47%] rounded-2xl" />
                        ))}
                      </View>
                    ) : (
                      <View className="flex-row flex-wrap justify-between gap-y-3">
                        {categoriesQuery.data?.map((cat, idx) => {
                          const tone = TOPIC_TONES[idx % TOPIC_TONES.length];
                          return (
                            <Pressable
                              key={cat.id}
                              accessibilityRole="button"
                              accessibilityLabel={cat.name}
                              onPress={() => setSelectedCategory(cat)}
                              className="w-[48.5%] gap-2.5 rounded-2xl bg-surface p-3.5 shadow-card active:opacity-80"
                            >
                              <View className={`h-10 w-10 items-center justify-center rounded-xl ${tone.box}`}>
                                <Icon name={(cat.icon || 'help-circle-outline') as IconName} size="md" tone={tone.tone} />
                              </View>
                              <View>
                                <Text variant="body" weight="semibold" numberOfLines={2}>
                                  {cat.name}
                                </Text>
                                <Text variant="micro" weight="regular" tone="muted" className="mt-0.5">
                                  {cat._count?.articles ?? 0} bài viết
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* 3. Câu hỏi phổ biến */}
                  <View className="gap-3">
                    <SectionTitle title="Câu hỏi thường gặp" />
                    {popularQuery.isLoading ? (
                      <ArticleListSkeleton rows={5} />
                    ) : popularQuery.data && popularQuery.data.length > 0 ? (
                      <View className="overflow-hidden rounded-2xl bg-surface shadow-card">
                        {popularQuery.data.map((a, idx) => (
                          <React.Fragment key={a.id}>
                            {idx > 0 && <Divider inset />}
                            <ArticleRow article={a} onPress={() => openArticle(a)} />
                          </React.Fragment>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </>
              )}

              {/* 4. Vẫn cần hỗ trợ */}
              <View className="gap-3">
                <SectionTitle title="Vẫn cần hỗ trợ?" />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trò chuyện với Trợ lý ZomZom"
                  onPress={() => requireLogin(() => navigation.navigate('SupportChat'))}
                  className="overflow-hidden rounded-2xl shadow-card active:opacity-90"
                >
                  <Gradient preset="tabHeader" className="flex-row items-center gap-3 p-4">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-white/20">
                      <Icon name="sparkles" size="lg" tone="inverse" />
                    </View>
                    <View className="flex-1">
                      <Text variant="body" weight="bold" tone="inverse">
                        Chat với Trợ lý ZomZom
                      </Text>
                      <Text variant="caption" weight="regular" tone="inverse" className="opacity-90">
                        Trả lời ngay 24/7 · Kiểm tra đơn, phí ship, huỷ đơn
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size="md" tone="inverse" />
                  </Gradient>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Yêu cầu hỗ trợ của tôi"
                  onPress={() => requireLogin(() => navigation.navigate('SupportTicketList'))}
                  className="flex-row items-center gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-80"
                >
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-accent-50">
                    <Icon name="chatbubbles-outline" size="lg" tone="accent" />
                  </View>
                  <View className="flex-1">
                    <Text variant="body" weight="bold">
                      Yêu cầu hỗ trợ của tôi
                    </Text>
                    <Text variant="caption" weight="regular" tone="secondary">
                      {openTicketsCount > 0
                        ? `${openTicketsCount} yêu cầu đang được xử lý`
                        : 'Theo dõi phản hồi từ nhân viên CSKH'}
                    </Text>
                  </View>
                  {openTicketsCount > 0 && (
                    <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-danger px-1.5">
                      <Text variant="micro" weight="bold" tone="inverse">
                        {openTicketsCount}
                      </Text>
                    </View>
                  )}
                  <Icon name="chevron-forward" size="sm" tone="muted" />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
