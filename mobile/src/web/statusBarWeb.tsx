import { useEffect } from 'react';

/**
 * Bản thay thế `expo-status-bar` CHỈ cho web (metro.config.js chuyển import sang file này khi đóng gói web).
 *
 * Trên iPhone, bản web mở từ "Màn hình chính" có thanh trạng thái tô theo màu nền trang. Mỗi màn hình đã khai báo
 * <StatusBar style="light" /> (header xanh, chữ sáng) hoặc style="dark" (header trắng, chữ tối); ở đây đổi khai báo đó
 * thành màu nền trang để thanh trạng thái liền màu với header của từng màn.
 *
 * Nhiều màn có thể cùng được mở (ngăn xếp điều hướng): màn mở sau cùng quyết định màu, đóng màn thì trả lại màu màn trước
 * (giống cách StatusBar của React Native xử lý).
 */
type StatusBarStyle = 'auto' | 'inverted' | 'light' | 'dark';

const HEADER_DARK = '#0E4A55'; // xanh đậm đầu header (brand-900)
const HEADER_LIGHT = '#FFFFFF';

const stack: { id: number; color: string }[] = [];
let nextId = 0;

function apply() {
  if (typeof document === 'undefined') return;
  const color = stack[stack.length - 1]?.color ?? HEADER_DARK;
  document.documentElement.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
}

function colorFor(style: StatusBarStyle, backgroundColor?: string): string {
  if (backgroundColor) return backgroundColor;
  // "light" = chữ sáng trên nền tối; "dark" / "auto" = chữ tối trên nền sáng
  return style === 'light' ? HEADER_DARK : HEADER_LIGHT;
}

export function StatusBar({
  style = 'auto',
  backgroundColor,
}: {
  style?: StatusBarStyle;
  backgroundColor?: string;
  [key: string]: unknown;
}) {
  const color = colorFor(style, backgroundColor);
  useEffect(() => {
    const id = ++nextId;
    stack.push({ id, color });
    apply();
    return () => {
      const i = stack.findIndex((e) => e.id === id);
      if (i >= 0) stack.splice(i, 1);
      apply();
    };
  }, [color]);
  return null;
}

// Các hàm còn lại của expo-status-bar: không có tác dụng trên web
export const setStatusBarStyle = () => undefined;
export const setStatusBarBackgroundColor = () => undefined;
export const setStatusBarHidden = () => undefined;
export const setStatusBarTranslucent = () => undefined;
export const setStatusBarNetworkActivityIndicatorVisible = () => undefined;
