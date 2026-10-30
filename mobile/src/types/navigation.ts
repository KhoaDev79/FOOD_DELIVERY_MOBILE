import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  FavoritesTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Search: { initialQuery?: string } | undefined;
  Login: undefined;
  Register: undefined;
  RestaurantDetail: { restaurantId: string; openDishId?: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string };
  AddressManagement: undefined;
  AddAddress: { initialTag?: 'Nhà' | 'Công ty' | 'Khác' } | undefined;
  AddressPicker: {
    initialCoords?: { latitude: number; longitude: number };
  };
  EditProfile: undefined;
  /** Khách hàng đăng ký mở quán / làm tài xế. */
  RoleUpgradeRequest: undefined;
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

/** Stack của chủ quán: các tab + màn sửa tài khoản (trước đây không mở được vì thiếu route). */
export type OwnerStackParamList = {
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  EditProfile: undefined;
  /** Thống kê bán hàng của quán. */
  OwnerStats: undefined;
  /** Dùng lại màn chọn địa chỉ trên bản đồ của khách hàng để ghim vị trí quán. */
  AddressPicker: RootStackParamList['AddressPicker'];
};

export type DriverTabParamList = {
  DriverAvailableTab: undefined;
  DriverDeliveriesTab: undefined;
  DriverProfileTab: undefined;
};

/** Stack của tài xế: các tab + chi tiết chuyến có bản đồ + sửa tài khoản + thông tin xe. */
export type DriverStackParamList = {
  DriverTabs: NavigatorScreenParams<DriverTabParamList>;
  DriverDeliveryDetail: { orderId: string };
  EditProfile: undefined;
  DriverVehicle?: undefined;
  Chat: { orderId: string; recipientName?: string; recipientRole?: string };
};

export type AdminTabParamList = {
  AdminDashboardTab: undefined;
  /** openRequests: mở ngay danh sách yêu cầu nâng cấp chờ duyệt. */
  AdminUsersTab: { openRequests?: boolean } | undefined;
  AdminRestaurantsTab: { filter?: 'all' | 'open' | 'closed' | 'unassigned' } | undefined;
  AdminProfileTab: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  EditProfile: undefined;
};
