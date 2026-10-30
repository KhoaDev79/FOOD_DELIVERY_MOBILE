import React from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { palette } from '../../theme';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';

export interface SearchBarProps extends Omit<TextInputProps, 'className'> {
  /** lg: thanh lớn trên đầu trang chủ (ảnh mẫu 1); md: thanh gọn (ảnh mẫu 3–6). */
  size?: 'lg' | 'md';
  /** Nếu có: thanh chỉ là nút mở màn tìm kiếm, không nhập trực tiếp. */
  onPressAsButton?: () => void;
  onClear?: () => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  size = 'md',
  placeholder = 'Tìm món ăn, quán ăn',
  onPressAsButton,
  onClear,
  value,
  className,
  ...rest
}) => {
  const box = cn(
    'flex-row items-center gap-2',
    size === 'lg'
      ? 'h-search-lg rounded-xl border border-line bg-surface px-4 shadow-card'
      : 'h-search rounded-md bg-canvas-subtle px-3',
    className,
  );
  const iconSize = size === 'lg' ? 'lg' : 'md';

  if (onPressAsButton) {
    return (
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        onPress={onPressAsButton}
        className={cn(box, 'active:opacity-80')}
      >
        <Icon name="search-outline" size={iconSize} tone="secondary" />
        <Text variant={size === 'lg' ? 'body-lg' : 'body'} tone="muted" numberOfLines={1} className="flex-1">
          {placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className={box}>
      <Icon name="search-outline" size={iconSize} tone="secondary" />
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={palette.ink.muted}
        returnKeyType="search"
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={1.4}
        className={cn('h-full flex-1 font-body text-ink', size === 'lg' ? 'text-body-lg' : 'text-body')}
        {...rest}
      />
      {!!value && onClear && (
        <Pressable accessibilityRole="button" accessibilityLabel="Xoá nội dung tìm kiếm" hitSlop={12} onPress={onClear}>
          <Icon name="close-circle" size="md" tone="muted" />
        </Pressable>
      )}
    </View>
  );
};
