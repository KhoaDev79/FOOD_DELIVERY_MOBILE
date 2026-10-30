import { create } from 'zustand';
import { Restaurant } from '../types/api';

/**
 * Quán yêu thích của tài khoản ĐANG ĐĂNG NHẬP.
 * Nguồn dữ liệu là server (mỗi tài khoản một danh sách); store chỉ giữ bản sao trong bộ nhớ:
 * tải về sau khi đăng nhập (useFavoritesSync) và xoá sạch khi đăng xuất.
 * Không lưu xuống thiết bị nữa, nên tài khoản khác dùng cùng máy không thấy danh sách của nhau.
 */
export interface FavoriteRestaurant {
  id: string;
  name: string;
  imageUrl?: string | null;
  address: string;
  rating: number;
  isOpen?: boolean;
  addedAt: string;
}

export type FavoriteInput = Pick<Restaurant, 'id' | 'name' | 'imageUrl' | 'address' | 'rating'>;

interface FavoritesState {
  restaurants: FavoriteRestaurant[];
  /** Đã tải xong danh sách từ server cho tài khoản hiện tại. */
  loaded: boolean;
  isFavorite: (id: string) => boolean;
  /** Đổi trạng thái tại chỗ (cập nhật lạc quan). Trả về true nếu sau khi bấm quán đang được thích. */
  toggle: (r: FavoriteInput) => boolean;
  remove: (id: string) => void;
  setAll: (list: FavoriteRestaurant[]) => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  restaurants: [],
  loaded: false,
  isFavorite: (id) => get().restaurants.some((r) => r.id === id),
  toggle: (r) => {
    if (get().isFavorite(r.id)) {
      set({ restaurants: get().restaurants.filter((x) => x.id !== r.id) });
      return false;
    }
    const entry: FavoriteRestaurant = {
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      address: r.address,
      rating: r.rating,
      addedAt: new Date().toISOString(),
    };
    set({ restaurants: [entry, ...get().restaurants] });
    return true;
  },
  remove: (id) => set({ restaurants: get().restaurants.filter((x) => x.id !== id) }),
  setAll: (list) => set({ restaurants: list, loaded: true }),
  clear: () => set({ restaurants: [], loaded: false }),
}));
