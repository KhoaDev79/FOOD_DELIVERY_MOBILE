import { create } from 'zustand';
import { Restaurant } from '../types/api';

interface OwnerRestaurantState {
  selectedRestaurantId: string | null;
  setSelectedRestaurantId: (id: string | null) => void;
  getActiveRestaurant: (restaurants?: Restaurant[] | null) => Restaurant | null;
}

export const useOwnerRestaurantStore = create<OwnerRestaurantState>((set, get) => ({
  selectedRestaurantId: null,

  setSelectedRestaurantId: (id) => set({ selectedRestaurantId: id }),

  getActiveRestaurant: (restaurants) => {
    if (!restaurants || restaurants.length === 0) return null;
    const { selectedRestaurantId } = get();
    if (selectedRestaurantId) {
      const found = restaurants.find((r) => r.id === selectedRestaurantId);
      if (found) return found;
    }
    return restaurants[0];
  },
}));

