import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
import { orderCode, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Input,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { palette } from '../../theme';
import { DriverReviewItem } from '../../types/api';
import { DriverStackParamList } from '../../types/navigation';
import { formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverReviews'>;

export const DriverReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const {
    data: reviewsRes,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['driver', 'reviews'],
    queryFn: () => driversApi.getMyReviews({ page: 1, limit: 50 }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => driversApi.replyReview(id, reply),
    onSuccess: (_data, variables) => {
      toast('Đã gửi phản hồi cho khách hàng thành công.', 'success');
      setReplyingId(null);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['driver', 'reviews'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Không thể gửi phản hồi', 'error');
    },
  });

  if (isLoading && !reviewsRes) {
    return <LoadingSpinner message="Đang tải đánh giá..." />;
  }

  const allReviews: DriverReviewItem[] = reviewsRes?.items ?? [];
  const reviews = unrepliedOnly ? allReviews.filter((r) => !r.driverReply) : allReviews;
  const unrepliedCount = allReviews.filter((r) => !r.driverReply).length;

  // Tổng quan điểm sao, tính trên các đánh giá đã tải
  const rated = allReviews.filter((r) => typeof r.driverRating === 'number') as (DriverReviewItem & {
    driverRating: number;
  })[];
  const avgRating = rated.length ? rated.reduce((s, r) => s + r.driverRating, 0) / rated.length : 0;
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: rated.filter((r) => Math.round(r.driverRating) === star).length,
  }));
  const maxStarCount = Math.max(1, ...starCounts.map((s) => s.count));

  const summary = rated.length > 0 && (
    <View className="mb-1 flex-row items-center gap-4 rounded-2xl bg-surface p-4 shadow-card">
      <View className="items-center gap-1">
        <Text variant="display" weight="bold">
          {avgRating.toFixed(1)}
        </Text>
        <View className="flex-row gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Icon
              key={i}
              name={avgRating >= i - 0.25 ? 'star' : avgRating >= i - 0.75 ? 'star-half' : 'star-outline'}
              size={13}
              tone="rating"
            />
          ))}
        </View>
        <Text variant="micro" weight="medium" tone="muted">
          {rated.length}
          {reviewsRes?.hasMore ? ' gần nhất' : ' đánh giá'}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        {starCounts.map(({ star, count }) => (
          <View key={star} className="flex-row items-center gap-2">
            <Text variant="micro" tone="secondary" className="w-3 text-right">
              {star}
            </Text>
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-subtle">
              <View className="h-full rounded-full bg-rating" style={{ width: `${(count / maxStarCount) * 100}%` }} />
            </View>
            <Text variant="micro" weight="medium" tone="muted" className="w-5 text-right">
              {count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: DriverReviewItem }) => {
    const isEditing = replyingId === item.id;
    const currentDraft = replyDrafts[item.id] ?? '';

    return (
      <View className="gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
        {/* Điểm sao + khách hàng + thời gian */}
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-1.5">
            <View className="flex-row items-center gap-0.5 rounded-full bg-accent-500/10 px-2 py-0.5">
              <Icon name="star" size="xs" tone="accent" />
              <Text variant="caption" weight="bold" className="text-accent-600">
                {item.driverRating ?? 5}/5
              </Text>
            </View>
            <Text variant="body" weight="bold">
              {item.customerName || 'Khách hàng'}
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            {formatDateTime(item.createdAt)}
          </Text>
        </View>

        {/* Thông tin đơn và quán */}
        <View className="flex-row items-center gap-2">
          <Badge
            label={`Đơn #${orderCode(item.orderId)}`}
            tone="neutral"
            size="sm"
          />
          {!!item.restaurant?.name && (
            <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
              Quán: {item.restaurant.name}
            </Text>
          )}
        </View>

        {/* Nhận xét của khách */}
        {!!item.driverComment ? (
          <Text variant="body" tone="default" className="mt-1">
            "{item.driverComment}"
          </Text>
        ) : (
          <Text variant="caption" tone="muted" className="italic">
            (Khách không để lại lời nhận xét bằng chữ)
          </Text>
        )}

        {/* Phản hồi hiện tại của tài xế */}
        {!!item.driverReply && (
          <View className="mt-1 rounded-xl bg-brand-50 p-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="caption" weight="bold" tone="brand">
                Phản hồi của bạn:
              </Text>
              {!!item.driverRepliedAt && (
                <Text variant="caption" tone="muted">
                  {formatDateTime(item.driverRepliedAt)}
                </Text>
              )}
            </View>
            <Text variant="caption" tone="default" className="mt-1">
              {item.driverReply}
            </Text>
          </View>
        )}

        {/* Khu vực nhập phản hồi mới */}
        {!item.driverReply && (
          <>
            {isEditing ? (
              <View className="mt-2 gap-2 border-t border-line-subtle pt-3">
                <Input
                  value={currentDraft}
                  onChangeText={(text) =>
                    setReplyDrafts((prev) => ({ ...prev, [item.id]: text }))
                  }
                  placeholder="Nhập lời cảm ơn hoặc phản hồi lịch sự..."
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                <View className="flex-row justify-end gap-2">
                  <Button
                    label="Huỷ"
                    variant="ghost"
                    size="sm"
                    onPress={() => setReplyingId(null)}
                    disabled={replyMutation.isPending}
                  />
                  <Button
                    label="Gửi phản hồi"
                    variant="primary"
                    size="sm"
                    loading={replyMutation.isPending}
                    disabled={!currentDraft.trim()}
                    onPress={() =>
                      replyMutation.mutate({ id: item.id, reply: currentDraft.trim() })
                    }
                  />
                </View>
              </View>
            ) : (
              <View className="mt-1 flex-row justify-end border-t border-line-subtle pt-2">
                <Button
                  label="Phản hồi đánh giá"
                  variant="ghost"
                  size="sm"
                  leftIcon="arrow-undo-outline"
                  onPress={() => {
                    setReplyingId(item.id);
                    if (!replyDrafts[item.id]) {
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [item.id]: 'Cảm ơn bạn đã sử dụng dịch vụ và gửi phản hồi!',
                      }));
                    }
                  }}
                />
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />
      <View className="bg-canvas">
        <TopBar title="Đánh giá từ khách hàng" onLeadingPress={() => navigation.goBack()} />
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          <View className="gap-3">
            {summary}
            {/* Bộ lọc */}
            <SegmentedTabs
              value={unrepliedOnly ? 'UNREPLIED' : 'ALL'}
              onChange={(k) => setUnrepliedOnly(k === 'UNREPLIED')}
              trackClassName="bg-line"
              items={[
                { key: 'ALL', label: 'Tất cả', count: allReviews.length },
                { key: 'UNREPLIED', label: 'Chưa phản hồi', count: unrepliedCount },
              ]}
            />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor={palette.brand[500]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="star-outline"
            title={unrepliedOnly ? 'Không có đánh giá chưa trả lời' : 'Chưa có đánh giá nào'}
            description={
              unrepliedOnly
                ? 'Bạn đã phản hồi tất cả các đánh giá của khách hàng!'
                : 'Khi khách hàng đánh giá chuyến đi, các đánh giá sẽ hiển thị tại đây.'
            }
          />
        }
      />
    </SafeAreaView>
  );
};
