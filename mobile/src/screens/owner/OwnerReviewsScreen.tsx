import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, View } from 'react-native';
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
import { ManageRestaurantReview, ReviewImageHideReason } from '../../types/api';
import { AppImage, BottomSheet, cn } from '../../components/ui';
import { resolveImageUrl } from '../../utils/image';
import { OwnerStackParamList } from '../../types/navigation';
import { formatDateTime, orderCode } from '../../utils/format';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerReviews'>;

export const OwnerReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [withPhotos, setWithPhotos] = useState(false);
  // Ảnh đang được thao tác (xem lớn, ẩn / hiện lại)
  const [imageAction, setImageAction] = useState<{ reviewId: string; url: string; hidden: boolean } | null>(null);
  const [hideReason, setHideReason] = useState<ReviewImageHideReason | null>(null);
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
    queryKey: ['owner', 'reviews', restaurant?.id, unrepliedOnly, withPhotos],
    queryFn: () =>
      restaurantsApi.getManageReviews(restaurant!.id, {
        page: 1,
        limit: 50,
        unrepliedOnly,
        withPhotos: withPhotos || undefined,
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

  const imageMutation = useMutation({
    mutationFn: ({ reviewId, url, hide, reason }: { reviewId: string; url: string; hide: boolean; reason?: ReviewImageHideReason }) =>
      hide ? restaurantsApi.hideReviewImage(reviewId, url, reason!) : restaurantsApi.unhideReviewImage(reviewId, url),
    onSuccess: (_res, vars) => {
      void refetch();
      queryClient.invalidateQueries({ queryKey: ['restaurant-reviews'] });
      toast(vars.hide ? 'Đã ẩn ảnh khỏi trang đánh giá công khai' : 'Đã hiện lại ảnh', 'success');
      setImageAction(null);
      setHideReason(null);
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không cập nhật được ảnh', 'error'),
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
              <Badge label={`#${orderCode(item.orderId)}`} tone="neutral" size="sm" />
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

        {!!item.images?.length && (
          <View className="flex-row gap-2">
            {item.images.map((url) => {
              const hidden = item.hiddenImages?.includes(url) ?? false;
              return (
                <Pressable
                  key={url}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={hidden ? 'Ảnh đã ẩn, chạm để hiện lại' : 'Ảnh của khách, chạm để xem hoặc ẩn'}
                  onPress={() => setImageAction({ reviewId: item.id, url, hidden })}
                  className="h-16 w-16 overflow-hidden rounded-lg bg-canvas-subtle"
                >
                  <AppImage uri={url} className={cn('h-full w-full', hidden ? 'opacity-30' : 'opacity-100')} fallbackIcon="image-outline" />
                  {hidden && (
                    <View className="absolute inset-0 items-center justify-center">
                      <Icon name="eye-off" size="sm" tone="default" />
                      <Text variant="micro" weight="bold">
                        Đã ẩn
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
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
        <FilterChip label="Có ảnh" icon="images-outline" selected={withPhotos} onPress={() => setWithPhotos((v) => !v)} />
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

      {/* Xem ảnh lớn + ẩn (bắt buộc lý do) / hiện lại */}
      <BottomSheet
        visible={Boolean(imageAction)}
        onClose={() => {
          setImageAction(null);
          setHideReason(null);
        }}
        title={imageAction?.hidden ? 'Ảnh đang bị ẩn' : 'Ảnh của khách'}
        footer={
          <View className="pb-2">
            {imageAction?.hidden ? (
              <Button
                label="Hiện lại ảnh"
                leftIcon="eye-outline"
                size="md"
                loading={imageMutation.isPending}
                onPress={() => imageAction && imageMutation.mutate({ reviewId: imageAction.reviewId, url: imageAction.url, hide: false })}
              />
            ) : (
              <Button
                label="Ẩn ảnh này"
                leftIcon="eye-off-outline"
                variant="danger"
                size="md"
                disabled={!hideReason}
                loading={imageMutation.isPending}
                onPress={() =>
                  imageAction &&
                  hideReason &&
                  imageMutation.mutate({ reviewId: imageAction.reviewId, url: imageAction.url, hide: true, reason: hideReason })
                }
              />
            )}
          </View>
        }
      >
        {imageAction && (
          <View className="gap-3 pb-3">
            <Image
              source={{ uri: resolveImageUrl(imageAction.url) ?? imageAction.url }}
              style={{ width: '100%', height: 240, borderRadius: 16 }}
              resizeMode="cover"
              accessibilityLabel="Ảnh đánh giá"
            />
            {!imageAction.hidden && (
              <>
                <Text variant="caption" weight="regular" tone="secondary">
                  Chỉ ẩn ảnh không phù hợp. Ảnh món ăn thật dù chưa đẹp không được ẩn; mọi thao tác ẩn đều được ghi lại để
                  ZomZom kiểm tra.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {HIDE_REASONS.map((r) => (
                    <FilterChip
                      key={r.value}
                      label={r.label}
                      selected={hideReason === r.value}
                      onPress={() => setHideReason(r.value)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  );
};

/** Lý do được phép ẩn ảnh đánh giá (khớp backend REVIEW_IMAGE_HIDE_REASONS). */
const HIDE_REASONS: { value: ReviewImageHideReason; label: string }[] = [
  { value: 'IRRELEVANT', label: 'Không liên quan món ăn' },
  { value: 'OFFENSIVE', label: 'Hình ảnh phản cảm' },
  { value: 'PERSONAL_INFO', label: 'Lộ thông tin cá nhân' },
  { value: 'SPAM', label: 'Quảng cáo / spam' },
];
