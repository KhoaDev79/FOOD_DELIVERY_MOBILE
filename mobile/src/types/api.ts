export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'DRIVER' | 'ADMIN';

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';

export type PaymentMethod = 'COD' | 'VNPAY';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED';

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
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedBy?: string | null;
  createdAt: string;
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
  total: number;
  distanceKm: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string | null;
    address: string;
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
  total: number;
  distanceKm: number;
  deliveryAddress: string;
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
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAt?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  maskedBankAccountNumber?: string | null;
  bankAccountName?: string | null;
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
