import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { colors } from '../constants/colors';
import { OwnerMenuScreen } from '../screens/owner/OwnerMenuScreen';
import { OwnerOrdersScreen } from '../screens/owner/OwnerOrdersScreen';
import { OwnerRestaurantScreen } from '../screens/owner/OwnerRestaurantScreen';
import { OwnerTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

export const OwnerTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.borderLight,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="OwnerOrdersTab"
        component={OwnerOrdersScreen}
        options={{
          title: 'Đơn hàng của quán',
          tabBarLabel: 'Đơn hàng',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerMenuTab"
        component={OwnerMenuScreen}
        options={{
          title: 'Quản lý Thực đơn & Món',
          tabBarLabel: 'Thực đơn',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OwnerRestaurantTab"
        component={OwnerRestaurantScreen}
        options={{
          title: 'Cài đặt Nhà hàng',
          tabBarLabel: 'Cửa hàng',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

