import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { usersApi } from '../api/users';
import { useToast } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { FavoriteInput, useFavoritesStore } from '../store/useFavoritesStore';

/** Khoá cũ: trước đây danh sách yêu thích lưu chung trên thiết bị cho mọi tài khoản. */
const LEGACY_STORAGE_KEY = 'food-delivery-favorites';

/**
 * Hook truy vấn danh sách yêu thích qua React Query (chặn gọi ngầm khi chưa đăng nhập).
 */
export function useFavorites() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.accessToken);
  const isLoading = useAuthStore((s) => s.isLoading);

  return useQuery({
    queryKey: ['favorites'],
    queryFn: () => usersApi.getFavorites(),
    enabled: Boolean(!isLoading && isAuthenticated && token && token.trim().length > 0),
  });
}

/**
 * Đồng bộ danh sách yêu thích với tài khoản đang đăng nhập.
 * Đăng nhập / đổi tài khoản → tải danh sách của tài khoản đó; đăng xuất → xoá sạch.
 * Chặn hoàn toàn request 401 khi người dùng chưa đăng nhập hoặc token chưa sẵn sàng.
 * Gọi một lần ở gốc ứng dụng (AppNavigator).
 */
export function useFavoritesSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const userId = useAuthStore((s) => (s.isAuthenticated ? s.user?.id : undefined));

  useEffect(() => {
    // Dọn dữ liệu cũ dùng chung trên thiết bị (không còn dùng).
    AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => undefined);
  }, []);

  const canFetch = Boolean(
    !isLoading &&
    isAuthenticated &&
    accessToken &&
    typeof accessToken === 'string' &&
    accessToken.trim().length > 0 &&
    userId,
  );

  useEffect(() => {
    const { clear, setAll } = useFavoritesStore.getState();
    if (!canFetch) {
      clear();
      return;
    }

    let cancelled = false;
    usersApi
      .getFavorites()
      .then((list) => {
        if (!cancelled) {
          setAll(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {
        // Lỗi mạng hoặc 401: danh sách để rỗng an toàn, không crash
        if (!cancelled) {
          clear();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canFetch, userId]);
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
