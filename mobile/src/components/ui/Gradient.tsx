import React from 'react';
import { View, ViewProps } from 'react-native';
import { palette } from '../../theme';

// Các gradient dùng trong thiết kế, lấy màu từ token.
const PRESETS = {
  /** Đầu trang chủ: xanh ngọc đậm nhạt dần sang trắng (ảnh mẫu 1). */
  header: `linear-gradient(180deg, ${palette.brand['900']} 0%, ${palette.brand['700']} 30%, ${palette.brand['100']} 58%, ${palette.canvas.DEFAULT} 78%)`,
  /** Nền khối chủ đề màu xanh nhạt (ảnh mẫu 3, 5). */
  sectionBrand: `linear-gradient(180deg, ${palette.brand['50']} 0%, ${palette.canvas.DEFAULT} 70%)`,
  /** Dải tiêu đề khối gợi ý: xanh ngọc đậm nhạt dần sang trắng (ảnh mẫu "Gợi ý dành cho …"). */
  sectionHeaderBand: `linear-gradient(180deg, ${palette.brand['400']} 0%, ${palette.brand['100']} 60%, ${palette.canvas.DEFAULT} 100%)`,
  /** Khung khối nổi bật nền kem/hồng nhạt (ảnh mẫu "Giật Deal Sốc"). */
  dealFrame: `linear-gradient(160deg, ${palette.accent['50']} 0%, ${palette.canvas.DEFAULT} 55%, ${palette.accent['100']} 100%)`,
  /** Dải tiêu đề "Quán gần tôi": xanh ngọc nhạt dần vào nền danh sách brand-50. */
  nearbyBand: `linear-gradient(180deg, ${palette.brand['200']} 0%, ${palette.brand['100']} 45%, ${palette.brand['50']} 100%)`,
  /** Đầu trang các tab khách hàng (Đơn hàng, Yêu thích, Tài khoản, Giỏ hàng). */
  tabHeader: `linear-gradient(160deg, ${palette.brand['900']} 0%, ${palette.brand['700']} 55%, ${palette.brand['500']} 100%)`,
  /** Nền khối chủ đề màu cam nhạt (ảnh mẫu 4, 5). */
  sectionAccent: `linear-gradient(180deg, ${palette.accent['50']} 0%, ${palette.canvas.DEFAULT} 70%)`,
  /** Thẻ minh hoạ trạng thái rỗng (ảnh mẫu 8). */
  empty: `linear-gradient(135deg, ${palette.warning.soft} 0%, ${palette.canvas.DEFAULT} 50%, ${palette.brand['100']} 100%)`,
  /** Mục tab đang chọn, nút giỏ hàng (ảnh mẫu 7). */
  brandPill: `linear-gradient(135deg, ${palette.brand['300']} 0%, ${palette.brand['500']} 100%)`,
  /** Nền màn khởi động: cùng dải màu với đầu trang chủ. */
  splash: `linear-gradient(180deg, ${palette.brand['900']} 0%, ${palette.brand['700']} 55%, ${palette.brand['700']} 100%)`,
  /** Quầng sáng sau logo màn khởi động (màu brand-300, mờ dần). */
  splashGlow: 'radial-gradient(circle at 50% 45%, rgba(127,224,236,0.38) 0%, rgba(127,224,236,0) 48%)',
  /** Lớp tối dưới chữ phủ trên ảnh. */
  imageScrim: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
} as const;

export type GradientPreset = keyof typeof PRESETS;

export interface GradientProps extends ViewProps {
  preset: GradientPreset;
  className?: string;
}

/**
 * NGOẠI LỆ style: NativeWind v4 (react-native-css-interop 0.2.7) không chuyển đổi
 * `background-image`, nên gradient dùng thuộc tính `backgroundImage` có sẵn của RN 0.88
 * (và CSS gốc trên web). Mọi thuộc tính khác vẫn dùng className.
 */
export const Gradient: React.FC<GradientProps> = ({ preset, style, ...rest }) => (
  <View style={[{ backgroundImage: PRESETS[preset] } as object, style]} {...rest} />
);
