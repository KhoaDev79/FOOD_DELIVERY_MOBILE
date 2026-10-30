// Truy cập token từ mã TypeScript (màu cho icon, RefreshControl...). Nguồn: tokens.json.
import tokens from './tokens.json';

export const theme = tokens;
export const palette = tokens.colors;

export const fontFamilies = {
  400: tokens.fontFamily.regular,
  500: tokens.fontFamily.medium,
  600: tokens.fontFamily.semibold,
  700: tokens.fontFamily.bold,
} as const;

export const fontAssets = {
  [tokens.fontFamily.regular]: require('../../assets/fonts/BeVietnamPro-Regular.ttf'),
  [tokens.fontFamily.medium]: require('../../assets/fonts/BeVietnamPro-Medium.ttf'),
  [tokens.fontFamily.semibold]: require('../../assets/fonts/BeVietnamPro-SemiBold.ttf'),
  [tokens.fontFamily.bold]: require('../../assets/fonts/BeVietnamPro-Bold.ttf'),
};
