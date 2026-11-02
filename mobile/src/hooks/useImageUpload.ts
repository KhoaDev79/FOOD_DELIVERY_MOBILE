import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { adminContentApi } from '../api/adminContent';
import { useToast } from '../components/ui';

/**
 * Chọn ảnh từ máy (cắt theo tỉ lệ, nén sẵn) rồi tải lên máy chủ / Cloudinary.
 * Trả về link ảnh để lưu vào banner / danh mục.
 */
export function useImageUpload(folder: 'banners' | 'cuisines') {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async (): Promise<string | null> => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast('Vui lòng cấp quyền truy cập ảnh để chọn ảnh.', 'error');
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // Banner ngang 16:9, danh mục vuông 1:1 — đúng khung hiển thị ở trang chủ
        aspect: folder === 'banners' ? [16, 9] : [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return null;
      const asset = result.assets[0];
      const mime = asset.mimeType && /png|webp/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      setUploading(true);
      const res = await adminContentApi.uploadImage(`data:${mime};base64,${asset.base64}`, folder);
      return res.url;
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không tải được ảnh lên, vui lòng thử lại.', 'error');
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { pickAndUpload, uploading };
}
