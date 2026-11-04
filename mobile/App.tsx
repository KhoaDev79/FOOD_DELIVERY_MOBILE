import './global.css';
import './src/theme/interop';

import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatNotifier } from './src/components/modules/chat/ChatNotifier';
import { NewOrderAlertModal } from './src/components/modules/owner/NewOrderAlertModal';
import { ToastProvider } from './src/components/ui/Overlays';
import { AppNavigator } from './src/navigation/AppNavigator';
import { markNavigationReady, navigationRef } from './src/navigation/navigationRef';
import { useAuthStore } from './src/store/useAuthStore';
import { fontAssets } from './src/theme';
import { installWebAlert } from './src/utils/webAlert';

// Web: cửa sổ đăng nhập Google quay về chính trang app; dòng này gửi kết quả về trang gốc rồi tự đóng cửa sổ
WebBrowser.maybeCompleteAuthSession();

// Alert.alert có nút không chạy trên web: thay bằng hộp thoại của trình duyệt (xem utils/webAlert.ts)
installWebAlert();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lỗi phía người dùng (4xx: sai quyền, không tìm thấy, 429 bị giới hạn) thử lại cũng không khác,
      // còn làm tốn lượt giới hạn; chỉ thử lại lỗi mạng / máy chủ
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 30,
    },
  },
});

/**
 * Deep link: fooddelivery://restaurant/<id>?openDishId=<món> (từ trang chia sẻ /s/r, /s/d của backend)
 * và fooddelivery://order/<id>. initialRouteName: mở từ link vẫn có Trang chủ phía dưới để bấm quay lại.
 */
const linking = {
  prefixes: ['fooddelivery://'],
  config: {
    initialRouteName: 'MainTabs' as const,
    screens: {
      RestaurantDetail: 'restaurant/:restaurantId',
      OrderTracking: 'order/:orderId',
    },
  },
};

/**
 * Đổi tài khoản (đăng nhập, đăng xuất, đổi vai trò) thì xoá toàn bộ dữ liệu đã tải, để tài khoản
 * sau không thấy dữ liệu cũ của tài khoản trước (vd. chủ quán đổi tên quán rồi đăng nhập lại bằng
 * tài khoản khách hàng vẫn thấy tên cũ trong bộ nhớ đệm).
 */
function ResetCacheOnAccountChange() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const previous = useRef(userId);
  useEffect(() => {
    if (previous.current !== userId) {
      previous.current = userId;
      queryClient.clear();
    }
  }, [userId, queryClient]);
  return null;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Chờ font cục bộ nạp xong; nếu lỗi thì vẫn chạy bằng font hệ thống.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider className="flex-1 min-h-full">
      <QueryClientProvider client={queryClient}>
        <ResetCacheOnAccountChange />
        <ToastProvider>
          <NavigationContainer ref={navigationRef} linking={linking} onReady={markNavigationReady}>
            <StatusBar style="dark" />
            <AppNavigator />
            {/* Thông báo nổi tin nhắn chat: đặt sau AppNavigator để nằm trên mọi màn hình */}
            <ChatNotifier />
            {/* Chuông & modal báo đơn hàng mới cho chủ quán */}
            <NewOrderAlertModal />
          </NavigationContainer>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
