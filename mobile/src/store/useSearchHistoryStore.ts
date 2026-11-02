import { create } from 'zustand';
import { appStorage } from '../utils/storage';

const STORAGE_KEY = 'food_delivery_search_history';
const MAX_HISTORY_ITEMS = 10;

interface SearchHistoryState {
  history: string[];
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  addSearchQuery: (query: string) => Promise<void>;
  removeSearchQuery: (query: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  history: [],
  isLoaded: false,

  loadHistory: async () => {
    try {
      const raw = await appStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ history: parsed, isLoaded: true });
          return;
        }
      }
    } catch {
      // ignore parse error
    }
    set({ history: [], isLoaded: true });
  },

  addSearchQuery: async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    const current = get().history;
    // Đưa từ khóa mới lên đầu, loại bỏ từ trùng lặp (không phân biệt hoa/thường)
    const filtered = current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    set({ history: next });
    try {
      await appStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  },

  removeSearchQuery: async (query: string) => {
    const next = get().history.filter((item) => item.toLowerCase() !== query.toLowerCase());
    set({ history: next });
    try {
      await appStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  },

  clearHistory: async () => {
    set({ history: [] });
    try {
      await appStorage.deleteItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));

