import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Restaurant } from '../types/api';

/**
 * Quán yêu thích của người dùng, lưu trên thiết bị (chưa có API yêu thích ở backend).
 * Lưu ảnh chụp thông tin quán tại thời điểm thích để hiển thị khi chưa tải lại danh sách.
 */
export interface FavoriteRestaurant {
  id: string;
  name: string;
  imageUrl?: string | null;
  address: string;
  rating: number;
  addedAt: string;
}

interface FavoritesState {
  restaurants: FavoriteRestaurant[];
  isFavorite: (id: string) => boolean;
  toggle: (r: Pick<Restaurant, 'id' | 'name' | 'imageUrl' | 'address' | 'rating'>) => boolean;
  remove: (id: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      restaurants: [],
      isFavorite: (id) => get().restaurants.some((r) => r.id === id),
      /** Trả về true nếu sau khi bấm quán đang được thích. */
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
    }),
    { name: 'food-delivery-favorites', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
