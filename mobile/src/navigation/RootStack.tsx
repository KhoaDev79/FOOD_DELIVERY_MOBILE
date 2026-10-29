import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { colors } from '../constants/colors';
import { DriverCallScreen } from '../screens/call/DriverCallScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { CheckoutScreen } from '../screens/checkout/CheckoutScreen';
import { OrderTrackingScreen } from '../screens/order/OrderTrackingScreen';
import { AddAddressScreen } from '../screens/profile/AddAddressScreen';
import { AddressManagementScreen } from '../screens/profile/AddressManagementScreen';
import { AddressPickerScreen } from '../screens/profile/AddressPickerScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { RatingScreen } from '../screens/rating/RatingScreen';
import { RestaurantDetailScreen } from '../screens/restaurant/RestaurantDetailScreen';
import { VoucherSelectScreen } from '../screens/voucher/VoucherSelectScreen';
import { RootStackParamList } from '../types/navigation';
import { BottomTabNavigator } from './BottomTabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Giỏ hàng của bạn' }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Xác nhận đơn hàng' }}
      />
      <Stack.Screen
        name="OrderTracking"
        component={OrderTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddressManagement"
        component={AddressManagementScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddAddress"
        component={AddAddressScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddressPicker"
        component={AddressPickerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverCall"
        component={DriverCallScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VoucherSelect"
        component={VoucherSelectScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
