import './global.css';
import './src/theme/interop';

import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DevGallery } from './src/dev/DevGallery';
import { AppNavigator } from './src/navigation/AppNavigator';
import { fontAssets } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 30,
    },
  },
});

const linking = {
  prefixes: ['fooddelivery://'],
  config: {
    screens: {
      Checkout: 'payment-result',
      OrderTracking: 'order/:orderId',
    },
  },
};

// Trang thư viện thành phần: chỉ ở chế độ phát triển, trên web mở bằng ?gallery
const showGallery =
  __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('gallery');

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Chờ font cục bộ nạp xong; nếu lỗi thì vẫn chạy bằng font hệ thống.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider className="flex-1 min-h-full">
      <QueryClientProvider client={queryClient}>
        {showGallery ? (
          <DevGallery />
        ) : (
          <NavigationContainer linking={linking}>
            <StatusBar style="dark" />
            <AppNavigator />
          </NavigationContainer>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
