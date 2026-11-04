import { NavigatorScreenParams } from '@react-navigation/native';
import type { ChatChannel } from './api';

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  FavoritesTab: undefined;
  ProfileTab: undefined;
};

export type AuthStackParamList = {
  /** prefillUsername: điền sẵn sau khi đặt lại mật khẩu */
  Login: { prefillUsername?: string } | undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Search: { initialQuery?: string } | undefined;
  Login: { prefillUsername?: string } | undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  RestaurantDetail: { restaurantId: string; openDishId?: string };
  RestaurantReviews: { restaurantId: string; restaurantName?: string };
  Cart: undefined;
  Checkout: undefined;
  OrderTracking: { orderId: string };
  /** Hộp thư tin nhắn của khách (mở từ trang Tài khoản). */
  Inbox: undefined;
  AddressManagement: undefined;
  AddAddress: { initialTag?: 'Nhà' | 'Công ty' | 'Khác' } | undefined;
  AddressPicker: {
    initialCoords?: { latitude: number; longitude: number };
  };
  EditProfile: undefined;
  /** Khách hàng đăng ký mở quán / làm tài xế. */
  RoleUpgradeRequest: undefined;
  Rating: { orderId: string; restaurantName?: string; driverName?: string; hasDriver?: boolean };
  Chat: { orderId: string; channel: ChatChannel; recipientName?: string; recipientRole?: string };
  NotificationCenter: undefined;
  HelpCenter: undefined;
  HelpArticle: { articleId: string; title?: string };
  OrderIssue: { orderId?: string; preselectedIssue?: string } | undefined;
  SupportTicketList: undefined;
  SupportTicketDetail: { ticketId: string; code?: string };
  SupportChat: undefined;
  VoucherWallet: undefined;
};

export type OwnerTabParamList = {
  OwnerOrdersTab: undefined;
  OwnerMenuTab: undefined;
  OwnerInboxTab: undefined;
  OwnerRestaurantTab: undefined;
};

/** Stack của chủ quán: các tab + màn sửa tài khoản + thống kê + quản lý đánh giá. */
export type OwnerStackParamList = {
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  EditProfile: undefined;
  /** Thống kê bán hàng của quán. */
  OwnerStats: undefined;
  /** Quản lý và phản hồi đánh giá của quán (E3). */
  OwnerReviews: undefined;
  /** Dùng lại màn chọn địa chỉ trên bản đồ của khách hàng để ghim vị trí quán. */
  AddressPicker: RootStackParamList['AddressPicker'];
  Chat: { orderId: string; channel: ChatChannel; recipientName?: string; recipientRole?: string };
  NotificationCenter: undefined;
  /** Mã giảm giá của quán (quán chịu chi phí) */
  OwnerVouchers: { restaurantId: string; restaurantName?: string };
};

export type DriverTabParamList = {
  DriverAvailableTab: undefined;
  DriverDeliveriesTab: undefined;
  DriverInboxTab: undefined;
  DriverProfileTab: undefined;
};

/** Stack của tài xế: các tab + chi tiết chuyến có bản đồ + sửa tài khoản + thông tin xe + sổ quỹ COD + đánh giá. */
export type DriverStackParamList = {
  DriverTabs: NavigatorScreenParams<DriverTabParamList>;
  DriverDeliveryDetail: { orderId: string };
  EditProfile: undefined;
  DriverVehicle?: undefined;
  DriverWallet: undefined;
  DriverReviews: undefined;
  Chat: { orderId: string; channel: ChatChannel; recipientName?: string; recipientRole?: string };
  NotificationCenter: undefined;
};

export type AdminTabParamList = {
  AdminDashboardTab: undefined;
  /** group: tab nhóm đơn; status: lọc chi tiết theo trạng thái; stalledOnly: giữ tương thích (= group 'stalled'). */
  AdminOrdersTab:
    | { group?: 'active' | 'stalled' | 'done' | 'failed'; status?: string; stalledOnly?: boolean; orderId?: string }
    | undefined;
  /** openRequests: mở ngay danh sách yêu cầu nâng cấp chờ duyệt; tab: lọc theo vai trò / đã khoá. */
  AdminUsersTab:
    | { openRequests?: boolean; tab?: 'ALL' | 'CUSTOMER' | 'RESTAURANT_OWNER' | 'DRIVER' | 'ADMIN' | 'LOCKED' }
    | undefined;
  AdminRestaurantsTab:
    | { filter?: 'all' | 'open' | 'closed' | 'unassigned' | 'pending' | 'suspended' | 'active' }
    | undefined;
  AdminProfileTab: undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  EditProfile: undefined;
  AdminBanners: undefined;
  AdminCuisines: undefined;
  AdminAuditLog: undefined;
  NotificationCenter: undefined;
  AdminSupportTickets: undefined;
  AdminVouchers: undefined;
  AdminRefunds: undefined;
};
