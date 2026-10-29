import { create } from 'zustand';

interface FilterState {
  searchQuery: string;
  openOnly: boolean;
  radiusKm: number;
  setSearchQuery: (query: string) => void;
  setOpenOnly: (openOnly: boolean) => void;
  setRadiusKm: (radius: number) => void;
  resetFilter: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  openOnly: false,
  radiusKm: 10,

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setOpenOnly: (openOnly) => set({ openOnly }),
  setRadiusKm: (radiusKm) => set({ radiusKm }),
  resetFilter: () => set({ searchQuery: '', openOnly: false, radiusKm: 10 }),
}));

