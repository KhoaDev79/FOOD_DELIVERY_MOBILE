import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { colors } from '../constants/colors';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { AdminProfileScreen } from '../screens/admin/AdminProfileScreen';
import { AdminRestaurantsScreen } from '../screens/admin/AdminRestaurantsScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<AdminTabParamList>();

export const AdminTabNavigator: React.FC = () => {
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
        name="AdminDashboardTab"
        component={AdminDashboardScreen}
        options={{
          title: 'Tổng quan Hệ thống',
          tabBarLabel: 'Tổng quan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminUsersTab"
        component={AdminUsersScreen}
        options={{
          title: 'Quản lý Người dùng',
          tabBarLabel: 'Người dùng',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminRestaurantsTab"
        component={AdminRestaurantsScreen}
        options={{
          title: 'Quản lý Quán ăn',
          tabBarLabel: 'Quán ăn',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AdminProfileTab"
        component={AdminProfileScreen}
        options={{
          title: 'Cài đặt Quản trị',
          tabBarLabel: 'Hệ thống',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

