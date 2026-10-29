export type Role = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'DRIVER' | 'ADMIN';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED';

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
  fullName: string;
  phone?: string | null;
  role: Role;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  isOpen: boolean;
  rating: number;
  distanceKm?: number;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  isArchived: boolean;
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
  };
}

