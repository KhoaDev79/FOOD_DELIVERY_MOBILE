import { create } from 'zustand';

interface TabBarState {
  isVisible: boolean;
  setVisible: (visible: boolean) => void;
}

/**
 * Quản lý trạng thái ẩn/hiện của thanh điều hướng dưới (FloatingTabBar).
 * Tự động ẩn khi người dùng kéo xuống xem nội dung và hiện lại khi màn hình dừng lại.
 */
export const useTabBarStore = create<TabBarState>((set) => ({
  isVisible: true,
  setVisible: (visible: boolean) =>
    set((state) => (state.isVisible === visible ? state : { isVisible: visible })),
}));

