import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { getFallbackInitial, resolveImageUrl } from '../../utils/image';

export { resolveImageUrl };

interface AppImageProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  fallbackTitle?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export const AppImage: React.FC<AppImageProps> = ({
  uri,
  style,
  containerStyle,
  fallbackTitle,
  fallbackIcon = 'restaurant-outline',
  resizeMode = 'cover',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const resolvedUri = resolveImageUrl(uri);
  const initialLetter = getFallbackInitial(fallbackTitle);

  if (!resolvedUri || hasError) {
    return (
      <View style={[styles.fallbackContainer, style as any, containerStyle]}>
        <View style={styles.fallbackContent}>
          <Ionicons name={fallbackIcon} size={28} color="#EA580C" />
          {fallbackTitle ? (
            <Text style={styles.initialText}>{initialLetter}</Text>
          ) : (
            <Text style={styles.fallbackSubText}>Food Delivery</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style as any, containerStyle]}>
      <Image
        source={{ uri: resolvedUri }}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      {isLoading && (
        <View style={[styles.skeleton, StyleSheet.absoluteFill]}>
          <ActivityIndicator size="small" color="#EE4D2D" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  skeleton: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    backgroundColor: '#FFF7ED', // Nền pastel cam nhạt sang trọng
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
    overflow: 'hidden',
  },
  fallbackContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  initialText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EA580C',
  },
  fallbackSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
});
