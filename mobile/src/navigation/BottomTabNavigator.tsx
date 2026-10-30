import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { FloatingTabBar, TabMeta } from '../components/ui/FloatingTabBar';
import { FavoritesScreen } from '../screens/favorites/FavoritesScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { OrderHistoryScreen } from '../screens/order/OrderHistoryScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { useCartStore } from '../store/useCartStore';
import { MainTabParamList, RootStackParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_META: Record<keyof MainTabParamList, TabMeta> = {
  HomeTab: { label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  OrdersTab: { label: 'Đơn hàng', icon: 'receipt-outline', iconActive: 'receipt' },
  FavoritesTab: { label: 'Yêu thích', icon: 'heart-outline', iconActive: 'heart' },
  ProfileTab: { label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
};

export const BottomTabNavigator: React.FC = () => {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cartCount = useCartStore((s) => s.getTotalItems());

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <FloatingTabBar {...props} meta={TAB_META} cartCount={cartCount} onCartPress={() => rootNav.navigate('Cart')} />
      )}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: TAB_META.HomeTab.label }} />
      <Tab.Screen name="OrdersTab" component={OrderHistoryScreen} options={{ title: TAB_META.OrdersTab.label }} />
      <Tab.Screen name="FavoritesTab" component={FavoritesScreen} options={{ title: TAB_META.FavoritesTab.label }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: TAB_META.ProfileTab.label }} />
    </Tab.Navigator>
  );
};
