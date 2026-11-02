import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import {
  Badge,
  Button,
  EmptyState,
  FilterChip,
  Icon,
  Input,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { OwnerRestaurantSelector } from '../../components/modules/owner/OwnerRestaurantSelector';
import { useOwnerRestaurantStore } from '../../store/useOwnerRestaurantStore';
import { palette } from '../../theme';
import { ManageRestaurantReview } from '../../types/api';
import { OwnerStackParamList } from '../../types/navigation';
import { formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerReviews'>;

export const OwnerReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const { data: restaurants, isLoading: loadingRest } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });
  const getActiveRestaurant = useOwnerRestaurantStore((s) => s.getActiveRestaurant);
  const restaurant = getActiveRestaurant(restaurants);

  const {
    data: reviewsRes,
    isLoading: loadingReviews,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['owner', 'reviews', restaurant?.id, unrepliedOnly],
    queryFn: () =>
      restaurantsApi.getManageReviews(restaurant!.id, {
        page: 1,
        limit: 50,
        unrepliedOnly,
      }),
    enabled: Boolean(restaurant?.id),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => restaurantsApi.replyReview(id, reply),
    onSuccess: (_data, variables) => {
      toast('Đã gửi phản hồi đánh giá.', 'success');
      setReplyingId(null);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['owner', 'reviews', restaurant?.id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      toast((Array.isArray(msg) ? msg.join(', ') : msg) || 'Không thể gửi phản hồi', 'error');
    },
  });

  if (loadingRest || (loadingReviews && !reviewsRes)) {
    return <LoadingSpinner message="Đang tải đánh giá..." />;
  }

  const reviews: ManageRestaurantReview[] = reviewsRes?.items ?? [];

  const renderItem = ({ item }: { item: ManageRestaurantReview }) => {
    const isEditing = replyingId === item.id;
    const draft = replyDrafts[item.id] ?? '';

    return (
      <View className="gap-3 rounded-xl bg-surface p-4 shadow-card">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text variant="body" weight="bold">
              {item.customer?.fullName || 'Khách hàng'}
            </Text>
            {item.orderId && (
              <Badge label={`#${item.orderId.slice(-6).toUpperCase()}`} tone="neutral" size="sm" />
            )}
          </View>
          <View className="flex-row items-center gap-0.5">
            {Array.from({ length: 5 }, (_, idx) => (
              <Icon
                key={idx}
                name={idx < item.rating ? 'star' : 'star-outline'}
                size="xs"
                tone={idx < item.rating ? 'rating' : 'muted'}
              />
            ))}
          </View>
        </View>

        {!!item.comment && (
          <Text variant="body" tone="default">
            {item.comment}
          </Text>
        )}

        {item.driverRating !== null && item.driverRating !== undefined && (
          <View className="flex-row items-center gap-1.5 rounded-lg bg-canvas-subtle px-3 py-2">
            <Icon name="bicycle-outline" size="xs" tone="secondary" />
            <Text variant="caption" tone="secondary" className="flex-1">
              Đánh giá tài xế: {item.driverRating}/5 sao
              {item.driverComment ? ` — "${item.driverComment}"` : ''}
            </Text>
          </View>
        )}

        <Text variant="micro" weight="regular" tone="muted">
          {formatDateTime(item.createdAt)}
        </Text>

        {item.ownerReply ? (
          <View className="gap-1 rounded-lg border border-brand-100 bg-brand-50 p-3">
            <Text variant="caption" weight="semibold" tone="brand">
              Phản hồi của quán:
            </Text>
            <Text variant="body" tone="default">
              {item.ownerReply}
            </Text>
            {!!item.ownerRepliedAt && (
              <Text variant="micro" weight="regular" tone="muted">
                {formatDateTime(item.ownerRepliedAt)}
              </Text>
            )}
          </View>
        ) : isEditing ? (
          <View className="gap-2 border-t border-line-subtle pt-3">
            <Input
              label="Nội dung phản hồi (chỉ gửi 1 lần)"
              placeholder="Cảm ơn quý khách đã ủng hộ quán..."
              value={draft}
              onChangeText={(t) => setReplyDrafts((prev) => ({ ...prev, [item.id]: t }))}
              multiline
            />
            <View className="flex-row justify-end gap-2">
              <Button
                label="Huỷ"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={() => setReplyingId(null)}
              />
              <Button
                label="Gửi phản hồi"
                variant="primary"
                size="sm"
                fullWidth={false}
                loading={replyMutation.isPending}
                disabled={draft.trim().length < 2}
                onPress={() => replyMutation.mutate({ id: item.id, reply: draft.trim() })}
              />
            </View>
          </View>
        ) : (
          <View className="flex-row justify-end border-t border-line-subtle pt-2">
            <Button
              label="Phản hồi thực khách"
              leftIcon="chatbubble-outline"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => setReplyingId(item.id)}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="dark" />
      <TopBar title="Đánh giá của thực khách" onLeadingPress={() => navigation.goBack()} />

      {restaurant && (
        <View className="px-4 pt-2">
          <OwnerRestaurantSelector
            restaurants={restaurants}
            currentRestaurant={restaurant}
          />
        </View>
      )}

      <View className="flex-row items-center gap-2 px-4 py-3">
        <FilterChip
          label="Tất cả"
          selected={!unrepliedOnly}
          onPress={() => setUnrepliedOnly(false)}
        />
        <FilterChip
          label="Chưa phản hồi"
          selected={unrepliedOnly}
          onPress={() => setUnrepliedOnly(true)}
        />
      </View>

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="gap-3 px-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            colors={[palette.brand['500']]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title={unrepliedOnly ? 'Không có đánh giá chưa phản hồi' : 'Chưa có đánh giá nào'}
            description="Đánh giá từ khách hàng sau khi hoàn thành đơn sẽ xuất hiện tại đây."
          />
        }
      />
    </View>
  );
};

