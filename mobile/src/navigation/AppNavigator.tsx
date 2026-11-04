import React, { useEffect, useState } from 'react';
import { useFavoritesSync } from '../hooks/useFavorites';
import { useGoogleRedirectLogin } from '../hooks/useGoogleRedirectLogin';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { ZomZomSplashScreen } from '../screens/intro/ZomZomSplashScreen';
import { useAuthStore } from '../store/useAuthStore';
import { AdminTabNavigator } from './AdminTabNavigator';
import { DriverTabNavigator } from './DriverTabNavigator';
import { OwnerTabNavigator } from './OwnerTabNavigator';
import { RootStack } from './RootStack';

export const AppNavigator: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  usePushNotifications();
  // Yêu thích theo tài khoản: tải khi đăng nhập, xoá khi đăng xuất / đổi tài khoản
  useFavoritesSync();
  // Bản web: vừa quay về từ trang đăng nhập Google thì hoàn tất đăng nhập
  useGoogleRedirectLogin();

  // Hiển thị màn hình Loading / Intro ZomZom khi vừa mở ứng dụng
  if (showSplash) {
    return <ZomZomSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Điều hướng chính xác theo vai trò đăng nhập
  if (isAuthenticated) {
    switch (user?.role) {
      case 'RESTAURANT_OWNER':
        return <OwnerTabNavigator />;
      case 'DRIVER':
        return <DriverTabNavigator />;
      case 'ADMIN':
        return <AdminTabNavigator />;
      case 'CUSTOMER':
      default:
        // Khách chưa có SĐT (thường là vừa đăng nhập Google): bắt buộc hoàn tất hồ sơ trước khi vào app
        if (user && !user.phone) return <CompleteProfileScreen />;
        return <RootStack />;
    }
  }

  // Khách vãng lai chưa đăng nhập: Vào thẳng trang chủ để duyệt món và quán ăn
  return <RootStack />;
};
