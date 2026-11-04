import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen';
import { HelpCenterScreen } from '../screens/help/HelpCenterScreen';
import { HelpArticleScreen } from '../screens/help/HelpArticleScreen';
import { OrderIssueScreen } from '../screens/help/OrderIssueScreen';
import { SupportTicketListScreen } from '../screens/help/SupportTicketListScreen';
import { SupportTicketDetailScreen } from '../screens/help/SupportTicketDetailScreen';
import { SupportChatScreen } from '../screens/help/SupportChatScreen';
import { VoucherWalletScreen } from '../screens/voucher/VoucherWalletScreen';
import { RestaurantReviewsScreen } from '../screens/restaurant/RestaurantReviewsScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { colors } from '../constants/colors';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { CheckoutScreen } from '../screens/checkout/CheckoutScreen';
import { OrderTrackingScreen } from '../screens/order/OrderTrackingScreen';
import { AddAddressScreen } from '../screens/profile/AddAddressScreen';
import { AddressManagementScreen } from '../screens/profile/AddressManagementScreen';
import { AddressPickerScreen } from '../screens/profile/AddressPickerScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { RoleUpgradeRequestScreen } from '../screens/profile/RoleUpgradeRequestScreen';
import { RatingScreen } from '../screens/rating/RatingScreen';
import { RestaurantDetailScreen } from '../screens/restaurant/RestaurantDetailScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { InboxScreen } from '../screens/chat/InboxScreen';
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
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
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
        options={{ title: 'Giỏ hàng của bạn', headerShown: false }}
      />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Xác nhận đơn hàng', headerShown: false }}
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
        name="RoleUpgradeRequest"
        component={RoleUpgradeRequestScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RestaurantReviews"
        component={RestaurantReviewsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VoucherWallet"
        component={VoucherWalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HelpArticle"
        component={HelpArticleScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrderIssue"
        component={OrderIssueScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SupportTicketList"
        component={SupportTicketListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SupportTicketDetail"
        component={SupportTicketDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SupportChat"
        component={SupportChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
