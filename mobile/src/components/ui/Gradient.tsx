import React from 'react';
import { View, ViewProps } from 'react-native';
import { palette } from '../../theme';

// Các gradient dùng trong thiết kế, lấy màu từ token.
const PRESETS = {
  /** Đầu trang chủ: xanh ngọc đậm nhạt dần sang trắng (ảnh mẫu 1). */
  header: `linear-gradient(180deg, ${palette.brand['900']} 0%, ${palette.brand['700']} 30%, ${palette.brand['100']} 58%, ${palette.canvas.DEFAULT} 78%)`,
  /** Nền khối chủ đề màu xanh nhạt (ảnh mẫu 3, 5). */
  sectionBrand: `linear-gradient(180deg, ${palette.brand['50']} 0%, ${palette.canvas.DEFAULT} 70%)`,
  /** Nền khối chủ đề màu cam nhạt (ảnh mẫu 4, 5). */
  sectionAccent: `linear-gradient(180deg, ${palette.accent['50']} 0%, ${palette.canvas.DEFAULT} 70%)`,
  /** Thẻ minh hoạ trạng thái rỗng (ảnh mẫu 8). */
  empty: `linear-gradient(135deg, ${palette.warning.soft} 0%, ${palette.canvas.DEFAULT} 50%, ${palette.brand['100']} 100%)`,
  /** Mục tab đang chọn, nút giỏ hàng (ảnh mẫu 7). */
  brandPill: `linear-gradient(135deg, ${palette.brand['300']} 0%, ${palette.brand['500']} 100%)`,
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
