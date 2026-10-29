import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MenuItem } from '../types/api';

export interface CartLineItem {
  id?: string;
  menuItem: MenuItem;
  quantity: number;
  note?: string;
  size?: string;
  toppings?: string[];
  spiciness?: string;
  unitPrice?: number;
}

export interface CartRestaurant {
  id: string;
  name: string;
  imageUrl?: string | null;
  latitude?: number;
  longitude?: number;
}

interface CartState {
  restaurant: CartRestaurant | null;
  items: CartLineItem[];
  addItem: (restaurant: CartRestaurant, menuItem: MenuItem, quantity?: number, note?: string) => 'ADDED' | 'DIFFERENT_RESTAURANT';
  addCustomItem: (
    restaurant: CartRestaurant,
    menuItem: MenuItem,
    quantity: number,
    options: {
      size?: string;
      toppings?: string[];
      spiciness?: string;
      unitPrice?: number;
      note?: string;
    },
  ) => 'ADDED' | 'DIFFERENT_RESTAURANT';
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNote: (menuItemId: string, note: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      items: [],

      addItem: (restaurant, menuItem, quantity = 1, note) => {
        const state = get();
        if (state.restaurant && state.restaurant.id !== restaurant.id && state.items.length > 0) {
          return 'DIFFERENT_RESTAURANT';
        }

        const existingIndex = state.items.findIndex((i) => i.menuItem.id === menuItem.id && !i.size);
        let updatedItems: CartLineItem[];

        if (existingIndex > -1) {
          updatedItems = [...state.items];
          updatedItems[existingIndex].quantity += quantity;
          if (note) updatedItems[existingIndex].note = note;
        } else {
          updatedItems = [...state.items, { menuItem, quantity, note, unitPrice: menuItem.price }];
        }

        set({ restaurant, items: updatedItems });
        return 'ADDED';
      },

      addCustomItem: (restaurant, menuItem, quantity, options) => {
        const state = get();
        if (state.restaurant && state.restaurant.id !== restaurant.id && state.items.length > 0) {
          return 'DIFFERENT_RESTAURANT';
        }

        const lineItem: CartLineItem = {
          id: `${menuItem.id}-${Date.now()}`,
          menuItem,
          quantity,
          note: options.note,
          size: options.size,
          toppings: options.toppings,
          spiciness: options.spiciness,
          unitPrice: options.unitPrice || menuItem.price,
        };

        set({ restaurant, items: [...state.items, lineItem] });
        return 'ADDED';
      },

      removeItem: (menuItemId) => {
        const updated = get().items.filter((i) => (i.id ? i.id !== menuItemId : i.menuItem.id !== menuItemId));
        set({ items: updated, restaurant: updated.length === 0 ? null : get().restaurant });
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        const updated = get().items.map((i) => {
          const match = i.id ? i.id === menuItemId : i.menuItem.id === menuItemId;
          return match ? { ...i, quantity: Math.min(quantity, 50) } : i;
        });
        set({ items: updated });
      },

      updateNote: (menuItemId, note) => {
        const updated = get().items.map((i) => {
          const match = i.id ? i.id === menuItemId : i.menuItem.id === menuItemId;
          return match ? { ...i, note } : i;
        });
        set({ items: updated });
      },

      clearCart: () => set({ restaurant: null, items: [] }),

      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      getSubtotal: () =>
        get().items.reduce(
          (sum, item) => sum + (item.unitPrice || item.menuItem.price) * item.quantity,
          0,
        ),
    }),
    {
      name: 'food-delivery-cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

