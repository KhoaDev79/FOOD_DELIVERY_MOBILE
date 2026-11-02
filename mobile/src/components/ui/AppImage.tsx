import React, { useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { resolveImageUrl } from '../../utils/image';
import { cn } from './cn';
import { Icon, IconName } from './Icon';
import { Skeleton } from './Skeleton';

export interface AppImageProps {
  uri?: string | null;
  /** Kích thước, bo góc, tỉ lệ ảnh... đặt trên khung ngoài. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  fallbackIcon?: IconName;
  /** Nhãn cho ảnh quan trọng; bỏ trống nếu ảnh chỉ để trang trí. */
  accessibilityLabel?: string;
  resizeMode?: 'cover' | 'contain';
  children?: React.ReactNode;
}

/**
 * Ảnh có khung chờ (skeleton) và ảnh dự phòng khi thiếu/lỗi – không bao giờ để khối xám trống.
 * Dùng expo-image với cachePolicy memory-disk và transition mượt mà.
 * `children` được vẽ chồng lên ảnh (huy hiệu, nút "+").
 */
export const AppImage: React.FC<AppImageProps> = ({
  uri,
  className,
  style,
  fallbackIcon = 'restaurant-outline',
  accessibilityLabel,
  resizeMode = 'cover',
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUrl(uri);
  const showFallback = !resolved || failed;

  return (
    <View
      className={cn('overflow-hidden bg-canvas-subtle', className)}
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {showFallback ? (
        <View className="flex-1 items-center justify-center bg-canvas-subtle">
          <Icon name={fallbackIcon} size="lg" tone="muted" />
        </View>
      ) : (
        <>
          <ExpoImage
            source={{ uri: resolved }}
            contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
            style={StyleSheet.absoluteFill}
            cachePolicy="memory-disk"
            transition={200}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
          {loading && <Skeleton className="absolute inset-0 rounded-none" />}
        </>
      )}
      {children}
    </View>
  );
};
