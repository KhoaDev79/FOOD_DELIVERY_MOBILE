import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { FloatingTabBar, TabMeta } from '../components/ui/FloatingTabBar';
import { useDriverLocationReporter } from '../hooks/useDriverLocationReporter';
import { DriverAvailableOrdersScreen } from '../screens/driver/DriverAvailableOrdersScreen';
import { DriverDeliveriesScreen } from '../screens/driver/DriverDeliveriesScreen';
import { DriverDeliveryDetailScreen } from '../screens/driver/DriverDeliveryDetailScreen';
import { DriverProfileScreen } from '../screens/driver/DriverProfileScreen';
import { DriverVehicleScreen } from '../screens/driver/DriverVehicleScreen';
import { DriverWalletScreen } from '../screens/driver/DriverWalletScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { DriverStackParamList, DriverTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<DriverTabParamList>();
const Stack = createNativeStackNavigator<DriverStackParamList>();

const TAB_META: Record<keyof DriverTabParamList, TabMeta> = {
  DriverAvailableTab: { label: 'Tìm đơn', icon: 'compass-outline', iconActive: 'compass' },
  DriverDeliveriesTab: { label: 'Chuyến giao', icon: 'bicycle-outline', iconActive: 'bicycle' },
  DriverProfileTab: { label: 'Tài xế', icon: 'person-outline', iconActive: 'person' },
};

/**
 * Các tab chính của tài xế:
 * Dùng chung thanh tab nổi FloatingTabBar (không có nút giỏ hàng, giống chủ quán).
 */
const DriverTabs: React.FC = () => (
  <Tab.Navigator
    screenOptions={{ headerShown: false }}
    tabBar={(props) => <FloatingTabBar {...props} meta={TAB_META} />}
  >
    <Tab.Screen
      name="DriverAvailableTab"
      component={DriverAvailableOrdersScreen}
      options={{ title: TAB_META.DriverAvailableTab.label }}
    />
    <Tab.Screen
      name="DriverDeliveriesTab"
      component={DriverDeliveriesScreen}
      options={{ title: TAB_META.DriverDeliveriesTab.label }}
    />
    <Tab.Screen
      name="DriverProfileTab"
      component={DriverProfileScreen}
      options={{ title: TAB_META.DriverProfileTab.label }}
    />
  </Tab.Navigator>
);

/**
 * Stack điều hướng của tài xế:
 * - DriverTabs: 3 tab chính (Tìm đơn, Chuyến giao, Tài xế)
 * - DriverDeliveryDetail: Màn hình chi tiết chuyến có bản đồ tương tác & chỉ đường
 * - EditProfile: Màn hình cập nhật thông tin cá nhân & mật khẩu
 * - Chat: Màn hình nhắn tin trực tiếp với khách hàng của đơn
 */
export const DriverTabNavigator: React.FC = () => {
  useDriverLocationReporter();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverTabs" component={DriverTabs} />
      <Stack.Screen
        name="DriverDeliveryDetail"
        component={DriverDeliveryDetailScreen as React.ComponentType<any>}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen as React.ComponentType<any>}
      />
      <Stack.Screen
        name="DriverVehicle"
        component={DriverVehicleScreen as React.ComponentType<any>}
      />
      <Stack.Screen
        name="DriverWallet"
        component={DriverWalletScreen as React.ComponentType<any>}
      />
    </Stack.Navigator>
  );
};
