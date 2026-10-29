import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { useAuthStore } from '../store/useAuthStore';
import { AuthStackParamList } from '../types/navigation';
import { AdminTabNavigator } from './AdminTabNavigator';
import { DriverTabNavigator } from './DriverTabNavigator';
import { OwnerTabNavigator } from './OwnerTabNavigator';
import { RootStack } from './RootStack';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const loadStoredAuth = useAuthStore((s) => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  usePushNotifications();

  if (isLoading) {
    return <LoadingSpinner message="Đang khởi tạo ứng dụng..." />;
  }

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
      </AuthStack.Navigator>
    );
  }

  // Điều hướng chính xác theo vai trò đăng nhập
  switch (user?.role) {
    case 'RESTAURANT_OWNER':
      return <OwnerTabNavigator />;
    case 'DRIVER':
      return <DriverTabNavigator />;
    case 'ADMIN':
      return <AdminTabNavigator />;
    case 'CUSTOMER':
    default:
      return <RootStack />;
  }
};
