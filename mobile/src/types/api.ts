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
  | 'CUSTOMER_WRONG_ITEMS'
  | 'CUSTOMER_WRONG_ADDRESS'
  | 'CUSTOMER_WAIT_TOO_LONG'
  | 'CUSTOMER_FOUND_ALTERNATIVE'
  | 'CUSTOMER_OTHER'
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
export type PaymentStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REFUND_PENDING';

/** Thông tin cho bảng huỷ đơn của khách */
export interface CancelInfo {
  canCancel: boolean;
  reason?: string;
  reasons: { value: CancelReason; label: string; requiresNote?: boolean }[];
  cancelCount: number;
  limit: number;
  windowDays: number;
  warning?: string;
  refundNotice?: string;
}

/** Đơn chờ / đã hoàn tiền (màn admin) */
export interface RefundOrder {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  cancelReason?: CancelReason | null;
  failedReason?: FailedDeliveryReason | null;
  cancelNote?: string | null;
  refundedAt?: string | null;
  refundNote?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; fullName: string; phone?: string | null };
  restaurant: { id: string; name: string };
  transactions: { txnRef: string; providerTxnNo?: string | null; amount: number; bankCode?: string | null }[];
}
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
  /** Giảm trên tiền món (mã giảm giá) */
  itemDiscount?: number;
  /** Giảm trên phí giao (mã freeship) */
  shippingDiscount?: number;
  appliedVouchers?: { code: string; title: string; discountType: VoucherType; amount: number }[];
  rejectedVouchers?: { code: string; reason: string }[];
  total: number;
  isPeak: boolean;
  estimatedMinutes: { min: number; max: number };
  expiresAt: string;
  quoteToken: string;
}

export type VoucherType = 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FREE_SHIP';
export type VoucherFunding = 'PLATFORM' | 'RESTAURANT';
export type VoucherKind = 'CAMPAIGN' | 'COMPENSATION';

/** Voucher hiển thị cho khách (Ví voucher, chọn mã ở Thanh toán) */
export interface VoucherView {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: VoucherType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  endDate: string;
  restaurant?: { id: string; name: string } | null;
  isPersonal: boolean;
  onlyNewCustomer: boolean;
  remaining: number;
  /** Ở danh sách chọn mã: kết quả xét điều kiện với giỏ hiện tại */
  eligible?: boolean;
  reason?: string;
  estimatedSaving?: number;
  slot?: 'DISCOUNT' | 'FREESHIP';
  /** Ở Ví voucher */
  status?: 'AVAILABLE' | 'USED' | 'EXPIRED';
  usedAt?: string;
  savedAmount?: number;
  orderId?: string;
}

/** Voucher đầy đủ cho màn quản lý (admin / chủ quán) */
export interface VoucherAdmin {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: VoucherType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  maxUsage: number;
  usedCount: number;
  perUserLimit: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  onlyNewCustomer: boolean;
  fundedBy: VoucherFunding;
  kind: VoucherKind;
  restaurantId?: string | null;
  restaurant?: { id: string; name: string } | null;
  user?: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface VoucherInput {
  code: string;
  title: string;
  description?: string;
  discountType: VoucherType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  maxUsage: number;
  perUserLimit?: number;
  startDate?: string;
  endDate: string;
  onlyNewCustomer?: boolean;
  isActive?: boolean;
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
  /** Tài khoản đã liên kết đăng nhập Google */
  hasGoogle?: boolean;
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
  /** Mốc thời gian tạm nghỉ có hẹn giờ (chuỗi ISO 8601). Hết hạn quán tự mở lại theo giờ. */
  pausedUntil?: string | null;
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
  /** Lịch mở cửa theo 7 ngày trong tuần */
  openingHours?: RestaurantOpeningHour[];
  /** Danh sách ngày nghỉ đặc biệt của quán (lễ, Tết...) */
  specialClosings?: RestaurantSpecialClosing[];
  /** Khi tìm kiếm: tên các món của quán khớp từ khoá. */
  matchedDishes?: string[];
  /** Nhãn ưu đãi của quán ("Giảm 15K", "Freeship", "Món giảm giá") */
  promoLabel?: string | null;
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
  /** "Hết hôm nay": lúc tự mở bán lại (ISO). null + isAvailable=false = hết đến khi quán bật lại. */
  soldOutUntil?: string | null;
  /** Khung giờ bán (HH:mm). null = bán suốt giờ mở cửa của quán. */
  availableFrom?: string | null;
  availableTo?: string | null;
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
  /** Mốc thời gian tạm nghỉ có hẹn giờ (chuỗi ISO 8601). Hết hạn quán tự mở lại theo giờ. */
  pausedUntil?: string | null;
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

/** Danh mục Trợ giúp / FAQ */
export interface HelpCategory {
  id: string;
  code: string;
  name: string;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  audience: 'CUSTOMER' | 'DRIVER' | 'OWNER';
  _count?: {
    articles: number;
  };
}

/** Bài viết Trợ giúp / FAQ */
export interface HelpArticle {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  keywords: string[];
  sortOrder: number;
  isActive: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    code: string;
    name: string;
    icon?: string | null;
  };
  userFeedback?: boolean | null;
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
  /** Chỉ API admin trả: tên + vai trò người đổi trạng thái (null = hệ thống tự động). */
  actor?: { id: string; fullName: string; role: Role } | null;
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
  /** Ảnh khách đính kèm (đã bỏ ảnh bị ẩn) */
  images?: string[];
}

/** Đầu trang đánh giá của quán: điểm trung bình, số đánh giá theo sao, số đánh giá có ảnh / bình luận */
export interface ReviewSummary {
  rating: number;
  ratingCount: number;
  total: number;
  breakdown?: { star: number; count: number }[];
  photoCount?: number;
  commentCount?: number;
}

export type ReviewImageHideReason = 'IRRELEVANT' | 'OFFENSIVE' | 'PERSONAL_INFO' | 'SPAM';

export interface ManageRestaurantReview extends OrderReview {
  images?: string[];
  hiddenImages?: string[];
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
  discountAmount?: number;
  shippingDiscount?: number;
  voucherCode?: string | null;
  freeshipVoucherCode?: string | null;
  refundedAt?: string | null;
  refundNote?: string | null;
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


/** Bản ghi thông báo hệ thống */
export interface AppNotification {
  id: string;
  userId: string;
  type: 'order' | 'order_available' | 'review_reply' | 'driver_offline' | 'system' | string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/** Giờ mở cửa theo ngày trong tuần (0 = Chủ nhật, 1 = Thứ hai, ..., 6 = Thứ bảy) */
export interface RestaurantOpeningHour {
  id: string;
  restaurantId: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

/** Ngày nghỉ đặc biệt (lễ, Tết, sửa chữa...) */
export interface RestaurantSpecialClosing {
  id: string;
  restaurantId: string;
  date: string;
  reason?: string | null;
}

export interface RestaurantScheduleResponse {
  defaultOpenTime: string;
  defaultCloseTime: string;
  openingHours: RestaurantOpeningHour[];
  specialClosings: RestaurantSpecialClosing[];
}

export type SupportTicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SupportMessageRole = 'CUSTOMER' | 'ADMIN' | 'BOT' | 'SYSTEM';

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId?: string | null;
  senderRole: SupportMessageRole;
  content: string;
  attachments: string[];
  createdAt: string;
  sender?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: string;
  } | null;
}

export interface SupportTicket {
  id: string;
  code: string;
  userId: string;
  orderId?: string | null;
  category: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  resolution?: {
    decision: 'AUTO_COMPENSATE' | 'NEEDS_REVIEW' | 'INFO_ONLY';
    suggestedAction: string;
    reason: string;
    compensationAmount?: number | null;
    compensationType?: 'VOUCHER' | 'REFUND_PENDING' | null;
    /** Mã voucher bồi thường đã phát (nếu có) */
    voucherCode?: string | null;
  } | null;
  csatScore?: number | null;
  csatComment?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    status: string;
    total: number;
    paymentMethod?: string;
    createdAt?: string;
    deliveredAt?: string | null;
    restaurant: { id: string; name: string; imageUrl?: string | null; phone?: string | null };
    items?: { id: string; name: string; unitPrice: number; quantity: number }[];
  } | null;
  user?: {
    id: string;
    fullName: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderRole: SupportMessageRole;
  } | null;
  messages?: SupportMessage[];
}

export type BotCardType = 'ORDER_STATUS' | 'FAQ_ARTICLE' | 'START_ISSUE' | 'CONTACT_SUPPORT' | 'HANDOVER';

export interface BotActionCard {
  type: BotCardType;
  title: string;
  subtitle?: string;
  orderId?: string;
  orderCode?: string;
  status?: OrderStatus;
  imageUrl?: string | null;
  articleId?: string;
  issueType?: string;
  summary?: string;
}

export interface BotWelcome {
  greeting: string;
  mode: 'AI' | 'BASIC';
  quickReplies: string[];
  dailyLimit: number;
  remainingToday: number;
}

export interface BotReplyResult {
  messageId: string;
  conversationId: string;
  role: 'assistant' | 'user';
  content: string;
  source?: 'GEMINI' | 'SCRIPT' | 'CACHE';
  cards?: BotActionCard[];
  quickReplies?: string[];
  isRateLimited?: boolean;
  createdAt?: string;
  feedback?: 'HELPFUL' | 'UNHELPFUL' | null;
}
