import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { palette } from '../../theme';

export type IconName = keyof typeof Ionicons.glyphMap;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type IconTone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'brand'
  | 'accent'
  | 'danger'
  | 'success'
  | 'rating';

const SIZE: Record<IconSize, number> = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 };

// Ionicons nhận màu qua prop `color` (không phải style) nên lấy giá trị từ token.
const TONE: Record<IconTone, string> = {
  default: palette.ink.DEFAULT,
  secondary: palette.ink.secondary,
  muted: palette.ink.muted,
  inverse: palette.ink.inverse,
  brand: palette.brand['500'],
  accent: palette.accent['500'],
  danger: palette.danger.DEFAULT,
  success: palette.success.DEFAULT,
  rating: palette.rating,
};

export interface IconProps {
  name: IconName;
  size?: IconSize | number;
  tone?: IconTone;
  accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 'md', tone = 'default', accessibilityLabel }) => (
  <Ionicons
    name={name}
    size={typeof size === 'number' ? size : SIZE[size]}
    color={TONE[tone]}
    accessibilityLabel={accessibilityLabel}
    accessibilityElementsHidden={!accessibilityLabel}
    importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
  />
);
