import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';
import { usersApi } from '../api/users';
import { useToast } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { FavoriteInput, useFavoritesStore } from '../store/useFavoritesStore';

/** Khoá cũ: trước đây danh sách yêu thích lưu chung trên thiết bị cho mọi tài khoản. */
const LEGACY_STORAGE_KEY = 'food-delivery-favorites';

/**
 * Đồng bộ danh sách yêu thích với tài khoản đang đăng nhập.
 * Đăng nhập / đổi tài khoản → tải danh sách của tài khoản đó; đăng xuất → xoá sạch.
 * Gọi một lần ở gốc ứng dụng (AppNavigator).
 */
export function useFavoritesSync() {
  const userId = useAuthStore((s) => (s.isAuthenticated ? s.user?.id : undefined));

  useEffect(() => {
    // Dọn dữ liệu cũ dùng chung trên thiết bị (không còn dùng).
    AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    const { clear, setAll } = useFavoritesStore.getState();
    clear();
    if (!userId) return;
    let cancelled = false;
    usersApi
      .getFavorites()
      .then((list) => {
        if (!cancelled) setAll(list);
      })
      .catch(() => {
        // Lỗi mạng: để danh sách rỗng, lần mở app sau sẽ tải lại
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/**
 * Bấm tim một quán: bắt buộc đăng nhập; cập nhật ngay trên giao diện rồi lưu lên server,
 * lỗi thì hoàn tác. Trả về true/false = trạng thái sau khi bấm, null nếu chưa đăng nhập.
 */
export function useToggleFavorite() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useCallback(
    (restaurant: FavoriteInput): boolean | null => {
      if (!isAuthenticated) {
        toast('Vui lòng đăng nhập để lưu quán yêu thích');
        navigation.navigate('Login');
        return null;
      }
      const store = useFavoritesStore.getState();
      const nowLiked = store.toggle(restaurant);
      const request = nowLiked ? usersApi.addFavorite(restaurant.id) : usersApi.removeFavorite(restaurant.id);
      request.catch(() => {
        // Hoàn tác về trạng thái trước khi bấm
        useFavoritesStore.getState().toggle(restaurant);
        toast('Không lưu được yêu thích, vui lòng thử lại', 'error');
      });
      return nowLiked;
    },
    [isAuthenticated, navigation, toast],
  );
}
