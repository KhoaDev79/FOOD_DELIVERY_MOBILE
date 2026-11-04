import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveImageUrl } from '../../../utils/image';
import { Icon, Text } from '../../ui';

/** Xem ảnh đánh giá toàn màn hình, vuốt ngang để chuyển ảnh. */
export const ImageViewerModal: React.FC<{
  images: string[];
  /** Vị trí ảnh mở ra; null = đóng */
  index: number | null;
  onClose: () => void;
}> = ({ images, index, onClose }) => {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index ?? 0);

  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (index ?? 0) * width, y: 0 }}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((uri, i) => (
            <View key={i} style={{ width, height }} className="items-center justify-center">
              <Image source={{ uri: resolveImageUrl(uri) ?? uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityLabel={`Ảnh ${i + 1}`} />
            </View>
          ))}
        </ScrollView>
        <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
          <View className="flex-row items-center justify-between px-4 py-2">
            <Text variant="body" weight="semibold" tone="inverse">
              {Math.min(current, images.length - 1) + 1}/{images.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
            >
              <Icon name="close" size="lg" tone="inverse" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
