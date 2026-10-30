import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { FloatingTabBar, TabMeta } from '../components/ui/FloatingTabBar';
import { OwnerMenuScreen } from '../screens/owner/OwnerMenuScreen';
import { OwnerOrdersScreen } from '../screens/owner/OwnerOrdersScreen';
import { OwnerRestaurantScreen } from '../screens/owner/OwnerRestaurantScreen';
import { OwnerReviewsScreen } from '../screens/owner/OwnerReviewsScreen';
import { OwnerStatsScreen } from '../screens/owner/OwnerStatsScreen';
import { AddressPickerScreen } from '../screens/profile/AddressPickerScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { OwnerStackParamList, OwnerTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<OwnerTabParamList>();
const Stack = createNativeStackNavigator<OwnerStackParamList>();

const TAB_META: Record<keyof OwnerTabParamList, TabMeta> = {
  OwnerOrdersTab: { label: 'Đơn hàng', icon: 'receipt-outline', iconActive: 'receipt' },
  OwnerMenuTab: { label: 'Thực đơn', icon: 'restaurant-outline', iconActive: 'restaurant' },
  OwnerRestaurantTab: { label: 'Cửa hàng', icon: 'storefront-outline', iconActive: 'storefront' },
};

/** Các tab của chủ quán, dùng chung thanh tab nổi với khách hàng (không có nút giỏ hàng). */
const OwnerTabs: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} meta={TAB_META} />}>
    <Tab.Screen name="OwnerOrdersTab" component={OwnerOrdersScreen} options={{ title: TAB_META.OwnerOrdersTab.label }} />
    <Tab.Screen name="OwnerMenuTab" component={OwnerMenuScreen} options={{ title: TAB_META.OwnerMenuTab.label }} />
    <Tab.Screen
      name="OwnerRestaurantTab"
      component={OwnerRestaurantScreen}
      options={{ title: TAB_META.OwnerRestaurantTab.label }}
    />
  </Tab.Navigator>
);

/**
 * Điều hướng của chủ quán: các tab + Thống kê + "Tài khoản cá nhân & mật khẩu" + chọn địa chỉ quán.
 * EditProfileScreen và AddressPickerScreen được khai báo kiểu cho RootStack nhưng chỉ dùng
 * navigation.goBack() và route.params, nên dùng lại được ở đây (ép kiểu component).
 */
export const OwnerTabNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
    <Stack.Screen name="OwnerStats" component={OwnerStatsScreen} />
    <Stack.Screen name="OwnerReviews" component={OwnerReviewsScreen} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen as React.ComponentType<any>} />
    <Stack.Screen name="AddressPicker" component={AddressPickerScreen as React.ComponentType<any>} />
  </Stack.Navigator>
);
