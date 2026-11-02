import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { cn } from './cn';

export type TextVariant = 'display' | 'title' | 'headline' | 'body-lg' | 'body' | 'caption' | 'micro' | 'price';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextTone =
  'default' | 'secondary' | 'muted' | 'inverse' | 'brand' | 'accent' | 'danger' | 'success' | 'warning';

const SIZE: Record<TextVariant, string> = {
  display: 'text-display',
  title: 'text-title',
  headline: 'text-headline',
  'body-lg': 'text-body-lg',
  body: 'text-body',
  caption: 'text-caption',
  micro: 'text-micro',
  price: 'text-headline',
};

const DEFAULT_WEIGHT: Record<TextVariant, TextWeight> = {
  display: 'bold',
  title: 'semibold',
  headline: 'semibold',
  'body-lg': 'regular',
  body: 'regular',
  caption: 'medium',
  micro: 'semibold',
  price: 'semibold',
};

// Mỗi độ đậm là một file font riêng (font tuỳ biến trên Android không tự tổng hợp độ đậm).
const WEIGHT: Record<TextWeight, string> = {
  regular: 'font-body',
  medium: 'font-body-medium',
  semibold: 'font-body-semibold',
  bold: 'font-body-bold',
};

const TONE: Record<TextTone, string> = {
  default: 'text-ink',
  secondary: 'text-ink-secondary',
  muted: 'text-ink-muted',
  inverse: 'text-ink-inverse',
  brand: 'text-brand-contrast',
  accent: 'text-accent-700',
  danger: 'text-danger',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  weight?: TextWeight;
  tone?: TextTone;
  className?: string;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight,
  tone,
  className,
  maxFontSizeMultiplier = 1.4,
  ...rest
}) => (
  <RNText
    maxFontSizeMultiplier={maxFontSizeMultiplier}
    className={cn(
      SIZE[variant],
      WEIGHT[weight ?? DEFAULT_WEIGHT[variant]],
      TONE[tone ?? (variant === 'price' ? 'brand' : 'default')],
      className,
    )}
    {...rest}
  />
);
