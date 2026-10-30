import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { resolveImageUrl } from '../../utils/image';
import { cn } from './cn';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<AvatarSize, string> = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };
const LABEL: Record<AvatarSize, 'caption' | 'body' | 'headline' | 'title'> = {
  sm: 'caption',
  md: 'body',
  lg: 'headline',
  xl: 'title',
};

const initials = (name?: string) =>
  (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

export const Avatar: React.FC<{ uri?: string | null; name?: string; size?: AvatarSize; className?: string }> = ({
  uri,
  name,
  size = 'md',
  className,
}) => {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageUrl(uri);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `Ảnh đại diện của ${name}` : 'Ảnh đại diện'}
      className={cn('items-center justify-center overflow-hidden rounded-full bg-brand-100', BOX[size], className)}
    >
      {resolved && !failed ? (
        <Image source={{ uri: resolved }} className="h-full w-full" onError={() => setFailed(true)} />
      ) : (
        <Text variant={LABEL[size]} weight="semibold" tone="brand">
          {initials(name)}
        </Text>
      )}
    </View>
  );
};
