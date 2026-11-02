import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { resolveImageUrl } from '../../../utils/image';
import { Icon, Text } from '../../ui';

interface HomePromoModalProps {
  visible: boolean;
  onClose: () => void;
  onAction: () => void;
}

const PROMO_LOCAL_IMAGE = require('../../../../assets/promo_modal.jpg');
const PROMO_REMOTE_URI = '/public/images/food/anh_modal_quangcao.jpg';

/**
 * Modal quảng cáo khuyến mãi tự động xuất hiện trên màn hình trang chủ
 * sau khi tải xong dữ liệu 2–5 giây (hiển thị poster khuyến mãi Chuk Tea & Coffee - Combo 25K Bánh Su Kem).
 */
export const HomePromoModal: React.FC<HomePromoModalProps> = ({ visible, onClose, onAction }) => {
  const imageSource = PROMO_LOCAL_IMAGE || { uri: resolveImageUrl(PROMO_REMOTE_URI) };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/65 px-4">
        {/* Nền mờ: bấm ra ngoài để đóng modal */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng quảng cáo"
          onPress={onClose}
          className="absolute inset-0"
        />

        {/* Khung quảng cáo poster trung tâm */}
        <Animated.View
          entering={ZoomIn.duration(280)}
          exiting={FadeOut.duration(200)}
          className="relative w-full max-w-[328px] overflow-hidden rounded-[26px] bg-[#FFF8EE] shadow-2xl"
          style={styles.cardContainer}
        >
          {/* Nút đóng tròn ở góc trên bên phải */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng banner quảng cáo"
            onPress={onClose}
            hitSlop={12}
            className="absolute right-3 top-3 z-30 h-8 w-8 items-center justify-center rounded-full bg-black/50 active:bg-black/80 shadow-md"
          >
            <Icon name="close" size={18} tone="inverse" />
          </Pressable>

          {/* Vùng poster bấm được: chạm vào ảnh để xem ưu đãi */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Khuyến mãi Combo 25k Bánh Su Kem Chuk Tea & Coffee. Chạm để xem và đặt món ngay"
            onPress={onAction}
            className="relative w-full active:opacity-95"
            style={styles.imageRatio}
          >
            <ExpoImage
              source={imageSource}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </Pressable>

          {/* Nút bấm CTA: Đặt món ngay (Nền trắng sang trọng, chữ cam đất ton-sur-ton với poster vàng kem) */}
          <View className="absolute inset-x-4 bottom-3.5 z-20">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đặt món ngay"
              onPress={onAction}
              className="active:scale-98 active:opacity-95"
              style={styles.ctaButton}
            >
              <View className="h-12 w-full flex-row items-center justify-center gap-2 rounded-full bg-white px-5 border border-amber-200/80">
                <Icon name="restaurant" size={17} color="#C2410C" />
                <Text variant="body" weight="bold" className="text-[#C2410C] text-[15px]">
                  Đặt món ngay · 25.000 đ
                </Text>
                <Icon name="arrow-forward" size={16} color="#C2410C" />
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    elevation: 24,
  },
  imageRatio: {
    aspectRatio: 722 / 1024,
    width: '100%',
  },
  ctaButton: {
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
});
