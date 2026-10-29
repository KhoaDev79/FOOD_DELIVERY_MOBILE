import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { color: string; bgColor: string }> = {
  primary: { color: colors.primary, bgColor: '#FFECE8' },
  success: { color: colors.success, bgColor: '#E8F5E9' },
  warning: { color: colors.warning, bgColor: '#FFF8E1' },
  danger: { color: colors.danger, bgColor: '#FFEBEE' },
  info: { color: colors.info, bgColor: '#E3F2FD' },
  muted: { color: colors.textMuted, bgColor: colors.borderLight },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'muted',
  color,
  bgColor,
  style,
  textStyle,
}) => {
  const activeColor = color || VARIANT_COLORS[variant]?.color || colors.text;
  const activeBg = bgColor || VARIANT_COLORS[variant]?.bgColor || colors.borderLight;

  return (
    <View style={[styles.badge, { backgroundColor: activeBg }, style]}>
      <Text style={[styles.text, { color: activeColor }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
