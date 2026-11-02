export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'DRIVER' | 'ADMIN';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED';

export type CancelReason =
  | 'CUSTOMER_CHANGED_MIND'
  | 'RESTAURANT_TIMEOUT'
  | 'RESTAURANT_OUT_OF_STOCK'
  | 'RESTAURANT_CLOSED'
  | 'RESTAURANT_OTHER'
  | 'ADMIN_INTERVENTION';

export type FailedDeliveryReason =
  | 'CUSTOMER_UNREACHABLE'
  | 'CUSTOMER_REFUSED'
  | 'WRONG_ADDRESS'
  | 'UNSAFE_LOCATION';

export type DriverLedgerType = 'COD_COLLECTED' | 'SETTLEMENT' | 'ADJUSTMENT';

export interface DriverLedgerEntry {
  id: string;
  driverId: string;
  orderId?: string | null;
  type: DriverLedgerType;
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdById?: string | null;
  createdAt: string;
}

export interface DriverLedgerResponse {
  balance: number;
  limit: number;
  items: DriverLedgerEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  driver?: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
}

export interface DeliveryContactAttempt {
  id: string;
  orderId: string;
  driverId: string;
  channel: string;
  createdAt: string;
}

export type PaymentMethod = 'COD' | 'VNPAY';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED';
export type DistanceSource = 'ROAD' | 'ESTIMATED';

export interface OrderQuoteLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note?: string;
}

export interface OrderQuoteResponse {
  lines: OrderQuoteLine[];
  subtotal: number;
  distanceKm: number;
  distanceSource: DistanceSource;
  baseDeliveryFee: number;
  peakSurcharge: number;
  deliveryFee: number;
  total: number;
  isPeak: boolean;
  estimatedMinutes: { min: number; max: number };
  expiresAt: string;
  quoteToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface User {
  id: string;
  email: string;
  /** Tên đăng nhập. */
  username?: string | null;
  fullName: string;
  phone?: string | null;
  role: Role;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  /** Chỉ có trong danh sách người dùng của admin. */
  _count?: { restaurants: number };
  driverProfile?: {
    id: string;
    vehicleType: VehicleType;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
    licensePlate?: string | null;
    verificationStatus: DriverVerificationStatus;
    rejectionReason?: string | null;
    isOnline: boolean;
    codBalance?: number;
  } | null;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  isManual?: boolean;
  needsConfirmation?: boolean;
  createdAt: string;
}

export type RestaurantStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';

export interface Restaurant {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  address: string;
  phone?: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  status?: RestaurantStatus;
  suspendReason?: string | null;
  isOpen: boolean;
  rating: number;
  ratingCount?: number;
  distanceKm?: number;
  estimatedDeliveryFee?: number;
  /** Thời gian giao dự kiến do backend tính (phút). */
  estimatedMinutes?: { min: number; max: number };
  /** Giờ mở/đóng cửa "HH:mm" (trả về từ /restaurants/nearby). */
  openTime?: string;
  closeTime?: string;
  /** Quán có giao tới vị trí khách không (khoảng cách ≤ bán kính giao). false = chỉ để xem. */
  canDeliver?: boolean;
  /** Khi tìm kiếm: tên các món của quán khớp từ khoá. */
  matchedDishes?: string[];
  /** Chỉ có ở /restaurants/mine: khách có đặt được không (bật mở cửa + trong giờ mở cửa). */
  acceptingOrders?: boolean;
}

/** Tuỳ chọn có giá của món (cột JSON `options` trong DB). */
export interface PricedOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemOptions {
  sizes?: PricedOption[];
  toppings?: PricedOption[];
  spiceLevels?: string[];
  sugarLevels?: string[];
}

/** Tuỳ chọn chủ quán gửi lên khi tạo/sửa món (id chỉ có với lựa chọn đã lưu trước đó). */
export interface MenuItemOptionsInput {
  sizes?: { id?: string; name: string; price: number }[];
  toppings?: { id?: string; name: string; price: number }[];
  spiceLevels?: string[];
  sugarLevels?: string[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  /** Giá khuyến mãi; backend dùng khi 0 < discountPrice < price. */
  discountPrice?: number | null;
  options?: MenuItemOptions | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  isArchived: boolean;
}

/** Món gợi ý thêm vào giỏ. BOUGHT_TOGETHER: hay được mua chung; BEST_SELLER: bán chạy; MENU: món khác của quán. */
export interface MenuSuggestion extends MenuItem {
  reason: 'BOUGHT_TOGETHER' | 'BEST_SELLER' | 'MENU';
  count: number;
}

/** Món ăn quanh người dùng (GET /restaurants/nearby/dishes). */
export interface NearbyDish extends MenuItem {
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string | null;
    isOpen: boolean;
    rating: number;
    latitude: number;
    longitude: number;
    distanceKm: number;
  };
}

/** Banner trang chủ (GET /banners). */
export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  actionType?: string | null;
  actionValue?: string | null;
  sortOrder: number;
}

/** Danh mục ẩm thực hệ thống (GET /cuisines). */
export interface CuisineCategory {
  id: string;
  code: string;
  name: string;
  imageUrl: string;
  sortOrder: number;
  keywords: string[];
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  menuItems: MenuItem[];
}

export interface RestaurantDetail extends Restaurant {
  categories: Category[];
  uncategorizedItems: MenuItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string | null;
  /** Tuỳ chọn khách đã chọn (snapshot lúc đặt). */
  options?: {
    size?: { id: string; name: string; price: number };
    toppings?: { id: string; name: string; price: number }[];
    level?: string;
  } | null;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedBy?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface OrderReview {
  id: string;
  orderId: string;
  customerId: string;
  restaurantId: string;
  rating: number;
  comment?: string | null;
  driverId?: string | null;
  driverRating?: number | null;
  driverComment?: string | null;
  ownerReply?: string | null;
  ownerRepliedAt?: string | null;
  isHidden?: boolean;
  createdAt: string;
}

export interface PublicRestaurantReview {
  id: string;
  rating: number;
  comment?: string | null;
  ownerReply?: string | null;
  ownerRepliedAt?: string | null;
  createdAt: string;
  customerName: string;
  customerAvatarUrl?: string | null;
}

export interface ManageRestaurantReview extends OrderReview {
  customer?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  } | null;
}

export interface OrderDetail {
  id: string;
  customerId: string;
  restaurantId: string;
  driverId?: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryFee: number;
  peakSurcharge?: number;
  platformCommission?: number;
  driverEarning?: number;
  total: number;
  distanceKm: number;
  distanceSource?: DistanceSource;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  estimatedDeliveryAt?: string | null;
  arrivedAt?: string | null;
  cancelReason?: CancelReason | null;
  cancelNote?: string | null;
  cancelledById?: string | null;
  failedReason?: FailedDeliveryReason | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  contactAttempts?: DeliveryContactAttempt[];
  distanceToRestaurantKm?: number;
  deliveryDistanceKm?: number;
  codToCollect?: number;
  debtAfterAccept?: number;
  driverLocation?: {
    lat: number;
    lng: number;
    at: string | null;
  } | null;
  review?: OrderReview | null;
  canReview?: boolean;
  stalledAt?: string | null;
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string | null;
    address: string;
    phone?: string | null;
    latitude: number;
    longitude: number;
    ownerId: string;
  };
  customer: {
    id: string;
    fullName: string;
    phone?: string | null;
  };
  driver?: {
    id: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    vehicleType?: 'MOTORBIKE' | 'ELECTRIC_MOTORBIKE' | 'BICYCLE' | null;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
    licensePlate?: string | null;
    driverProfile?: {
      vehicleType?: 'MOTORBIKE' | 'ELECTRIC_MOTORBIKE' | 'BICYCLE' | null;
      vehicleBrand?: string | null;
      vehicleModel?: string | null;
      vehicleColor?: string | null;
      licensePlate?: string | null;
    } | null;
  } | null;
  statusHistory: OrderStatusHistory[];
}

export interface OrderSummary {
  id: string;
  customerId: string;
  restaurantId: string;
  driverId?: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  deliveryFee: number;
  peakSurcharge?: number;
  platformCommission?: number;
  driverEarning?: number;
  total: number;
  distanceKm: number;
  distanceSource?: DistanceSource;
  deliveryAddress: string;
  estimatedDeliveryAt?: string | null;
  cancelReason?: CancelReason | null;
  cancelNote?: string | null;
  failedReason?: FailedDeliveryReason | null;
  review?: OrderReview | null;
  canReview?: boolean;
  createdAt: string;
  items: { name: string; quantity: number }[];
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string | null;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  customer?: {
    id: string;
    fullName: string;
    phone?: string | null;
  };
}

/** GET /orders/driver/stats – thống kê thu nhập tài xế theo giờ VN. */
export interface DriverStats {
  days: number;
  from: string;
  to: string;
  earnings: number;
  deliveredTrips: number;
  cancelledTrips: number;
  cashCollected: number;
  daily: { date: string; earnings: number; trips: number }[];
}

/** GET /restaurants/:id/stats – doanh thu tính trên tiền món của đơn đã giao (không gồm phí giao). */
export interface RestaurantStats {
  days: number;
  from: string;
  to: string;
  revenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  inProgressOrders: number;
  averageOrderValue: number;
  itemsSold: number;
  daily: { date: string; revenue: number; orders: number }[];
  topItems: { menuItemId: string; name: string; quantity: number; revenue: number }[];
}

export type VehicleType = 'MOTORBIKE' | 'ELECTRIC_MOTORBIKE' | 'BICYCLE';

export type DriverVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DriverProfile {
  id: string;
  userId: string;
  vehicleType: VehicleType;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  licensePlate?: string | null;
  driverLicenseClass?: string | null;
  verificationStatus: DriverVerificationStatus;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  verifiedById?: string | null;
  isOnline: boolean;
  codBalance?: number;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAt?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  maskedBankAccountNumber?: string | null;
  bankAccountName?: string | null;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
    isActive: boolean;
  };
}

export type RoleRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Yêu cầu nâng cấp vai trò: khách hàng xin làm Chủ quán / Tài xế. */
export interface RoleUpgradeRequest {
  id: string;
  userId: string;
  requestedRole: Extract<Role, 'RESTAURANT_OWNER' | 'DRIVER'>;
  status: RoleRequestStatus;
  metadata?: {
    restaurantName?: string | null;
    restaurantAddress?: string | null;
    vehicleType?: VehicleType;
    vehicleBrand?: string | null;
    vehicleModel?: string | null;
    vehicleColor?: string | null;
    licensePlate?: string | null;
  } | null;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CreateRoleRequestPayload {
  requestedRole: 'RESTAURANT_OWNER' | 'DRIVER';
  restaurantName?: string;
  restaurantAddress?: string;
  vehicleType?: VehicleType;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  note?: string;
}

/** Cuộc trò chuyện 2 bên trong một đơn. */
export type ChatChannel = 'CUSTOMER_DRIVER' | 'CUSTOMER_RESTAURANT' | 'RESTAURANT_DRIVER';

export interface OrderMessage {
  id: string;
  orderId: string;
  channel: ChatChannel;
  driverId?: string | null;
  senderId: string;
  senderRole: 'CUSTOMER' | 'DRIVER' | 'RESTAURANT_OWNER' | 'ADMIN';
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: string;
  };
}

export interface UnreadConversation {
  orderId: string;
  channel: ChatChannel;
  orderStatus: OrderStatus | null;
  restaurantName: string | null;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderRole: OrderMessage['senderRole'];
    sender: { id: string; fullName: string; role: string };
  };
}

export interface UnreadMessagesSummary {
  totalUnread: number;
  conversations: UnreadConversation[];
}

/** Một cuộc trò chuyện trong hộp thư (GET /orders/messages/conversations). */
export interface ChatConversation {
  orderId: string;
  channel: ChatChannel;
  unreadCount: number;
  /** Người bên kia: khách, quán hoặc tài xế. */
  counterpart: { side: 'CUSTOMER' | 'RESTAURANT' | 'DRIVER'; name: string; avatarUrl: string | null };
  lastMessage: { id: string; content: string; createdAt: string; senderRole: Role; isMine: boolean };
  order: {
    id: string;
    code: string;
    status: OrderStatus;
    createdAt: string;
    total: number;
    paymentMethod: PaymentMethod;
    deliveryAddress: string;
    itemCount: number;
    items: { name: string; quantity: number }[];
    restaurant: { id: string; name: string; imageUrl: string | null };
    customer: { id: string; fullName: string };
    driver: { id: string; fullName: string } | null;
  };
}

export interface DriverReviewItem {
  id: string;
  orderId: string;
  driverRating?: number | null;
  driverComment?: string | null;
  driverReply?: string | null;
  driverRepliedAt?: string | null;
  createdAt: string;
  customerName: string;
  restaurant?: {
    name: string;
  };
}

