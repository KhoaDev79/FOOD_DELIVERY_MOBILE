import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PublicRestaurantReview } from '../../../types/api';
import { formatDate } from '../../../utils/format';
import { AppImage, Avatar, Icon, Text } from '../../ui';
import { ImageViewerModal } from './ImageViewerModal';

/** Một đánh giá công khai của quán: sao, nhận xét, ảnh (bấm để phóng to), phản hồi của quán. */
export const ReviewCard: React.FC<{ review: PublicRestaurantReview }> = ({ review: rv }) => {
  const [viewer, setViewer] = useState<number | null>(null);
  const images = rv.images ?? [];

  return (
    <View className="gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={rv.customerName} uri={rv.customerAvatarUrl} size="sm" />
        <View className="flex-1">
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {rv.customerName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className="flex-row">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name={i <= rv.rating ? 'star' : 'star-outline'} size={12} tone={i <= rv.rating ? 'rating' : 'muted'} />
              ))}
            </View>
            <Text variant="micro" weight="regular" tone="muted">
              {formatDate(rv.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {!!rv.comment && (
        <Text variant="body" weight="regular">
          {rv.comment}
        </Text>
      )}

      {images.length > 0 && (
        <View className="flex-row gap-2">
          {images.map((uri, i) => (
            <Pressable
              key={uri}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Xem ảnh ${i + 1} của đánh giá`}
              onPress={() => setViewer(i)}
              className="h-20 w-20 overflow-hidden rounded-xl bg-canvas-subtle"
            >
              <AppImage uri={uri} className="h-full w-full" fallbackIcon="image-outline" />
            </Pressable>
          ))}
        </View>
      )}

      {!!rv.ownerReply && (
        <View className="gap-0.5 rounded-xl bg-canvas-subtle p-3">
          <Text variant="caption" weight="bold">
            Phản hồi của quán
          </Text>
          <Text variant="caption" weight="regular" tone="secondary">
            {rv.ownerReply}
          </Text>
        </View>
      )}

      {/* key theo vị trí mở để mỗi lần xem bắt đầu đúng ảnh */}
      <ImageViewerModal key={viewer ?? -1} images={images} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
};
