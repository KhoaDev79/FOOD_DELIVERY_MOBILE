import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { FloatingTabBar, TabMeta } from '../components/ui/FloatingTabBar';
import { AdminBannersScreen } from '../screens/admin/AdminBannersScreen';
import { AdminCuisinesScreen } from '../screens/admin/AdminCuisinesScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminOrdersScreen } from '../screens/admin/AdminOrdersScreen';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { AdminRestaurantsScreen } from '../screens/admin/AdminRestaurantsScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { AdminStackParamList, AdminTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

const TAB_META: Record<keyof AdminTabParamList, TabMeta> = {
  AdminDashboardTab: { label: 'Tổng quan', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  AdminOrdersTab: { label: 'Đơn hàng', icon: 'receipt-outline', iconActive: 'receipt' },
  AdminUsersTab: { label: 'Người dùng', icon: 'people-outline', iconActive: 'people' },
  AdminRestaurantsTab: { label: 'Quán ăn', icon: 'storefront-outline', iconActive: 'storefront' },
  AdminProfileTab: { label: 'Hệ thống', icon: 'settings-outline', iconActive: 'settings' },
};

/**
 * Các tab quản trị. Header mặc định của navigator bị tắt: mỗi màn tự vẽ TabHeader
 * (trước đây hiện 2 tiêu đề chồng nhau: header navigator + TopBar trong màn).
 */
const AdminTabs: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} meta={TAB_META} />}>
    <Tab.Screen name="AdminDashboardTab" component={AdminDashboardScreen} options={{ title: TAB_META.AdminDashboardTab.label }} />
    <Tab.Screen name="AdminOrdersTab" component={AdminOrdersScreen} options={{ title: TAB_META.AdminOrdersTab.label }} />
    <Tab.Screen name="AdminUsersTab" component={AdminUsersScreen} options={{ title: TAB_META.AdminUsersTab.label }} />
    <Tab.Screen
      name="AdminRestaurantsTab"
      component={AdminRestaurantsScreen}
      options={{ title: TAB_META.AdminRestaurantsTab.label }}
    />
    <Tab.Screen name="AdminProfileTab" component={AdminProfileScreen} options={{ title: TAB_META.AdminProfileTab.label }} />
  </Tab.Navigator>
);

/** Stack quản trị: các tab + sửa tài khoản (trước đây nút "Thông tin cá nhân" không mở được vì thiếu route). */
export const AdminTabNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminTabs" component={AdminTabs} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen as React.ComponentType<any>} />
    <Stack.Screen name="AdminBanners" component={AdminBannersScreen} />
    <Stack.Screen name="AdminCuisines" component={AdminCuisinesScreen} />
  </Stack.Navigator>
);
