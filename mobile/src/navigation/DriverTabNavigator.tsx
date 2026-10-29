import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { colors } from '../constants/colors';
import { DriverAvailableOrdersScreen } from '../screens/driver/DriverAvailableOrdersScreen';
import { DriverDeliveriesScreen } from '../screens/driver/DriverDeliveriesScreen';
import { DriverProfileScreen } from '../screens/driver/DriverProfileScreen';
import { DriverTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<DriverTabParamList>();

export const DriverTabNavigator: React.FC = () => {
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
        name="DriverAvailableTab"
        component={DriverAvailableOrdersScreen}
        options={{
          title: 'Đơn hàng chờ nhận',
          tabBarLabel: 'Tìm đơn',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverDeliveriesTab"
        component={DriverDeliveriesScreen}
        options={{
          title: 'Chuyến giao của tôi',
          tabBarLabel: 'Chuyến giao',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bicycle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfileTab"
        component={DriverProfileScreen}
        options={{
          title: 'Hồ sơ Tài xế',
          tabBarLabel: 'Tài xế',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

