import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { Icon, Text, useToast } from '../../ui';

export const MAX_REVIEW_PHOTOS = 3;

/**
 * Chọn ảnh món cho đánh giá: tối đa 3 ảnh, chụp mới hoặc chọn từ thư viện.
 * Ảnh được nén (chất lượng 0,6, cắt vuông) và gửi dạng data URI; backend tải lên Cloudinary.
 */
export const ReviewPhotoPicker: React.FC<{ value: string[]; onChange: (photos: string[]) => void }> = ({
  value,
  onChange,
}) => {
  const toast = useToast();

  const pick = async (source: 'camera' | 'library') => {
    if (value.length >= MAX_REVIEW_PHOTOS) {
      toast(`Tối đa ${MAX_REVIEW_PHOTOS} ảnh cho mỗi đánh giá`);
      return;
    }
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast(source === 'camera' ? 'Vui lòng cấp quyền camera' : 'Vui lòng cấp quyền truy cập thư viện ảnh', 'error');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      };
      const res =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset?.base64) return;
      const mime = asset.mimeType && /image\/(jpeg|jpg|png|webp)/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      onChange([...value, `data:${mime};base64,${asset.base64}`].slice(0, MAX_REVIEW_PHOTOS));
    } catch {
      toast('Không lấy được ảnh, vui lòng thử lại', 'error');
    }
  };

  return (
    <View className="gap-2">
      <Text variant="caption" weight="semibold" tone="secondary">
        Thêm ảnh món ăn ({value.length}/{MAX_REVIEW_PHOTOS})
      </Text>
      <View className="flex-row flex-wrap gap-2.5">
        {value.map((uri, i) => (
          <View key={i} className="h-20 w-20 overflow-hidden rounded-xl bg-canvas-subtle">
            <Image source={{ uri }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Ảnh ${i + 1}`} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xoá ảnh ${i + 1}`}
              hitSlop={6}
              onPress={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
            >
              <Icon name="close" size={14} tone="inverse" />
            </Pressable>
          </View>
        ))}
        {value.length < MAX_REVIEW_PHOTOS && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chụp ảnh"
              onPress={() => pick('camera')}
              className="h-20 w-20 items-center justify-center gap-1 rounded-xl border border-dashed border-brand-300 bg-brand-50"
            >
              <Icon name="camera-outline" size="md" tone="brand" />
              <Text variant="micro" weight="semibold" tone="brand">
                Chụp ảnh
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh từ thư viện"
              onPress={() => pick('library')}
              className="h-20 w-20 items-center justify-center gap-1 rounded-xl border border-dashed border-brand-300 bg-brand-50"
            >
              <Icon name="images-outline" size="md" tone="brand" />
              <Text variant="micro" weight="semibold" tone="brand">
                Thư viện
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};
