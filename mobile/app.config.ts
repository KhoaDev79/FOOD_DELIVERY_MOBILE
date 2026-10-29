import type { ConfigContext, ExpoConfig } from 'expo/config';

// Mở rộng app.json: gắn Google Maps API key (Android) từ biến môi trường.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Food Delivery',
  slug: config.slug ?? 'food-delivery',
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
});
