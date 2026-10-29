import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  FavoritesTab: undefined;
  InboxTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  RestaurantDetail: { restaurantId: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string };
  AddressManagement: undefined;
  AddAddress: { initialTag?: 'Nhà' | 'Công ty' | 'Khác' } | undefined;
  AddressPicker: {
    initialCoords?: { latitude: number; longitude: number };
    onSelectAddress?: (address: { addressLine: string; lat: number; lng: number }) => void;
  };
  EditProfile: undefined;
  Chat: { orderId: string; recipientName?: string; recipientRole?: string };
  DriverCall: { orderId: string; driverName?: string; driverPhone?: string };
  Rating: { orderId: string; driverName?: string; restaurantName?: string };
  VoucherSelect: { selectedVoucherId?: string; onSelectVoucher?: (voucher: any) => void };
};

export type OwnerTabParamList = {
  OwnerOrdersTab: undefined;
  OwnerMenuTab: undefined;
  OwnerRestaurantTab: undefined;
};

export type DriverTabParamList = {
  DriverAvailableTab: undefined;
  DriverDeliveriesTab: undefined;
  DriverProfileTab: undefined;
};

export type AdminTabParamList = {
  AdminDashboardTab: undefined;
  AdminUsersTab: undefined;
  AdminRestaurantsTab: undefined;
  AdminProfileTab: undefined;
};
